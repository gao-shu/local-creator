import {
  assertNotAborted,
  delayWithAbort,
  mergeFetchSignal,
} from '@/lib/video/video-generation-abort'
import {
  formatVideoTaskProgress,
  isVideoTaskFailed,
  isVideoTaskSuccess,
  parseVideoPollPayload,
  VIDEO_PROGRESS_COMPLETED,
  VIDEO_PROGRESS_CREATING,
  VIDEO_PROGRESS_SUBMITTED,
  type VideoProgressCallback,
} from '@/lib/video/video-progress'
import { formatZhipuImageUrlField } from '@/lib/video/video-api-reference'
import { resolveVideoApiImageUrl } from '@/lib/video/video-media-resolve'
import type { VideoReferenceMode } from '@/lib/workflow/storyboard-video-presets'
import type { ShotVideoReferenceKind } from '@/lib/workflow/shot-video-utils'
import type { VideoRequestPreview } from '@/lib/video/video-request-preview'
import { prepareExternalVideoReferenceUrls } from '@/lib/video/video-provider'
import { VIDEO_POLL_INTERVAL_MS } from '@/constants/batch-concurrency'

const ZHIPU_HOSTS = ['open.bigmodel.cn', 'bigmodel.cn']
const DEFAULT_CREATE = 'https://open.bigmodel.cn/api/paas/v4/videos/generations'
const VALID_MODELS = new Set(['cogvideox-3', 'cogvideox-2', 'cogvideox-flash'])
const DEFAULT_MODEL = 'cogvideox-flash'
const POLL_TIMEOUT_MS = 30 * 60 * 1000

export interface ZhipuVideoCreateInput {
  apiKey: string
  endpoint?: string
  model: string
  prompt: string
  durationSec: number
  aspectRatio: string
  resolution?: string
  imageUrl?: string | string[] | null
  /** 已上传至后台的 https 参考图（优先使用，避免重复 upload） */
  resolvedImageUrls?: string[]
  referenceMode?: VideoReferenceMode
  /** 项目根目录，用于解析相对路径的分镜图 */
  projectRoot?: string
  /** 后台 admin 根地址，用于上传参考图获取 https URL */
  apiBaseUrl?: string
  quality?: 'quality' | 'speed'
  withAudio?: boolean
}

export interface ZhipuVideoPollResult {
  success: boolean
  videoUrl?: string
  error?: string
  timeout?: boolean
}

export function isZhipuVideoEndpoint(endpoint?: string): boolean {
  const host = (endpoint || '').toLowerCase()
  return ZHIPU_HOSTS.some((h) => host.includes(h))
}

export function isZhipuVideoModel(
  model: string,
  endpoint?: string,
  apiFormat?: string,
): boolean {
  if (String(apiFormat || '').trim().toLowerCase() === 'zhipu') return true
  const m = (model || '').toLowerCase()
  if (m.startsWith('cogvideox')) return true
  return isZhipuVideoEndpoint(endpoint)
}

export function resolveZhipuModel(model?: string): string {
  const m = (model || '').trim().toLowerCase()
  if (VALID_MODELS.has(m)) return m
  if (m.startsWith('cogvideox')) return DEFAULT_MODEL
  return DEFAULT_MODEL
}

export function resolveZhipuVideoSize(
  resolution: string,
  aspectRatio: string,
  model: string,
): string {
  const res = Number(resolution) || 480
  const isPortrait = aspectRatio === '9:16'
  const isSquare = aspectRatio === '1:1'
  const isV3 = resolveZhipuModel(model) === 'cogvideox-3'

  if (isSquare) return '1024x1024'
  if (isPortrait) {
    if (res >= 1080) return '1080x1920'
    if (res >= 720) return isV3 ? '720x1280' : '960x1280'
    return '960x1280'
  }
  if (res >= 1080) return '1920x1080'
  if (res >= 720) return isV3 ? '1280x720' : '1280x960'
  return '720x480'
}

