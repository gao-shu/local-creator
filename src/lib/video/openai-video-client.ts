// Copyright (c) local-creator contributors. All rights reserved.

import type { ModelConfig } from '@/types/settings'
import type { VideoRequestPreview } from '@/lib/video/video-request-preview'
import {
  pickFirstDuration,
  pickFirstRatio,
  pickFirstResolution,
  resolveVideoCreateUrl,
} from '@/lib/models/video-model-utils'
import { isZhipuVideoModel } from '@/lib/video/zhipu-video-client'
import { pickRemoteImageUrlForVideoApi } from '@/lib/video/remote-image-url'
import { buildOpenAiVideoImageParams } from '@/lib/video/video-api-reference'
import { prepareExternalVideoReferenceUrls } from '@/lib/video/video-provider'
import { resolveVideoApiImageUrl } from '@/lib/video/video-media-resolve'
import { normalizeGrokResolution } from '@/lib/video/grok-video-client'
import type { VideoReferenceMode } from '@/lib/workflow/storyboard-video-presets'
import type { ShotVideoReferenceKind } from '@/lib/workflow/shot-video-utils'
import {
  assertNotAborted,
  delayWithAbort,
  mergeFetchSignal,
} from '@/lib/video/video-generation-abort'
import {
  buildApiVideoContentPath,
  extractVideoIdFromApiContentUrl,
  looksLikeOpenAiStyleVideoId,
  resolveAbsoluteApiMediaUrl,
  resolveAbsoluteApiMediaUrlFromBases,
  resolveApiOriginVideoContentUrl,
} from '@/lib/video/video-content-download'
import {
  formatVideoTaskProgress,
  isVideoTaskFailed,
  isVideoTaskSuccess,
  parseVideoPollPayload,
  VIDEO_PROGRESS_CREATING,
  VIDEO_PROGRESS_SUBMITTED,
  VIDEO_PROGRESS_UPLOADING,
  VIDEO_PROGRESS_WAITING_CONTENT,
  VIDEO_PROGRESS_DOWNLOADING,
  type VideoProgressCallback,
} from '@/lib/video/video-progress'
import { VIDEO_POLL_INTERVAL_MS } from '@/constants/batch-concurrency'

const POLL_TIMEOUT_MS = 30 * 60 * 1000

/** Agnes Video V2.0（apihub.agnes-ai.com）使用独立参数字段，勿混用 duration/ratio/input_reference */
export function isAgnesVideoModel(
  model?: Pick<ModelConfig, 'model' | 'endpoint' | 'baseUrl' | 'name' | 'apiFormat'> | null,
): boolean {
  // Agnes Video 2.5 / Flash 走独立客户端（/v1/videos + /agnesapi）
  const apiFormat = String(model?.apiFormat || '')
    .trim()
    .toLowerCase()
  if (apiFormat === 'agnes_video_25' || apiFormat === 'agnes_video_25_flash') return false
  const modelId = String(model?.model || '').trim().toLowerCase()
  const name = String(model?.name || '').trim().toLowerCase()
  if (modelId.includes('agnes-video-2.5') || name.includes('agnes video 2.5')) return false

  const endpoint = String(model?.endpoint || model?.baseUrl || '')
    .trim()
    .toLowerCase()
  return (
    modelId.includes('agnes-video') ||
    name.includes('agnes') ||
    endpoint.includes('agnes-ai.com') ||
    endpoint.includes('agnes-ai.space') ||
    endpoint.includes('agnes-ai.cn')
  )
}

/**
 * LiteLLM 会把真实 video_id + provider 编进 `video_xxx`（base64 载荷含 litellm:）。
 * 仅 LiteLLM 中转轮询时需要；Agnes 直连 apihub 用该 id 会 400。
 */
export function isLiteLlmEncodedVideoId(value?: string | null): boolean {
  const id = String(value || '').trim()
  if (!/^video_[A-Za-z0-9+/=_-]+$/i.test(id)) return false
  const payload = id.slice('video_'.length)
  try {
    const decoded = decodeLiteLlmVideoIdPayload(payload)
    return /litellm:/i.test(decoded)
  } catch {
    return false
  }
}

function decodeLiteLlmVideoIdPayload(base64Payload: string): string {
  const payload = String(base64Payload || '').trim()
  if (!payload) return ''
  return typeof atob === 'function'
    ? atob(payload)
    : Buffer.from(payload, 'base64').toString('utf8')
}

