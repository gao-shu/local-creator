// Copyright (c) haode-ai-client. All rights reserved.

/**
 * xAI Grok Imagine Video 客户端
 * 官方文档：
 * - https://docs.x.ai/developers/rest-api-reference/inference/videos
 * - POST /v1/videos/generations（创建）
 * - GET  /v1/videos/{request_id}（查询）
 * - POST /v1/videos/edits（编辑）
 * - POST /v1/videos/extensions（延长）
 */

import type { ModelConfig } from '@/types/settings'
import type { WeishiVideoRequestPreview } from '@/lib/models/weishi-video-client'
import { normalizeApiBase, resolveOpenAiPath } from '@/lib/models/model-endpoint'
import {
  pickFirstDuration,
  pickFirstRatio,
  pickFirstResolution,
} from '@/lib/models/video-model-utils'
import {
  EXTERNAL_VIDEO_MULTIMODAL_MAX_IMAGES,
  pickExternalVideoReferencePaths,
} from '@/lib/video/video-api-reference'
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
  VIDEO_PROGRESS_WAITING_CONTENT,
  VIDEO_PROGRESS_DOWNLOADING,
  type VideoProgressCallback,
} from '@/lib/video/video-progress'
import type { VideoReferenceMode } from '@/lib/workflow/storyboard-video-presets'
import type { ShotVideoReferenceKind } from '@/lib/workflow/shot-video-utils'
import { readStoredMediaAsDataUrl } from '@/lib/storage/fs-service'
import {
  buildApiVideoContentPath,
  resolveAbsoluteApiMediaUrlFromBases,
} from '@/lib/video/video-content-download'
import { VIDEO_POLL_INTERVAL_MS } from '@/constants/batch-concurrency'

const POLL_TIMEOUT_MS = 30 * 60 * 1000

const GROK_ASPECT_RATIOS = new Set([
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
])

export interface GrokVideoCreateInput {
  model: ModelConfig
  prompt: string
  durationSec?: number
  aspectRatio?: string
  resolution?: string
  /** 已解析的参考图 URL / data URI（优先） */
  resolvedImageUrls?: string[]
  referenceMode?: VideoReferenceMode
  referenceImageItems?: Array<{
    path: string
    kind?: ShotVideoReferenceKind
    label?: string
  }>
  referenceImagePaths?: string[]
  referenceImagePath?: string | null
  projectRoot?: string
  apiBaseUrl?: string
}

export function isGrokVideoModel(
  model?: Pick<ModelConfig, 'apiFormat' | 'model' | 'name' | 'endpoint' | 'baseUrl'> | null,
): boolean {
  if (!model) return false
  const fmt = String(model.apiFormat || '')
    .trim()
    .toLowerCase()
  // 用户显式选 OpenAI 兼容时，勿因模型名含 grok 劫持路由（中转 done 返回相对 /content）
  if (fmt === 'openai' || fmt === 'openai_videos' || fmt === 'openai_compatible') {
    return false
  }
  if (fmt === 'grok') return true

  const id = `${model.model || ''} ${model.name || ''}`.toLowerCase()
  if (id.includes('grok-imagine-video')) return true

  const ep = `${model.endpoint || ''} ${model.baseUrl || ''}`.toLowerCase()
  if (ep.includes('api.x.ai') && /\/videos(\/|$)/.test(ep)) return true
  return false
}

export function supportsGrok1080p(modelId?: string): boolean {
  return /1\.5/i.test(String(modelId || ''))
}

/**
 * 是否支持 reference_images（R2V）。
 * 官方文档字段对 grok-imagine-video 族开放；中转站短 ID（无 1.5）亦可透传，勿再硬拦。
 * @see https://docs.x.ai/developers/rest-api-reference/inference/videos
 */
export function supportsGrokReferenceImages(modelId?: string): boolean {
  const id = String(modelId || '').trim().toLowerCase()
  if (!id) return true
  // 明确的非视频 / 旧图模不走 R2V
  if (id.includes('grok-2-image') || id.includes('grok-imagine-image')) return false
  return true
}