/** 本地路径 / data URL → 后台 upload → 智谱可提交的 https image_url */
export async function resolveImageRefForZhipu(
  ref?: string | null,
  options?: { projectRoot?: string; apiBaseUrl?: string; label?: string },
): Promise<string | null> {
  if (!ref?.trim()) return null
  return resolveVideoApiImageUrl(ref, {
    projectRoot: options?.projectRoot,
    apiBaseUrl: options?.apiBaseUrl,
    label: options?.label ?? 'zhipu_ref_image',
  })
}

export function resolveZhipuCreateUrl(endpoint?: string): string {
  const base = (endpoint || DEFAULT_CREATE).trim().replace(/\/+$/, '')
  if (base.includes('/videos/generations')) return base
  if (isZhipuVideoEndpoint(base)) {
    return base.includes('/api/paas/v4')
      ? `${base}/videos/generations`
      : `${base}/api/paas/v4/videos/generations`
  }
  return DEFAULT_CREATE
}

export function resolveZhipuPollUrl(apiKey: string, taskId: string, endpoint?: string): string {
  const base = (endpoint || DEFAULT_CREATE).trim()
  try {
    const u = new URL(base)
    if (isZhipuVideoEndpoint(u.hostname)) {
      return `${u.origin}/api/paas/v4/async-result/${encodeURIComponent(taskId)}`
    }
  } catch {
    /* use default */
  }
  return `https://open.bigmodel.cn/api/paas/v4/async-result/${encodeURIComponent(taskId)}`
}

function extractVideoUrl(data: Record<string, unknown>): string {
  const list =
    (data.video_result as Array<{ url?: string; video_url?: string }> | undefined) ||
    (data.data as { video_result?: Array<{ url?: string }> } | undefined)?.video_result
  if (Array.isArray(list) && list.length > 0) {
    const item = list[0]
    return item?.url || item?.video_url || ''
  }
  const nested = data.data as { video_url?: string; url?: string } | undefined
  return (
    (data.video_url as string) ||
    (data.url as string) ||
    nested?.video_url ||
    nested?.url ||
    ''
  )
}

function extractTaskId(data: Record<string, unknown>): string {
  return String(data.id || data.task_id || data.request_id || '')
}

export async function buildZhipuCreateBody(input: ZhipuVideoCreateInput): Promise<Record<string, unknown>> {
  const model = resolveZhipuModel(input.model)
  const prompt = input.prompt.trim().slice(0, 512)
  let imageField: string | string[] | undefined

  if (input.resolvedImageUrls?.length) {
    imageField = formatZhipuImageUrlField(input.resolvedImageUrls, {
      mode: input.referenceMode,
      model: input.model,
    })
  } else if (input.imageUrl) {
    const resolveRef = (u: string, index: number) =>
      resolveImageRefForZhipu(u, {
        projectRoot: input.projectRoot,
        apiBaseUrl: input.apiBaseUrl,
        label: `zhipu_ref_image_${index + 1}`,
      })
    const rawList = Array.isArray(input.imageUrl) ? input.imageUrl : [input.imageUrl]
    const resolved = (await Promise.all(rawList.map((u, index) => resolveRef(u, index)))).filter(
      Boolean,
    ) as string[]
    imageField = formatZhipuImageUrlField(resolved, {
      mode: input.referenceMode,
      model: input.model,
    })
  }

  const body: Record<string, unknown> = {
    model,
    size: resolveZhipuVideoSize(input.resolution || '480', input.aspectRatio, model),
    quality: input.quality || 'quality',
    with_audio: input.withAudio !== false,
    fps: 30,
  }

  // duration 仅 cogvideox-3 文档枚举支持 5/10；flash/2 传此字段会触发 1210
  if (model === 'cogvideox-3') {
    body.duration = input.durationSec === 10 ? 10 : 5
  }

  if (prompt) body.prompt = prompt
  if (imageField) body.image_url = imageField

  if (input.resolvedImageUrls?.length && !body.image_url) {
    throw new Error(
      `智谱图生视频内部错误：已解析 ${input.resolvedImageUrls.length} 张参考图 URL，但未写入 image_url 字段`,
    )
  }

  if (
    input.referenceMode &&
    input.referenceMode !== 'text_to_video' &&
    !imageField
  ) {
    throw new Error(
      '参考图上传失败或未找到有效的分镜首帧图，无法调用智谱图生视频（cogvideox-flash 需 image_url 为 https 字符串）',
    )
  }

  if (!body.prompt && !body.image_url) {
    throw new Error('请填写分镜描述或提供首帧参考图')
  }

  return body
}