/** 从 LiteLLM 编码 video_id 解出 Agnes 原生短 id（video_45e8047e…） */
export function extractNativeVideoIdFromLiteLlmEncoded(value?: string | null): string {
  const encoded = String(value || '').trim()
  if (!isLiteLlmEncodedVideoId(encoded)) return ''
  try {
    const decoded = decodeLiteLlmVideoIdPayload(encoded.slice('video_'.length))
    const match = decoded.match(/video_id:(video_[A-Za-z0-9]+)/i)
    return match?.[1]?.trim() || ''
  } catch {
    return ''
  }
}

function buildAgnesPlatformOutputUrl(model: string, nativeVideoId: string): string {
  const modelName = String(model || '').trim()
  const videoId = String(nativeVideoId || '').trim()
  if (!modelName || !looksLikeOpenAiStyleVideoId(videoId)) return ''
  return `https://platform-outputs.agnes-ai.space/videos/${encodeURIComponent(modelName)}/${encodeURIComponent(videoId)}.mp4`
}

async function fetchOpenAiVideoPollPayload(
  pollUrl: string,
  apiKey: string,
  abortSignal?: AbortSignal,
): Promise<Record<string, unknown>> {
  // 不加 ?_= 时间戳：部分中转对多余 query 敏感，可能导致状态不全、迟迟不给成片地址
  const response = await fetch(pollUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    cache: 'no-store',
    signal: mergeFetchSignal(abortSignal, 60_000),
  })
  return readJsonResponse(response)
}

/** Agnes 官方 apihub / platform 直连（非 LiteLLM 中转） */
export function isAgnesDirectVideoApi(url?: string | null): boolean {
  const raw = String(url || '').trim().toLowerCase()
  if (!raw) return false
  try {
    const host = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname
    return /(^|\.)agnes-ai\.(com|cn|space)$/.test(host) || host.includes('apihub.agnes')
  } catch {
    return (
      raw.includes('agnes-ai.com') ||
      raw.includes('agnes-ai.cn') ||
      raw.includes('agnes-ai.space') ||
      raw.includes('apihub.agnes')
    )
  }
}

export function extractOpenAiVideoPollTaskId(
  data: Record<string, unknown>,
  options?: { createUrl?: string },
): string {
  const nested = data.data as { id?: string; task_id?: string; video_id?: string } | undefined
  const videoId = String(data.video_id || nested?.video_id || '').trim()
  const taskLikeId = String(
    data.id || data.task_id || data.request_id || nested?.id || nested?.task_id || '',
  ).trim()
  const createUrl = String(options?.createUrl || '').trim()

  // Agnes 直连：必须用 task_xxx（或原生短 video_xxx），LiteLLM 编码 id 会 400
  if (isAgnesDirectVideoApi(createUrl)) {
    if (taskLikeId) return taskLikeId
    if (videoId && !isLiteLlmEncodedVideoId(videoId)) return videoId
    return videoId
  }

  // LiteLLM 中转：编码 video_id 才能 retrieve 到上游状态
  if (isLiteLlmEncodedVideoId(videoId)) return videoId
  return taskLikeId || videoId
}

function normalizeVideoResolutionHeight(resolution?: string): number {
  const digits = String(resolution || '')
    .replace(/[^\d]/g, '')
    .trim()
  const height = Number(digits)
  if (height === 1080 || height === 720 || height === 480) return height
  return 720
}

function resolveAgnesVideoDimensions(
  aspectRatio: string,
  resolution?: string,
): { width: number; height: number } {
  const height = normalizeVideoResolutionHeight(resolution)
  const ratio = aspectRatio.trim() || '16:9'
  if (ratio === '9:16' || ratio === '3:4' || ratio === '2:3') {
    return { width: Math.round((height * 9) / 16), height }
  }
  return { width: Math.round((height * 16) / 9), height }
}

/** Agnes 要求 num_frames 为 8n+1 且 <= 441 */
function resolveAgnesNumFrames(durationSec: number, frameRate = 24): number {
  const target = Math.max(9, Math.round(durationSec * frameRate))
  const n = Math.max(1, Math.round((target - 1) / 8))
  return Math.min(441, 8 * n + 1)
}

