import type { ModelConfig } from '@/types/settings'
import type { HaodouConsumeReason } from '@/lib/auth/haodou-labels'
import { buildImageProxyTierPayload } from '@/lib/models/image-generation-tier-params'
import type { ImageGenerationTierParams } from '@/lib/models/image-generation-tier-params'
import { isGrokImageModel } from '@/lib/models/image-model-presets'
import { normalizeRemoteMediaUrl } from '@/lib/storage/media-path-resolver'
import {
  resolveImageEditUrl,
  resolveImageTaskPollUrl,
  resolveImageUrl,
} from '@/lib/models/model-endpoint'
import { isSystemModel, shouldUseSystemModelProxy } from '@/lib/models/system-models-service'
import { proxySystemModelImage } from '@/lib/models/system-model-proxy'
import { readSettings } from '@/lib/storage/settings-service'

/** xAI Grok Imagine 支持的画幅（docs.x.ai images） */
const GROK_IMAGE_ASPECT_RATIOS = [
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '2:1',
  '1:2',
  '9:19.5',
  '19.5:9',
  '9:20',
  '20:9',
] as const

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

/** 将像素 size / 预设映射为 Grok 的 aspect_ratio + resolution */
export function mapSizeToGrokImageParams(size?: string): {
  aspect_ratio: string
  resolution: '1k' | '2k'
} {
  const raw = String(size || '').trim().toLowerCase()
  if (!raw) return { aspect_ratio: 'auto', resolution: '2k' }

  const preset = raw.match(/^(1k|2k|4k)-(\d+(?:\.\d+)?:\d+(?:\.\d+)?)$/)
  if (preset) {
    const ratio = preset[2]
    const resolution: '1k' | '2k' = preset[1] === '1k' ? '1k' : '2k'
    const known = GROK_IMAGE_ASPECT_RATIOS.includes(ratio as (typeof GROK_IMAGE_ASPECT_RATIOS)[number])
    return { aspect_ratio: known ? ratio : 'auto', resolution }
  }

  if (/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(raw)) {
    const known = GROK_IMAGE_ASPECT_RATIOS.includes(raw as (typeof GROK_IMAGE_ASPECT_RATIOS)[number])
    return { aspect_ratio: known ? raw : 'auto', resolution: '2k' }
  }

  const dim = raw.match(/^(\d+)\s*[x×]\s*(\d+)$/i)
  if (dim) {
    const w = Number(dim[1])
    const h = Number(dim[2])
    const resolution: '1k' | '2k' = Math.max(w, h) >= 2048 ? '2k' : '1k'
    const g = gcd(w, h)
    const simplified = `${Math.round(w / g)}:${Math.round(h / g)}`
    if (GROK_IMAGE_ASPECT_RATIOS.includes(simplified as (typeof GROK_IMAGE_ASPECT_RATIOS)[number])) {
      return { aspect_ratio: simplified, resolution }
    }
    // 常见像素近似
    const target = w / h
    let best: string = 'auto'
    let bestDiff = Number.POSITIVE_INFINITY
    for (const ratio of GROK_IMAGE_ASPECT_RATIOS) {
      const [a, b] = ratio.split(':').map(Number)
      if (!a || !b) continue
      const diff = Math.abs(a / b - target)
      if (diff < bestDiff) {
        bestDiff = diff
        best = ratio
      }
    }
    return { aspect_ratio: bestDiff < 0.08 ? best : 'auto', resolution }
  }

  return { aspect_ratio: 'auto', resolution: '2k' }
}

function buildGrokImageSource(url: string): { url: string; type: 'image_url' } {
  return { url, type: 'image_url' }
}

function buildGrokImageBody(options: {
  modelId: string
  prompt: string
  size: string
  referenceImageUrls: string[]
}): Record<string, unknown> {
  const { aspect_ratio, resolution } = mapSizeToGrokImageParams(options.size)
  const body: Record<string, unknown> = {
    model: options.modelId,
    prompt: options.prompt,
    n: 1,
    aspect_ratio,
    resolution,
  }
  const refs = options.referenceImageUrls
  if (refs.length === 1) {
    body.image = buildGrokImageSource(refs[0])
  } else if (refs.length > 1) {
    body.images = refs.map((url) => buildGrokImageSource(url))
  }
  return body
}

const IMAGE_POLL_INTERVAL_MS = 4_000
const IMAGE_POLL_TIMEOUT_MS = 10 * 60 * 1000