/** 供确认弹窗 / 调试预览智谱请求体 */
export async function previewZhipuVideoCreateBody(
  input: ZhipuVideoCreateInput,
): Promise<Record<string, unknown>> {
  return buildZhipuCreateBody(input)
}

export interface PrepareZhipuVideoRequestPreviewInput {
  model: { name?: string; model?: string; endpoint?: string }
  prompt: string
  durationSec: number
  aspectRatio: string
  resolution?: string
  referenceMode?: VideoReferenceMode
  referenceImageItems?: Array<{
    label: string
    path: string
    kind?: ShotVideoReferenceKind
  }>
  referenceImagePaths?: string[]
  referenceImagePath?: string | null
  projectRoot?: string
  apiBaseUrl?: string
  referenceModeLabel?: string
  shotNumber?: number
  batchCount?: number
  withAudio?: boolean
}

/** 上传参考图后构建智谱确认弹窗预览（展示真实 POST body） */
export async function prepareZhipuVideoRequestPreview(
  input: PrepareZhipuVideoRequestPreviewInput,
): Promise<{ preview: VideoRequestPreview; resolvedImageUrls: string[] }> {
  const referenceMode = input.referenceMode ?? 'first_frame'
  const needsReferenceImage = referenceMode !== 'text_to_video'
  const resolvedImageUrls = needsReferenceImage
    ? await prepareExternalVideoReferenceUrls({
        referenceMode,
        referenceImageItems: input.referenceImageItems,
        referenceImagePaths: input.referenceImagePaths,
        referenceImagePath: input.referenceImagePath,
        projectRoot: input.projectRoot,
        apiBaseUrl: input.apiBaseUrl,
        uploadLabel: 'zhipu_ref_image',
      })
    : []

  const body = await buildZhipuCreateBody({
    apiKey: 'preview',
    endpoint: input.model.endpoint,
    model: input.model.model || DEFAULT_MODEL,
    prompt: input.prompt,
    durationSec: input.durationSec,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    resolvedImageUrls,
    referenceMode,
    projectRoot: input.projectRoot,
    apiBaseUrl: input.apiBaseUrl,
    withAudio: input.withAudio,
  })

  const imageUrlType = body.image_url == null ? 'none' : Array.isArray(body.image_url) ? 'array' : 'string'

  return {
    resolvedImageUrls,
    preview: {
      method: 'POST',
      url: resolveZhipuCreateUrl(input.model.endpoint),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ***',
      },
      body,
      context: {
        modelName: input.model.name || input.model.model || '智谱 CogVideoX',
        modelId: input.model.model || '',
        shotNumber: input.shotNumber,
        referenceMode: input.referenceMode,
        referenceModeLabel: input.referenceModeLabel,
        durationSec: input.durationSec,
        aspectRatio: input.aspectRatio,
        resolution: input.resolution,
        referenceImagePaths: resolvedImageUrls.length ? undefined : input.referenceImagePaths,
        referenceImageItems: input.referenceImageItems?.length ? input.referenceImageItems : undefined,
        referenceNote: needsReferenceImage
          ? resolvedImageUrls.length
            ? `已上传 ${resolvedImageUrls.length} 张参考图；create body 含 image_url（${imageUrlType}）。` +
              ' 轮询 GET /async-result/{id} 仅返回 task_status，不会回显 image_url，请以下方 POST body 为准。'
            : '未找到有效参考图，无法图生视频'
          : '文生视频模式，不传 image_url',
        batchCount: input.batchCount,
      },
    },
  }
}