/** 规范为官方 480p | 720p | 1080p */
export function normalizeGrokResolution(resolution?: string): '480p' | '720p' | '1080p' | undefined {
  const raw = String(resolution || '')
    .trim()
    .toLowerCase()
  if (!raw) return undefined
  if (raw.includes('1080')) return '1080p'
  if (raw.includes('720')) return '720p'
  if (raw.includes('480') || raw.includes('360')) return '480p'
  return undefined
}

export function normalizeGrokAspectRatio(ratio?: string): string | undefined {
  const value = String(ratio || '').trim()
  if (!value) return undefined
  if (GROK_ASPECT_RATIOS.has(value)) return value
  return value
}

export function clampGrokDurationSec(durationSec?: number): number {
  const n = Number(durationSec)
  if (!Number.isFinite(n) || n <= 0) return 8
  return Math.min(15, Math.max(1, Math.round(n)))
}

/**
 * 创建 URL：POST /v1/videos/generations
 * 用户可填根域名（如 https://sub.xlcsh.top）或完整路径。
 */
export function resolveGrokVideoCreateUrl(
  model: Pick<ModelConfig, 'endpoint' | 'baseUrl' | 'autoAppendV1'>,
): string {
  const endpoint = normalizeApiBase(model.endpoint)
  if (/\/videos\/generations$/i.test(endpoint)) return endpoint

  const root = endpoint || normalizeApiBase(model.baseUrl)
  if (!root) return ''

  if (/\/videos\/generations$/i.test(root)) return root

  const autoAppendV1 = model.autoAppendV1 !== false
  return resolveOpenAiPath(root, '/videos/generations', autoAppendV1)
}

/**
 * 查询 URL：GET /v1/videos/{request_id}
 * （与 generations 同级，不是 /videos/generations/{id}）
 */
export function resolveGrokVideoPollUrl(createUrl: string, requestId: string): string {
  const base = normalizeApiBase(createUrl)
  const id = encodeURIComponent(requestId)
  if (/\/videos\/generations$/i.test(base)) {
    return `${base.replace(/\/generations$/i, '')}/${id}`
  }
  if (/\/videos$/i.test(base)) {
    return `${base}/${id}`
  }
  try {
    const u = new URL(base)
    const v1 = u.pathname.toLowerCase().indexOf('/v1')
    if (v1 >= 0) {
      u.pathname = `${u.pathname.slice(0, v1 + 3)}/videos/${id}`
      return u.toString().replace(/\/+$/, '')
    }
    u.pathname = '/v1/videos/' + id
    return u.toString().replace(/\/+$/, '')
  } catch {
    return `${base}/videos/${id}`
  }
}

export function resolveGrokVideoEditUrl(
  model: Pick<ModelConfig, 'endpoint' | 'baseUrl' | 'autoAppendV1'>,
): string {
  const createUrl = resolveGrokVideoCreateUrl(model)
  if (!createUrl) return ''
  return createUrl.replace(/\/videos\/generations$/i, '/videos/edits')
}

export function resolveGrokVideoExtensionUrl(
  model: Pick<ModelConfig, 'endpoint' | 'baseUrl' | 'autoAppendV1'>,
): string {
  const createUrl = resolveGrokVideoCreateUrl(model)
  if (!createUrl) return ''
  return createUrl.replace(/\/videos\/generations$/i, '/videos/extensions')
}

async function resolveGrokImageSource(
  imagePath: string,
  projectRoot?: string,
): Promise<string> {
  const trimmed = String(imagePath || '').trim()
  if (!trimmed) throw new Error('缺少参考图')
  if (trimmed.startsWith('data:')) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const dataUrl = await readStoredMediaAsDataUrl(trimmed, projectRoot)
  if (dataUrl?.startsWith('data:')) return dataUrl
  throw new Error('无法读取参考图为 data URI，请确认文件存在')
}