export function buildAgnesVideoCreateBody(input: {
  model: ModelConfig
  prompt: string
  durationSec?: number
  aspectRatio?: string
  resolution?: string
  referenceMode?: VideoReferenceMode
  resolvedUrls: string[]
}): Record<string, unknown> {
  const durationSec = input.durationSec ?? pickFirstDuration(input.model)
  const aspectRatio = input.aspectRatio ?? pickFirstRatio(input.model)
  const resolution = input.resolution ?? pickFirstResolution(input.model)
  const { width, height } = resolveAgnesVideoDimensions(aspectRatio, resolution)
  const frameRate = 24
  const urls = input.resolvedUrls.map((u) => u.trim()).filter(Boolean)

  const body: Record<string, unknown> = {
    model: input.model.model,
    prompt: input.prompt.trim(),
    width,
    height,
    num_frames: resolveAgnesNumFrames(durationSec, frameRate),
    frame_rate: frameRate,
  }

  if (urls.length >= 2 && input.referenceMode === 'first_last_frame') {
    body.extra_body = { image: urls.slice(0, 2), mode: 'keyframes' }
    return body
  }
  if (urls.length > 1) {
    body.extra_body = { image: urls }
    return body
  }
  if (urls.length === 1) {
    body.image = urls[0]
  }
  return body
}

export interface OpenAiVideoCreateInput {
  model: ModelConfig
  prompt: string
  durationSec?: number
  aspectRatio?: string
  resolution?: string
  imageUrl?: string | null
  imageUrls?: string[]
  resolvedImageUrls?: string[]
  referenceMode?: VideoReferenceMode
  projectRoot?: string
  apiBaseUrl?: string
}

export function isOpenAiCompatibleVideoModel(
  model?: Pick<ModelConfig, 'apiFormat' | 'platform' | 'endpoint'> | null,
): boolean {
  const fmt = String(model?.apiFormat || '')
    .trim()
    .toLowerCase()
  if (fmt === 'zhipu' || fmt === 'seedance_2' || fmt === 'grok') return false
  if (fmt === 'agnes_video_25' || fmt === 'agnes_video_25_flash') return false
  if (fmt === 'openai' || fmt === 'openai_videos') return true
  if (model?.platform === 'openai_compatible' && fmt === 'openai') return true
  return false
}

export function shouldUseOpenAiVideoClient(model: ModelConfig): boolean {
  if (!isOpenAiCompatibleVideoModel(model)) return false
  if (isZhipuVideoModel(model.model || '', model.endpoint, model.apiFormat)) return false
  // Grok 专用体由 isGrokVideoModel（apiFormat=grok / 未声明 openai）接管；
  // 用户显式选 openai* 时即使模型名含 grok-imagine-video 也走本客户端
  return Boolean(resolveVideoCreateUrl(model))
}

