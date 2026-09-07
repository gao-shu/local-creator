// Copyright (c) local-creator contributors. All rights reserved.

/**
 * Agnes Video 2.5 / 2.5 Flash（apihub 直连）
 * 文档：https://agnes-ai.com/zh-Hans/docs/agnes-video-25-flash
 * - 创建：POST /v1/videos
 * - 轮询：GET /agnesapi?video_id=&model_name=
 */

import type { ModelConfig } from '@/types/settings'
import {
  pickFirstDuration,
  pickFirstRatio,
  resolveVideoCreateUrl,
} from '@/lib/models/video-model-utils'
import { normalizeApiBase } from '@/lib/models/model-endpoint'
import type { VideoReferenceMode } from '@/lib/workflow/storyboard-video-presets'
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
  VIDEO_PROGRESS_CREATING,
  VIDEO_PROGRESS_DOWNLOADING,
  VIDEO_PROGRESS_SUBMITTED,
  VIDEO_PROGRESS_WAITING_CONTENT,
  type VideoProgressCallback,
} from '@/lib/video/video-progress'
import { VIDEO_POLL_INTERVAL_MS } from '@/constants/batch-concurrency'

const POLL_TIMEOUT_MS = 30 * 60 * 1000
const POLL_RATE_LIMIT_BACKOFF_MS = 8000
const DEFAULT_MODEL = 'agnes-video-2.5-flash'
const DEFAULT_BASE = 'https://apihub.agnes-ai.com'

export function isAgnesVideo25Model(
  model?: Pick<ModelConfig, 'model' | 'endpoint' | 'baseUrl' | 'name' | 'apiFormat'> | null,
): boolean {
  const apiFormat = String(model?.apiFormat || '')
    .trim()
    .toLowerCase()
  if (apiFormat === 'agnes_video_25' || apiFormat === 'agnes_video_25_flash') return true

  const modelId = String(model?.model || '').trim().toLowerCase()
  const name = String(model?.name || '').trim().toLowerCase()
  if (modelId.includes('agnes-video-2.5') || name.includes('agnes video 2.5')) return true
  if (modelId.includes('agnes-video-25') || name.includes('agnes-video-2.5-flash')) return true
  return false
}

export function resolveAgnesVideo25ModelName(
  model?: Pick<ModelConfig, 'model'> | null,
): string {
  const id = String(model?.model || '').trim()
  return id || DEFAULT_MODEL
}