/** 本地路径 → data URI / https（不强制上传漫创后台） */
export async function prepareGrokReferenceImageUrls(options: {
  referenceMode?: VideoReferenceMode
  referenceImageItems?: Array<{ path: string; kind?: ShotVideoReferenceKind; label?: string }>
  referenceImagePaths?: string[]
  referenceImagePath?: string | null
  projectRoot?: string
  abortSignal?: AbortSignal
}): Promise<string[]> {
  const referenceMode = options.referenceMode ?? 'first_frame'
  const fallbackPaths =
    options.referenceImagePaths?.length
      ? options.referenceImagePaths
      : options.referenceImagePath
        ? [options.referenceImagePath]
        : []

  const selected = pickExternalVideoReferencePaths({
    mode: referenceMode,
    items: options.referenceImageItems,
    paths: fallbackPaths,
  })
  if (!selected.length) return []

  const urls: string[] = []
  for (const path of selected) {
    assertNotAborted(options.abortSignal)
    const url = await resolveGrokImageSource(path, options.projectRoot)
    if (url && !urls.includes(url)) urls.push(url)
  }
  return urls
}

export function buildGrokVideoCreateBody(input: {
  modelId: string
  prompt: string
  durationSec?: number
  aspectRatio?: string
  resolution?: string
  referenceMode?: VideoReferenceMode
  imageUrls?: string[]
}): Record<string, unknown> {
  const modelId = String(input.modelId || '').trim()
  const body: Record<string, unknown> = {
    model: modelId,
    prompt: String(input.prompt || '').trim(),
  }

  body.duration = clampGrokDurationSec(input.durationSec)

  const ratio = normalizeGrokAspectRatio(input.aspectRatio)
  if (ratio) body.aspect_ratio = ratio

  const resolution = normalizeGrokResolution(input.resolution)
  if (resolution === '1080p' && !supportsGrok1080p(modelId)) {
    throw new Error('Grok 1080p 仅支持 grok-imagine-video-1.5；请改用 480p / 720p，或更换型号。')
  }
  if (resolution) body.resolution = resolution

  const urls = (input.imageUrls ?? []).map((u) => String(u || '').trim()).filter(Boolean)
  const mode = input.referenceMode ?? 'first_frame'

  if (mode === 'text_to_video' || !urls.length) {
    return body
  }

  // I2V：image.url；R2V：reference_images[{url}]（互斥，勿混传）
  // 全能多参 / 多图：一律 R2V（中转 grok-imagine-video 短 ID 也支持，不再限 1.5）
  if (mode === 'multimodal' || urls.length >= 2) {
    if (!supportsGrokReferenceImages(modelId)) {
      body.image = { url: urls[0] }
      return body
    }
    const capped = urls.slice(0, EXTERNAL_VIDEO_MULTIMODAL_MAX_IMAGES)
    body.reference_images = capped.map((url) => ({ url }))
    return body
  }

  // 首帧单图 I2V
  body.image = { url: urls[0] }
  return body
}

/** POST /v1/videos/edits */
export function buildGrokVideoEditBody(input: {
  modelId: string
  prompt: string
  videoUrl: string
}): Record<string, unknown> {
  return {
    model: String(input.modelId || '').trim(),
    prompt: String(input.prompt || '').trim(),
    video: { url: String(input.videoUrl || '').trim() },
  }
}

/** POST /v1/videos/extensions */
export function buildGrokVideoExtensionBody(input: {
  modelId: string
  prompt: string
  videoUrl: string
  durationSec?: number
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: String(input.modelId || '').trim(),
    prompt: String(input.prompt || '').trim(),
    video: { url: String(input.videoUrl || '').trim() },
  }
  if (input.durationSec != null && Number.isFinite(input.durationSec)) {
    const d = Math.min(10, Math.max(2, Math.round(input.durationSec)))
    body.duration = d
  }
  return body
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`Grok 视频 API 响应解析失败 (${response.status})：${text.slice(0, 200)}`)
  }
}