function extractTaskId(data: Record<string, unknown>, createUrl?: string): string {
  return extractOpenAiVideoPollTaskId(data, { createUrl })
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function pickUrlField(...candidates: unknown[]): string {
  for (const c of candidates) {
    const s = String(c || '').trim()
    if (s) return s
  }
  return ''
}

function extractVideoUrl(data: Record<string, unknown>): string {
  // OpenAI Videos：顶层 url；部分网关把状态放在 data 对象里
  const nested = asRecord(data.data)
  const output = asRecord(data.output) as { video_url?: string; url?: string } | undefined
  const videoObj = asRecord(data.video) as { url?: string } | undefined
  const list =
    (data.video_result as Array<{ url?: string; video_url?: string }> | undefined) ||
    (nested?.video_result as Array<{ url?: string; video_url?: string }> | undefined)
  if (Array.isArray(list) && list.length > 0) {
    return pickUrlField(list[0]?.url, list[0]?.video_url)
  }
  return pickUrlField(
    videoObj?.url,
    data.video_url,
    data.url,
    output?.video_url,
    output?.url,
    nested?.video_url,
    nested?.url,
  )
}

function extractTaskStatus(data: Record<string, unknown>): string {
  const nested = data.data as {
    status?: string
    task_status?: string
    internal_status?: string
  } | undefined
  const status = String(
    data.status || data.task_status || nested?.status || nested?.task_status || '',
  ).trim()
  const internalStatus = String(
    data.internal_status || nested?.internal_status || '',
  ).trim()
  if (isVideoTaskSuccess(internalStatus) && !isVideoTaskSuccess(status)) {
    return internalStatus.toUpperCase()
  }
  return status.toUpperCase()
}

export function resolveVideoPollUrl(createUrl: string, taskId: string): string {
  const base = createUrl.replace(/\/+$/, '')
  if (!taskId) return base
  const id = encodeURIComponent(taskId)
  // POST …/videos 或 …/videos/generations → GET …/videos/{id}
  if (/\/videos\/generations$/i.test(base)) {
    return `${base.replace(/\/generations$/i, '')}/${id}`
  }
  return `${base}/${id}`
}

async function resolveCreateImageUrls(input: OpenAiVideoCreateInput): Promise<string[]> {
  let resolvedUrls = input.resolvedImageUrls?.map((u) => u.trim()).filter(Boolean) ?? []

  if (resolvedUrls.length) return resolvedUrls

  const rawPaths = input.imageUrls?.length
    ? input.imageUrls
    : input.imageUrl?.trim()
      ? [input.imageUrl]
      : []

  for (const [index, rawPath] of rawPaths.entries()) {
    const remoteUrl = pickRemoteImageUrlForVideoApi(rawPath)
    if (remoteUrl) {
      if (!resolvedUrls.includes(remoteUrl)) resolvedUrls.push(remoteUrl)
      continue
    }
    const uploaded = await resolveVideoApiImageUrl(rawPath, {
      apiBaseUrl: input.apiBaseUrl,
      projectRoot: input.projectRoot,
      label: `openai_video_ref_${index + 1}`,
    })
    if (uploaded && !resolvedUrls.includes(uploaded)) resolvedUrls.push(uploaded)
  }

  return resolvedUrls
}

async function buildCreateBody(input: OpenAiVideoCreateInput): Promise<Record<string, unknown>> {
  const resolvedUrls = await resolveCreateImageUrls(input)

  const duration = input.durationSec ?? pickFirstDuration(input.model)
  const ratio = input.aspectRatio ?? pickFirstRatio(input.model)
  let resolution = input.resolution ?? pickFirstResolution(input.model)

  if (isAgnesVideoModel(input.model)) {
    return buildAgnesVideoCreateBody({
      model: input.model,
      prompt: input.prompt,
      durationSec: duration,
      aspectRatio: ratio,
      resolution,
      referenceMode: input.referenceMode,
      resolvedUrls,
    })
  }

  // Grok 中转：resolution 规范为 720p（避免 720P 怪异路由）
  const modelBits = `${input.model.model || ''} ${input.model.name || ''}`.toLowerCase()
  if (modelBits.includes('grok')) {
    resolution = normalizeGrokResolution(resolution) ?? resolution
  }

  // 严格网关（Go DisallowUnknownFields）不认 ratio；与 Grok 中转一致只用 aspect_ratio
  const body: Record<string, unknown> = {
    model: input.model.model,
    prompt: input.prompt.trim(),
    duration,
    aspect_ratio: ratio,
    resolution,
  }

  Object.assign(body, buildOpenAiVideoImageParams(resolvedUrls, input.referenceMode))
  return body
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`视频 API 响应解析失败 (${response.status})：${text.slice(0, 200)}`)
  }
}

function extractApiErrorMessage(data: Record<string, unknown>, fallback: string): string {
  const errObj = data.error as { message?: string } | string | undefined
  if (typeof errObj === 'string' && errObj.trim()) return errObj.trim()
  if (typeof errObj === 'object' && errObj?.message) return errObj.message
  const msg = String(data.message || '').trim()
  if (msg) return msg
  return fallback
}

export async function createOpenAiVideoTask(
  input: OpenAiVideoCreateInput,
  abortSignal?: AbortSignal,
): Promise<{ taskId: string; videoUrl: string; createUrl: string; rawData: Record<string, unknown> }> {
  assertNotAborted(abortSignal)
  const createUrl = resolveVideoCreateUrl(input.model)
  if (!createUrl) throw new Error(`模型「${input.model.name}」未配置 API 地址`)

  const body = await buildCreateBody(input)

  if (typeof window !== 'undefined') {
    ;(window as unknown as { __LC_LAST_OPENAI_VIDEO_CREATE__?: unknown }).__LC_LAST_OPENAI_VIDEO_CREATE__ =
      {
        url: createUrl,
        body,
        provider: 'openai_compatible',
        hasImage: Boolean(
          body.image ||
            body.image_url ||
            body.reference_images ||
            (body.extra_body as { image?: unknown[] } | undefined)?.image?.length,
        ),
      }
  }

  const response = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.model.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: mergeFetchSignal(abortSignal, 120_000),
  })

  const data = await readJsonResponse(response)
  if (!response.ok) {
    throw new Error(
      `视频创建失败 (${response.status})：${extractApiErrorMessage(data, '视频创建失败')}`,
    )
  }

  const code = Number(data.code)
  if (Number.isFinite(code) && code !== 0) {
    throw new Error(extractApiErrorMessage(data, `视频创建失败 (code=${code})`))
  }

  // done 时常给相对 video.url=/v1/videos/{id}/content，且可能无顶层 id
  const rawUrl = String(extractVideoUrl(data) || '').trim()
  const taskId =
    extractTaskId(data, createUrl) || extractVideoIdFromApiContentUrl(rawUrl) || ''

  if (rawUrl) {
    const absolute = resolveAbsoluteApiMediaUrl(createUrl, rawUrl)
    if (absolute.startsWith('http')) {
      const downloadUrl = resolveApiOriginVideoContentUrl({
        contentUrl: absolute,
        apiBaseUrl: createUrl,
        preferredVideoId: taskId,
      })
      return { taskId, videoUrl: downloadUrl, createUrl, rawData: data }
    }
  }

  if (!taskId) throw new Error('视频 API 未返回任务 ID 或视频地址')
  return { taskId, videoUrl: '', createUrl, rawData: data }
}