export function resolveAgnesVideo25BaseUrl(
  model?: Pick<ModelConfig, 'endpoint' | 'baseUrl'> | null,
): string {
  const base = normalizeApiBase(model?.baseUrl)
  if (base) {
    try {
      return new URL(base.includes('://') ? base : `https://${base}`).origin
    } catch {
      /* fall through */
    }
  }
  const createUrl = resolveVideoCreateUrl(model || { endpoint: '' })
  if (createUrl) {
    try {
      return new URL(createUrl).origin
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_BASE
}

export function resolveAgnesVideo25CreateUrl(
  model?: Pick<ModelConfig, 'endpoint' | 'baseUrl' | 'apiFormat' | 'autoAppendV1' | 'configMode'> | null,
): string {
  const endpoint = normalizeApiBase(model?.endpoint)
  if (endpoint && /\/v1\/videos\/?$/i.test(endpoint)) return endpoint.replace(/\/+$/, '')
  if (endpoint && /\/v1\/videos(\/|$)/i.test(endpoint) && !/generations/i.test(endpoint)) {
    return endpoint.replace(/\/+$/, '')
  }
  const base = resolveAgnesVideo25BaseUrl(model)
  return `${base}/v1/videos`
}

export function resolveAgnesVideo25PollUrl(options: {
  baseUrl?: string
  videoId: string
  modelName: string
}): string {
  const origin = normalizeApiBase(options.baseUrl) || DEFAULT_BASE
  let host = DEFAULT_BASE
  try {
    host = new URL(origin.includes('://') ? origin : `https://${origin}`).origin
  } catch {
    host = DEFAULT_BASE
  }
  const params = new URLSearchParams({
    video_id: String(options.videoId || '').trim(),
    model_name: String(options.modelName || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
  })
  return `${host}/agnesapi?${params.toString()}`
}

function clampAgnesSeconds(durationSec: number): string {
  const n = Math.round(Number(durationSec) || 5)
  return String(Math.min(12, Math.max(4, n)))
}

function normalizeAgnesAspectRatio(ratio?: string): string {
  const value = String(ratio || '').trim()
  const allowed = new Set(['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'])
  if (allowed.has(value)) return value
  return '16:9'
}

export function mapAgnesVideo25Mode(
  referenceMode?: VideoReferenceMode,
): 'text' | 'keyframe' | 'reference' {
  if (referenceMode === 'first_frame' || referenceMode === 'first_last_frame') return 'keyframe'
  if (referenceMode === 'multimodal') return 'reference'
  return 'text'
}

export function buildAgnesVideo25CreateBody(input: {
  model: ModelConfig
  prompt: string
  durationSec?: number
  aspectRatio?: string
  referenceMode?: VideoReferenceMode
  resolvedImageUrls?: string[]
  resolvedAudioUrls?: string[]
}): Record<string, unknown> {
  const durationSec = input.durationSec ?? pickFirstDuration(input.model)
  const aspectRatio = normalizeAgnesAspectRatio(
    input.aspectRatio ?? pickFirstRatio(input.model),
  )
  const images = (input.resolvedImageUrls || []).map((u) => u.trim()).filter(Boolean).slice(0, 5)
  const audios = (input.resolvedAudioUrls || []).map((u) => u.trim()).filter(Boolean).slice(0, 3)
  const mode = mapAgnesVideo25Mode(input.referenceMode)

  const body: Record<string, unknown> = {
    model: resolveAgnesVideo25ModelName(input.model),
    prompt: input.prompt.trim(),
    mode,
    seconds: clampAgnesSeconds(durationSec),
    size: '720P',
    aspect_ratio: aspectRatio,
    n: 1,
  }

  if (mode === 'keyframe') {
    if (images[0]) body.first_frame = images[0]
    if (input.referenceMode === 'first_last_frame' && images[1]) {
      body.last_frame = images[1]
    } else if (images[1] && !body.last_frame) {
      body.last_frame = images[1]
    }
    return body
  }

  if (mode === 'reference') {
    if (images.length) body.images = images
    if (audios.length) body.audios = audios
    return body
  }

  return body
}

function extractApiErrorMessage(data: Record<string, unknown>, fallback: string): string {
  const detail = data.detail
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string } | string
    if (typeof first === 'string' && first.trim()) return first.trim()
    if (typeof first === 'object' && first?.msg) return String(first.msg)
  }
  const errObj = data.error as { message?: string } | string | undefined
  if (typeof errObj === 'string' && errObj.trim()) return errObj.trim()
  if (typeof errObj === 'object' && errObj?.message) return errObj.message
  const msg = String(data.message || '').trim()
  return msg || fallback
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`Agnes 视频 API 响应解析失败 (${response.status})：${text.slice(0, 200)}`)
  }
}

function extractVideoUrl(data: Record<string, unknown>): string {
  const nested = data.data as Record<string, unknown> | undefined
  const output = data.output as { video_url?: string; url?: string } | undefined
  const videoObj = data.video as { url?: string } | undefined
  return (
    String(videoObj?.url || '').trim() ||
    String(data.video_url || '').trim() ||
    String(data.url || '').trim() ||
    String(output?.video_url || '').trim() ||
    String(output?.url || '').trim() ||
    String(nested?.video_url || '').trim() ||
    String(nested?.url || '').trim() ||
    ''
  )
}

/** 轮询用 video_id（优先原生短 id，勿用 task_xxx） */
export function extractAgnesVideo25PollVideoId(data: Record<string, unknown>): string {
  const nested = data.data as { video_id?: string; id?: string } | undefined
  const videoId = String(data.video_id || nested?.video_id || '').trim()
  if (videoId && !videoId.startsWith('task_')) return videoId
  const id = String(data.id || nested?.id || '').trim()
  if (id.startsWith('video_')) return id
  return videoId || id
}

export interface AgnesVideo25CreateInput {
  model: ModelConfig
  prompt: string
  durationSec?: number
  aspectRatio?: string
  resolution?: string
  resolvedImageUrls?: string[]
  resolvedAudioUrls?: string[]
  referenceMode?: VideoReferenceMode
}

export async function createAgnesVideo25Task(
  input: AgnesVideo25CreateInput,
  abortSignal?: AbortSignal,
): Promise<{ videoId: string; videoUrl: string; createUrl: string; rawData: Record<string, unknown> }> {
  assertNotAborted(abortSignal)
  const createUrl = resolveAgnesVideo25CreateUrl(input.model)
  if (!createUrl) throw new Error(`模型「${input.model.name}」未配置 API 地址`)
  const apiKey = String(input.model.apiKey || '').trim()
  if (!apiKey) throw new Error(`模型「${input.model.name}」未配置 API Key`)

  const body = buildAgnesVideo25CreateBody(input)
  const response = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: mergeFetchSignal(abortSignal, 120_000),
  })
  const data = await readJsonResponse(response)
  if (!response.ok) {
    throw new Error(
      `Agnes 视频创建失败 (${response.status})：${extractApiErrorMessage(data, '视频创建失败')}`,
    )
  }

  const rawUrl = extractVideoUrl(data)
  const videoId = extractAgnesVideo25PollVideoId(data)
  if (rawUrl && /^https?:\/\//i.test(rawUrl)) {
    return { videoId, videoUrl: rawUrl, createUrl, rawData: data }
  }
  if (!videoId) throw new Error('Agnes 视频 API 未返回 video_id')
  return { videoId, videoUrl: '', createUrl, rawData: data }
}