function extractApiErrorMessage(data: Record<string, unknown>, fallback: string): string {
  const errObj = data.error as { message?: string; code?: string } | string | undefined
  if (typeof errObj === 'string' && errObj.trim()) return errObj.trim()
  if (typeof errObj === 'object' && errObj?.message) {
    const code = errObj.code ? ` (${errObj.code})` : ''
    return `${errObj.message}${code}`
  }
  const msg = String(data.message || '').trim()
  if (msg) return msg
  return fallback
}

function extractRequestId(data: Record<string, unknown>): string {
  return String(
    data.request_id ||
      data.id ||
      data.task_id ||
      data.video_id ||
      (data.data as { request_id?: string; id?: string } | undefined)?.request_id ||
      (data.data as { id?: string } | undefined)?.id ||
      '',
  ).trim()
}

function extractGrokVideoUrl(
  data: Record<string, unknown>,
  options?: { createUrl?: string; requestId?: string; pollUrl?: string },
): string {
  const video = data.video as
    | { url?: string | null; respect_moderation?: boolean }
    | undefined
  if (video && video.respect_moderation === false && !video.url) {
    throw new Error('视频未通过内容审核（respect_moderation=false）')
  }

  let raw =
    (video?.url && String(video.url).trim()) ||
    (() => {
      const nested = data.data as Record<string, unknown> | undefined
      const nestedVideo = nested?.video as { url?: string } | undefined
      if (nestedVideo?.url) return String(nestedVideo.url).trim()
      return String(
        data.url ||
          data.video_url ||
          (data.output as { url?: string } | undefined)?.url ||
          nested?.url ||
          '',
      ).trim()
    })()

  // 中转：status=done 但只给相对 /content，或完全缺 url 时按 request_id 合成
  if (!raw && options?.requestId) {
    raw = buildApiVideoContentPath(options.requestId)
  }

  if (!raw) return ''

  // createUrl / pollUrl 都能提供 origin；相对 /content 必须拼成绝对地址才能下载
  return resolveAbsoluteApiMediaUrlFromBases(raw, [options?.createUrl, options?.pollUrl])
}

async function postGrokVideoRequest(options: {
  url: string
  apiKey: string
  body: Record<string, unknown>
  abortSignal?: AbortSignal
  actionLabel: string
}): Promise<{ requestId: string; rawData: Record<string, unknown> }> {
  assertNotAborted(options.abortSignal)
  const response = await fetch(options.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(options.body),
    signal: mergeFetchSignal(options.abortSignal),
  })

  const data = await readJsonResponse(response)
  if (!response.ok) {
    throw new Error(
      `${options.actionLabel}失败 (${response.status})：${extractApiErrorMessage(data, response.statusText)}`,
    )
  }

  const requestId = extractRequestId(data)
  if (!requestId) {
    throw new Error(`${options.actionLabel}成功但未返回 request_id`)
  }
  return { requestId, rawData: data }
}

export async function createGrokVideoTask(
  input: GrokVideoCreateInput,
  abortSignal?: AbortSignal,
): Promise<{ requestId: string; createUrl: string; rawData: Record<string, unknown> }> {
  const apiKey = String(input.model.apiKey || '').trim()
  if (!apiKey) throw new Error(`模型「${input.model.name}」未配置 API Key`)

  const createUrl = resolveGrokVideoCreateUrl(input.model)
  if (!createUrl) throw new Error(`模型「${input.model.name}」未配置 API 地址`)

  let resolvedUrls = input.resolvedImageUrls?.map((u) => u.trim()).filter(Boolean) ?? []
  if (!resolvedUrls.length) {
    resolvedUrls = await prepareGrokReferenceImageUrls({
      referenceMode: input.referenceMode,
      referenceImageItems: input.referenceImageItems,
      referenceImagePaths: input.referenceImagePaths,
      referenceImagePath: input.referenceImagePath,
      projectRoot: input.projectRoot,
      abortSignal,
    })
  }

  const body = buildGrokVideoCreateBody({
    modelId: input.model.model,
    prompt: input.prompt,
    durationSec: input.durationSec ?? pickFirstDuration(input.model),
    aspectRatio: input.aspectRatio ?? pickFirstRatio(input.model),
    resolution: input.resolution ?? pickFirstResolution(input.model),
    referenceMode: input.referenceMode,
    imageUrls: resolvedUrls,
  })

  const { requestId, rawData } = await postGrokVideoRequest({
    url: createUrl,
    apiKey,
    body,
    abortSignal,
    actionLabel: '视频创建',
  })

  return { requestId, createUrl, rawData }
}