function tryExtractImageUrl(payload: unknown): string | null {
  const data = payload as {
    data?: Array<{ url?: string; b64_json?: string }>
    images?: Array<{ url?: string }>
    url?: string
  }
  const url = data.data?.[0]?.url ?? data.images?.[0]?.url ?? data.url
  if (url) return normalizeRemoteMediaUrl(url)
  const b64 = data.data?.[0]?.b64_json
  if (b64) return `data:image/png;base64,${b64}`
  return null
}

function extractImageTaskId(payload: Record<string, unknown>): string {
  return String(
    payload.id ||
      payload.task_id ||
      (payload.data as { id?: string } | undefined)?.id ||
      '',
  ).trim()
}

function extractImageTaskStatus(payload: Record<string, unknown>): string {
  const nested = payload.data as Record<string, unknown> | undefined
  return String(payload.status ?? nested?.status ?? '').trim().toLowerCase()
}

function isImageTaskSuccess(status: string): boolean {
  return status === 'success' || status === 'succeeded' || status === 'completed' || status === 'done'
}

function isImageTaskFailed(status: string): boolean {
  return (
    status === 'error' ||
    status === 'failed' ||
    status === 'fail' ||
    status === 'cancelled' ||
    status === 'canceled' ||
    status === 'expired'
  )
}

function isImageAsyncTaskPayload(payload: Record<string, unknown>): boolean {
  if (tryExtractImageUrl(payload)) return false
  const objectType = String(payload.object || '').toLowerCase()
  if (objectType === 'image.task') return true
  const status = extractImageTaskStatus(payload)
  if (
    status === 'queued' ||
    status === 'pending' ||
    status === 'running' ||
    status === 'processing' ||
    status === 'in_progress'
  ) {
    return true
  }
  return Boolean(payload.poll_url && extractImageTaskId(payload))
}

function extractImageApiError(payload: Record<string, unknown>, fallback: string): string {
  const errObj = payload.error as { message?: string; code?: string } | string | undefined
  if (typeof errObj === 'string' && errObj.trim()) return errObj.trim()
  if (typeof errObj === 'object' && errObj?.message) {
    const code = errObj.code ? ` (${errObj.code})` : ''
    return `${errObj.message}${code}`
  }
  const msg = String(payload.message || '').trim()
  return msg || fallback
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason instanceof Error ? signal.reason : new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

async function pollImageTask(options: {
  apiKey: string
  createUrl: string
  taskId: string
  pollUrl?: string | null
  signal?: AbortSignal
}): Promise<string> {
  const pollUrl = resolveImageTaskPollUrl(options.createUrl, options.taskId, options.pollUrl)
  const started = Date.now()

  while (Date.now() - started < IMAGE_POLL_TIMEOUT_MS) {
    if (options.signal?.aborted) {
      throw options.signal.reason instanceof Error
        ? options.signal.reason
        : new DOMException('Aborted', 'AbortError')
    }

    const response = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${options.apiKey}` },
      signal: options.signal ?? AbortSignal.timeout(60_000),
    })
    const text = await response.text()
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(text) as Record<string, unknown>
    } catch {
      throw new Error(`图片任务查询失败 (${response.status})：${text.slice(0, 200)}`)
    }
    if (!response.ok) {
      throw new Error(
        `图片任务查询失败 (${response.status})：${extractImageApiError(payload, text.slice(0, 200))}`,
      )
    }

    const status = extractImageTaskStatus(payload)
    const readyUrl = tryExtractImageUrl(payload)
    if (readyUrl && (!status || isImageTaskSuccess(status))) {
      return readyUrl
    }
    if (isImageTaskFailed(status)) {
      throw new Error(extractImageApiError(payload, '图片生成失败'))
    }

    await delay(IMAGE_POLL_INTERVAL_MS, options.signal)
  }

  throw new Error('图片生成超时')
}

async function resolveImageApiResult(options: {
  payload: unknown
  apiKey: string
  createUrl: string
  signal?: AbortSignal
}): Promise<string> {
  const syncUrl = tryExtractImageUrl(options.payload)
  if (syncUrl) return syncUrl

  const payload = (options.payload || {}) as Record<string, unknown>
  if (!isImageAsyncTaskPayload(payload)) {
    throw new Error('图片 API 返回格式无法解析')
  }

  const taskId = extractImageTaskId(payload)
  if (!taskId) throw new Error('图片 API 未返回任务 ID 或图片地址')

  return pollImageTask({
    apiKey: options.apiKey,
    createUrl: options.createUrl,
    taskId,
    pollUrl: typeof payload.poll_url === 'string' ? payload.poll_url : null,
    signal: options.signal,
  })
}

async function fetchReferenceImageFile(
  source: string,
  index: number,
  signal?: AbortSignal,
): Promise<File> {
  const trimmed = String(source || '').trim()
  if (!trimmed) throw new Error('参考图地址为空')

  const response = await fetch(trimmed, { signal: signal ?? AbortSignal.timeout(120_000) })
  if (!response.ok) {
    throw new Error(`下载参考图失败 (${response.status})`)
  }
  const blob = await response.blob()
  const mime = blob.type || 'image/png'
  const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png'
  return new File([blob], `reference_${index + 1}.${ext}`, { type: mime })
}

async function postImageRequest(options: {
  model: ModelConfig
  prompt: string
  size: string
  referenceImageUrls?: string[]
  signal?: AbortSignal
}): Promise<string> {
  const { model, prompt, size } = options
  const refs = (options.referenceImageUrls ?? []).map((item) => String(item || '').trim()).filter(Boolean)
  const useEdit = refs.length > 0
  const url = useEdit ? resolveImageEditUrl(model) : resolveImageUrl(model)
  const signal = options.signal ?? AbortSignal.timeout(120_000)
  const grok = isGrokImageModel(model)

  let response: Response
  if (grok) {
    // xAI：JSON；参考图用 image.url / images[]，不用 multipart
    // https://docs.x.ai/developers/rest-api-reference/inference/images#image-edit
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify(
        buildGrokImageBody({
          modelId: model.model,
          prompt,
          size,
          referenceImageUrls: refs,
        }),
      ),
      signal,
    })
  } else if (useEdit) {
    // OpenAI / 多数中转：multipart 上传参考图文件
    const form = new FormData()
    form.append('model', model.model)
    form.append('prompt', prompt)
    form.append('n', '1')
    if (size) form.append('size', size)

    const files = await Promise.all(refs.map((item, index) => fetchReferenceImageFile(item, index, signal)))
    if (files.length === 1) {
      form.append('image', files[0])
    } else {
      for (const file of files) {
        form.append('image[]', file)
      }
    }

    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${model.apiKey}`,
      },
      body: form,
      signal,
    })
  } else {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: model.model,
        prompt,
        n: 1,
        size,
      }),
      signal,
    })
  }

  const text = await response.text().catch(() => '')
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === 'object'
        ? extractImageApiError(payload as Record<string, unknown>, text.slice(0, 200))
        : text.slice(0, 200)
    throw new Error(`生图失败 (${response.status})${detail ? `: ${detail}` : ''}`)
  }

  if (payload == null) {
    throw new Error('图片 API 返回格式无法解析')
  }

  return resolveImageApiResult({
    payload,
    apiKey: model.apiKey || '',
    createUrl: url,
    signal: options.signal,
  })
}