export async function pollAgnesVideo25Task(
  apiKey: string,
  model: Pick<ModelConfig, 'model' | 'endpoint' | 'baseUrl' | 'name' | 'apiFormat'>,
  videoId: string,
  onProgress?: VideoProgressCallback,
  abortSignal?: AbortSignal,
): Promise<string> {
  const pollUrl = resolveAgnesVideo25PollUrl({
    baseUrl: resolveAgnesVideo25BaseUrl(model),
    videoId,
    modelName: resolveAgnesVideo25ModelName(model),
  })
  const start = Date.now()
  let pollRound = 0
  let waitingContentRounds = 0

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    assertNotAborted(abortSignal)
    pollRound += 1
    const response = await fetch(pollUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
      signal: mergeFetchSignal(abortSignal, 60_000),
    })
    const data = await readJsonResponse(response)
    if (!response.ok) {
      // 429：查询限流，退避后继续轮询（勿直接失败）
      if (response.status === 429) {
        const waitedSec = Math.max(0, Math.round((Date.now() - start) / 1000))
        onProgress?.({
          message: `查询限流，稍后重试…（已等 ${waitedSec}s）`,
          progress,
          status: 'queued',
        })
        await delayWithAbort(POLL_RATE_LIMIT_BACKOFF_MS, abortSignal)
        continue
      }
      throw new Error(
        `Agnes 视频查询失败 (${response.status})：${extractApiErrorMessage(data, '查询失败')}`,
      )
    }

    const { status, progress, error } = parseVideoPollPayload(data)
    const videoUrl = extractVideoUrl(data)
    const finished =
      isVideoTaskSuccess(status) ||
      (progress != null && progress >= 100) ||
      Boolean(videoUrl)

    if (isVideoTaskFailed(status)) {
      onProgress?.(formatVideoTaskProgress(status, progress, pollRound))
      throw new Error(error || extractApiErrorMessage(data, '视频生成失败'))
    }

    if (finished && videoUrl) {
      onProgress?.(VIDEO_PROGRESS_DOWNLOADING)
      return videoUrl
    }

    if (finished && !videoUrl) {
      waitingContentRounds += 1
      const waitedSec = Math.max(0, Math.round((Date.now() - start) / 1000))
      onProgress?.({
        ...VIDEO_PROGRESS_WAITING_CONTENT,
        message: `生成完成，等待成片地址…（已等 ${waitedSec}s）`,
      })
      if (waitingContentRounds >= 15) {
        throw new Error('远端已完成但未返回成片地址，请稍后重试或重新生成')
      }
    } else {
      waitingContentRounds = 0
      onProgress?.(formatVideoTaskProgress(status || 'processing', progress, pollRound))
    }

    await delayWithAbort(VIDEO_POLL_INTERVAL_MS, abortSignal)
  }

  throw new Error('视频生成超时')
}

export async function generateAgnesVideo25(
  input: AgnesVideo25CreateInput,
  onProgress?: VideoProgressCallback,
  callbacks?: {
    onRemoteJobCreated?: (payload: { apiTaskId: string; createUrl?: string }) => void | Promise<void>
  },
  abortSignal?: AbortSignal,
): Promise<string> {
  assertNotAborted(abortSignal)
  onProgress?.(VIDEO_PROGRESS_CREATING)
  const { videoId, videoUrl, createUrl } = await createAgnesVideo25Task(input, abortSignal)

  if (videoId && callbacks?.onRemoteJobCreated) {
    await callbacks.onRemoteJobCreated({ apiTaskId: videoId, createUrl })
  }

  if (videoUrl) {
    onProgress?.(VIDEO_PROGRESS_DOWNLOADING)
    return videoUrl
  }

  onProgress?.(VIDEO_PROGRESS_SUBMITTED)
  return pollAgnesVideo25Task(
    String(input.model.apiKey || '').trim(),
    input.model,
    videoId,
    onProgress,
    abortSignal,
  )
}