export async function createGrokVideoEditTask(input: {
  model: ModelConfig
  prompt: string
  videoUrl: string
  abortSignal?: AbortSignal
}): Promise<{ requestId: string; createUrl: string }> {
  const apiKey = String(input.model.apiKey || '').trim()
  if (!apiKey) throw new Error(`模型「${input.model.name}」未配置 API Key`)
  const createUrl = resolveGrokVideoEditUrl(input.model)
  if (!createUrl) throw new Error(`模型「${input.model.name}」未配置 API 地址`)
  if (!input.videoUrl.trim()) throw new Error('视频编辑缺少源视频 URL')

  const { requestId } = await postGrokVideoRequest({
    url: createUrl,
    apiKey,
    body: buildGrokVideoEditBody({
      modelId: input.model.model,
      prompt: input.prompt,
      videoUrl: input.videoUrl,
    }),
    abortSignal: input.abortSignal,
    actionLabel: '视频编辑',
  })
  return { requestId, createUrl }
}

export async function createGrokVideoExtensionTask(input: {
  model: ModelConfig
  prompt: string
  videoUrl: string
  durationSec?: number
  abortSignal?: AbortSignal
}): Promise<{ requestId: string; createUrl: string }> {
  const apiKey = String(input.model.apiKey || '').trim()
  if (!apiKey) throw new Error(`模型「${input.model.name}」未配置 API Key`)
  const createUrl = resolveGrokVideoExtensionUrl(input.model)
  if (!createUrl) throw new Error(`模型「${input.model.name}」未配置 API 地址`)
  if (!input.videoUrl.trim()) throw new Error('视频延长缺少源视频 URL')

  const { requestId } = await postGrokVideoRequest({
    url: createUrl,
    apiKey,
    body: buildGrokVideoExtensionBody({
      modelId: input.model.model,
      prompt: input.prompt,
      videoUrl: input.videoUrl,
      durationSec: input.durationSec,
    }),
    abortSignal: input.abortSignal,
    actionLabel: '视频延长',
  })
  return { requestId, createUrl }
}

export async function pollGrokVideoTask(
  apiKey: string,
  createUrl: string,
  requestId: string,
  onProgress?: VideoProgressCallback,
  abortSignal?: AbortSignal,
): Promise<string> {
  const pollUrl = resolveGrokVideoPollUrl(createUrl, requestId)
  const start = Date.now()
  const deadline = start + POLL_TIMEOUT_MS
  let waitingContentRounds = 0

  while (Date.now() < deadline) {
    assertNotAborted(abortSignal)
    const response = await fetch(pollUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: mergeFetchSignal(abortSignal),
    })
    const data = await readJsonResponse(response)
    if (!response.ok) {
      throw new Error(
        `视频查询失败 (${response.status})：${extractApiErrorMessage(data, response.statusText)}`,
      )
    }

    const parsed = parseVideoPollPayload(data)
    const status = parsed.status || String(data.status || '')
    const statusKey = status.toLowerCase()

    if (statusKey === 'expired') {
      throw new Error('视频任务已过期（expired），请重新生成')
    }

    if (isVideoTaskFailed(status) || parsed.error) {
      throw new Error(parsed.error || `视频生成失败（${status || 'failed'}）`)
    }

    if (isVideoTaskSuccess(status) || statusKey === 'done') {
      const videoUrl = extractGrokVideoUrl(data, { createUrl, requestId, pollUrl })
      if (videoUrl) {
        onProgress?.(VIDEO_PROGRESS_DOWNLOADING)
        return videoUrl
      }
      waitingContentRounds += 1
      const rawHint = String(
        (data.video as { url?: string } | undefined)?.url || data.url || '',
      ).trim()
      const waitedSec = Math.max(0, Math.round((Date.now() - start) / 1000))
      onProgress?.({
        ...VIDEO_PROGRESS_WAITING_CONTENT,
        message: rawHint
          ? `成片地址解析中…（已等 ${waitedSec}s）`
          : `生成完成，等待成片地址…（已等 ${waitedSec}s）`,
      })
      if (rawHint && waitingContentRounds >= 3) {
        throw new Error(
          `成片地址无法下载（相对路径：${rawHint.slice(0, 80)}）。请检查视频模型 API 地址是否完整（需含 https 域名）。`,
        )
      }
      if (!rawHint && waitingContentRounds >= 15) {
        throw new Error('远端已完成但未返回成片地址，请稍后重试或重新生成')
      }
    } else {
      waitingContentRounds = 0
      onProgress?.(formatVideoTaskProgress(status || 'pending', parsed.progress))
    }
    await delayWithAbort(VIDEO_POLL_INTERVAL_MS, abortSignal)
  }

  throw new Error('视频生成超时，请稍后在任务列表重试或重新生成')
}