export function pickImageModel(models: ModelConfig[], preferredId?: string): ModelConfig {
  if (!models.length) throw new Error('请先在系统设置中配置图片模型')
  if (preferredId) {
    const hit = models.find((m) => m.id === preferredId || m.model === preferredId || m.name === preferredId)
    if (hit) return hit
  }
  return models[0]
}

export async function generateImage(
  model: ModelConfig,
  prompt: string,
  size = '1024x1024',
  referenceImageUrls?: string[],
  signal?: AbortSignal,
  haodouReason: HaodouConsumeReason = 'consume_image',
  tierOptions?: ImageGenerationTierParams | null,
): Promise<string> {
  if (shouldUseSystemModelProxy(model)) {
    const settings = (await readSettings()).data
    const tierPayload = buildImageProxyTierPayload(model, tierOptions)
    // external 系统模型：扣豆由代理接口按档计价（含失败退还），不再客户端 pre-consume
    return proxySystemModelImage({
      modelKey: model.modelKey!,
      prompt,
      size,
      imageUrls: referenceImageUrls,
      resolution: tierPayload.resolution,
      quality: tierPayload.quality,
      apiBase: settings.apiBaseUrl,
      abortSignal: signal,
    })
  }

  if (isSystemModel(model) && model.modelKey) {
    throw new Error(
      `内部 API 模型「${model.name}」不走服务端代理，请使用支持的模型类型（当前图片内部模型暂不支持）`,
    )
  }

  if (!model.apiKey?.trim()) throw new Error(`模型「${model.name}」未配置 API Key`)
  if (!model.model?.trim()) throw new Error(`模型「${model.name}」未配置 model 名称`)

  return postImageRequest({
    model,
    prompt,
    size,
    referenceImageUrls,
    signal,
  })
}

export function createMockGeneratedImage(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" fill="#1e1b4b"/><text x="50%" y="48%" fill="#c4b5fd" font-size="24" text-anchor="middle" font-family="sans-serif">${label}</text><text x="50%" y="56%" fill="#94a3b8" font-size="14" text-anchor="middle" font-family="sans-serif">预览模式</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