function resolveOpenAiPollVideoUrl(
  data: Record<string, unknown>,
  createUrl: string,
  taskId: string,
  pollUrl?: string,
): string {
  let raw = String(extractVideoUrl(data) || '').trim()
  const parsed = parseVideoPollPayload(data)
  const success = isVideoTaskSuccess(parsed.status || String(data.status || ''))
  // 无 url 时按本侧任务 id 拼 /content
  if (!raw && taskId && success) {
    const id = String(taskId).trim()
    if (
      looksLikeOpenAiStyleVideoId(id) ||
      /^task_[A-Za-z0-9_-]+$/i.test(id) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      raw = buildApiVideoContentPath(id)
    }
  }
  // Agnes 直连：internal_status=completed 但缺 url 时，用原生 video_id 拼 CDN 地址
  if (!raw && isAgnesDirectVideoApi(createUrl) && success) {
    const model = String(data.model || '').trim()
    const nativeId =
      extractNativeVideoIdFromLiteLlmEncoded(String(data.video_id || '')) ||
      (looksLikeOpenAiStyleVideoId(String(data.video_id || '')) ? String(data.video_id || '').trim() : '')
    raw = buildAgnesPlatformOutputUrl(model, nativeId)
  }
  if (!raw) return ''
  const absolute = resolveAbsoluteApiMediaUrlFromBases(raw, [createUrl, pollUrl])
  if (!absolute) return ''
  // 跨源 …/content 改回配置 API，避免用本侧 Key 打上游 401
  return resolveApiOriginVideoContentUrl({
    contentUrl: absolute,
    apiBaseUrl: createUrl || pollUrl,
    preferredVideoId: taskId,
  })
}

export async function pollOpenAiVideoTask(
  apiKey: string,
  createUrl: string,
  taskId: string,
  onProgress?: VideoProgressCallback,
  abortSignal?: AbortSignal,
): Promise<string> {
  const pollUrl = resolveVideoPollUrl(createUrl, taskId)
  const start = Date.now()
  let pollRound = 0
  let waitingContentRounds = 0

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    assertNotAborted(abortSignal)
    pollRound += 1
    // Agnes 直连只轮询 task_xxx；原生 video_* 不是 apihub 查询 id，勿旁路 GET
    const data = await fetchOpenAiVideoPollPayload(pollUrl, apiKey, abortSignal)
    const { status, progress, error } = parseVideoPollPayload(data)
    const legacyStatus = extractTaskStatus(data)
    const effectiveStatus = status || legacyStatus
    // 中转 done 时常给相对路径 video.url=/v1/videos/{id}/content → 拼成绝对 URL
    const videoUrl = resolveOpenAiPollVideoUrl(data, createUrl, taskId, pollUrl)
    // Agnes/部分中转：status 仍 queued，但已给出可下载 url / internal_status=completed
    const finished =
      !effectiveStatus ||
      isVideoTaskSuccess(effectiveStatus) ||
      (progress != null && progress >= 100) ||
      Boolean(videoUrl)

    if (isVideoTaskFailed(effectiveStatus)) {
      onProgress?.(formatVideoTaskProgress(effectiveStatus, progress, pollRound))
      throw new Error(error || extractApiErrorMessage(data, '视频生成失败'))
    }

    // 已拿到可下载地址：直接进入「正在下载」，勿停在「准备下载」造成卡住假象
    if (finished && videoUrl) {
      onProgress?.(VIDEO_PROGRESS_DOWNLOADING)
      return videoUrl
    }

    // 已完成但相对路径未能拼成绝对地址：有限次重试后明确失败，避免「生成完成」遮罩空转
    if (finished && !videoUrl) {
      waitingContentRounds += 1
      const rawHint = String(extractVideoUrl(data) || '').trim()
      const waitedSec = Math.max(0, Math.round((Date.now() - start) / 1000))
      onProgress?.({
        ...VIDEO_PROGRESS_WAITING_CONTENT,
        message: rawHint
          ? `成片地址解析中…（已等 ${waitedSec}s）`
          : `生成完成，等待成片地址…（已等 ${waitedSec}s）`,
      })
      // 响应里已有 /content 却拼不出 https → 多半是 API 根地址配置问题，勿空等 30 分钟
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
      onProgress?.(formatVideoTaskProgress(effectiveStatus, progress, pollRound))
    }

    await delayWithAbort(VIDEO_POLL_INTERVAL_MS, abortSignal)
  }

  throw new Error('视频生成超时')
}