export async function generateGrokVideo(
  input: GrokVideoCreateInput,
  onProgress?: VideoProgressCallback,
  options?: {
    onRemoteJobCreated?: (payload: { apiTaskId: string; createUrl: string }) => void | Promise<void>
  },
  abortSignal?: AbortSignal,
): Promise<string> {
  onProgress?.(VIDEO_PROGRESS_CREATING)
  const { requestId, createUrl } = await createGrokVideoTask(input, abortSignal)
  onProgress?.(VIDEO_PROGRESS_SUBMITTED)
  await options?.onRemoteJobCreated?.({ apiTaskId: requestId, createUrl })
  return pollGrokVideoTask(
    String(input.model.apiKey || '').trim(),
    createUrl,
    requestId,
    onProgress,
    abortSignal,
  )
}

export async function prepareGrokVideoRequestPreview(
  input: GrokVideoCreateInput & {
    referenceModeLabel?: string
    shotNumber?: number
    batchCount?: number
  },
  onProgress?: VideoProgressCallback,
): Promise<{ preview: WeishiVideoRequestPreview; resolvedImageUrls: string[] }> {
  const referenceMode = input.referenceMode ?? 'first_frame'
  const needsReferenceImage = referenceMode !== 'text_to_video'

  let resolvedImageUrls = input.resolvedImageUrls?.map((u) => u.trim()).filter(Boolean) ?? []
  if (needsReferenceImage && !resolvedImageUrls.length) {
    onProgress?.({ message: '读取参考图…', status: 'running' })
    resolvedImageUrls = await prepareGrokReferenceImageUrls({
      referenceMode,
      referenceImageItems: input.referenceImageItems,
      referenceImagePaths: input.referenceImagePaths,
      referenceImagePath: input.referenceImagePath,
      projectRoot: input.projectRoot,
    })
  }

  const body = buildGrokVideoCreateBody({
    modelId: input.model.model,
    prompt: input.prompt,
    durationSec: input.durationSec ?? pickFirstDuration(input.model),
    aspectRatio: input.aspectRatio ?? pickFirstRatio(input.model),
    resolution: input.resolution ?? pickFirstResolution(input.model),
    referenceMode,
    imageUrls: resolvedImageUrls,
  })

  const createUrl = resolveGrokVideoCreateUrl(input.model)

  return {
    resolvedImageUrls,
    preview: {
      method: 'POST',
      url: createUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ***',
      },
      body,
      context: {
        modelName: input.model.name || input.model.model || 'Grok Imagine Video',
        modelId: input.model.model || '',
        shotNumber: input.shotNumber,
        referenceMode: input.referenceMode,
        referenceModeLabel: input.referenceModeLabel,
        batchCount: input.batchCount,
        referenceNote: needsReferenceImage
          ? '参考图以 data URI / https 写入 image.url 或 reference_images'
          : undefined,
      },
    },
  }
}