export async function createZhipuVideoTask(
  input: ZhipuVideoCreateInput,
  abortSignal?: AbortSignal,
): Promise<{ taskId: string; raw: Record<string, unknown> }> {
  assertNotAborted(abortSignal)
  const url = resolveZhipuCreateUrl(input.endpoint)
  const body = await buildZhipuCreateBody(input)

  if (typeof window !== 'undefined') {
    ;(window as unknown as { __LC_LAST_ZHIPU_VIDEO_CREATE__?: unknown }).__LC_LAST_ZHIPU_VIDEO_CREATE__ =
      {
        url,
        body,
        hasImageUrl: Boolean(body.image_url),
      }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: mergeFetchSignal(abortSignal, 120_000),
  })

  const text = await response.text()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`智谱视频创建失败 (${response.status})：${text.slice(0, 200)}`)
  }

  if (!response.ok) {
    const msg =
      (data.error as { message?: string } | undefined)?.message ||
      (data.message as string) ||
      text.slice(0, 200)
    throw new Error(`智谱视频创建失败 (${response.status})：${msg}`)
  }

  const taskId = extractTaskId(data)
  if (!taskId) throw new Error('智谱视频 API 未返回任务 ID')
  return { taskId, raw: data }
}

export async function pollZhipuVideoTask(
  apiKey: string,
  taskId: string,
  endpoint?: string,
  onProgress?: VideoProgressCallback,
  abortSignal?: AbortSignal,
): Promise<ZhipuVideoPollResult> {
  const url = resolveZhipuPollUrl(apiKey, taskId, endpoint)
  const start = Date.now()
  let pollRound = 0

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    assertNotAborted(abortSignal)
    pollRound += 1
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: mergeFetchSignal(abortSignal, 60_000),
    })
    const data = (await response.json()) as Record<string, unknown>
    const { status, progress, error } = parseVideoPollPayload(data)
    const videoUrl = extractVideoUrl(data)

    onProgress?.(formatVideoTaskProgress(status, progress, pollRound))

    if (isVideoTaskSuccess(status) && videoUrl) {
      onProgress?.(VIDEO_PROGRESS_COMPLETED)
      return { success: true, videoUrl }
    }
    if (isVideoTaskFailed(status)) {
      return { success: false, error: error || '视频生成失败' }
    }

    await delayWithAbort(VIDEO_POLL_INTERVAL_MS, abortSignal)
  }

  return { success: false, timeout: true, error: '视频生成超时' }
}

export async function generateZhipuVideo(
  input: ZhipuVideoCreateInput,
  onProgress?: VideoProgressCallback,
  callbacks?: {
    onRemoteJobCreated?: (payload: { apiTaskId: string; createUrl?: string }) => void | Promise<void>
  },
  abortSignal?: AbortSignal,
): Promise<string> {
  assertNotAborted(abortSignal)
  onProgress?.(VIDEO_PROGRESS_CREATING)
  const { taskId } = await createZhipuVideoTask(input, abortSignal)
  if (callbacks?.onRemoteJobCreated) {
    await callbacks.onRemoteJobCreated({
      apiTaskId: taskId,
      createUrl: input.endpoint,
    })
  }
  onProgress?.(VIDEO_PROGRESS_SUBMITTED)
  const result = await pollZhipuVideoTask(
    input.apiKey,
    taskId,
    input.endpoint,
    onProgress,
    abortSignal,
  )
  if (!result.success || !result.videoUrl) {
    throw new Error(result.error || '视频生成失败')
  }
  return result.videoUrl
}