export async function generateOpenAiCompatibleVideo(
  input: OpenAiVideoCreateInput,
  onProgress?: VideoProgressCallback,
  callbacks?: {
    onRemoteJobCreated?: (payload: { apiTaskId: string; createUrl?: string }) => void | Promise<void>
  },
  abortSignal?: AbortSignal,
): Promise<string> {
  assertNotAborted(abortSignal)
  onProgress?.(VIDEO_PROGRESS_CREATING)
  const { taskId, videoUrl, createUrl } = await createOpenAiVideoTask(input, abortSignal)

  if (taskId && callbacks?.onRemoteJobCreated) {
    await callbacks.onRemoteJobCreated({ apiTaskId: taskId, createUrl })
  }

  if (videoUrl) {
    const absolute = resolveAbsoluteApiMediaUrl(createUrl, videoUrl)
    const downloadUrl = resolveApiOriginVideoContentUrl({
      contentUrl: absolute,
      apiBaseUrl: createUrl,
      preferredVideoId: taskId,
    })
    if (!downloadUrl.startsWith('http')) {
      throw new Error(
        `视频地址无效（需要绝对 http(s)，当前为：${String(videoUrl).slice(0, 120)}）`,
      )
    }
    onProgress?.(VIDEO_PROGRESS_DOWNLOADING)
    return downloadUrl
  }

  onProgress?.(VIDEO_PROGRESS_SUBMITTED)
  return await pollOpenAiVideoTask(
    input.model.apiKey || '',
    createUrl,
    taskId,
    onProgress,
    abortSignal,
  )
}

export interface PrepareOpenAiVideoRequestPreviewInput {
  model: ModelConfig
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
}

/** 上传参考图后构建 OpenAI 兼容确认弹窗预览 */
export async function prepareOpenAiVideoRequestPreview(
  input: PrepareOpenAiVideoRequestPreviewInput,
  onProgress?: VideoProgressCallback,
): Promise<{ preview: VideoRequestPreview; resolvedImageUrls: string[] }> {
  const referenceMode = input.referenceMode ?? 'first_frame'
  const needsReferenceImage = referenceMode !== 'text_to_video'

  if (needsReferenceImage) {
    onProgress?.(VIDEO_PROGRESS_UPLOADING)
  }

  const resolvedImageUrls = needsReferenceImage
    ? await prepareExternalVideoReferenceUrls({
        referenceMode,
        referenceImageItems: input.referenceImageItems,
        referenceImagePaths: input.referenceImagePaths,
        referenceImagePath: input.referenceImagePath,
        projectRoot: input.projectRoot,
        apiBaseUrl: input.apiBaseUrl,
        uploadLabel: 'openai_video_ref',
      })
    : []

  const body = await buildCreateBody({
    model: input.model,
    prompt: input.prompt,
    durationSec: input.durationSec,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    resolvedImageUrls,
    referenceMode,
    projectRoot: input.projectRoot,
    apiBaseUrl: input.apiBaseUrl,
  })

  const createUrl = resolveVideoCreateUrl(input.model) || ''
  const hasImage = Boolean(
    body.image ||
      body.image_url ||
      body.reference_images ||
      (body.extra_body as { image?: unknown[] } | undefined)?.image?.length,
  )

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
        modelName: input.model.name || input.model.model || 'OpenAI 兼容视频',
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
          ? hasImage
            ? `OpenAI 兼容：已上传 ${resolvedImageUrls.length} 张参考图`
            : '未找到有效参考图'
          : undefined,
        batchCount: input.batchCount,
      },
    },
  }
}
