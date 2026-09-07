// Copyright (c) Haode AI. All rights reserved.

import { resolveApiBase } from '@/lib/auth/api-base'
import { isRealUserSession } from '@/lib/auth/login-mode'
import { noteClientSessionFailure } from '@/lib/auth/session-expired'
import { VIDEO_POLL_INTERVAL_MS } from '@/constants/batch-concurrency'
import {
  assertNotAborted,
  isVideoGenerationAbortError,
  mergeFetchSignal,
} from '@/lib/video/video-generation-abort'
import { normalizeVideoResolution } from '@/lib/models/video-model-pricing'
import {
  VIDEO_PROGRESS_SUBMITTING,
  VIDEO_PROGRESS_QUEUED,
  formatVideoQueuedProgress,
  formatVideoTaskProgress,
  type VideoProgressCallback,
} from '@/lib/video/video-progress'
import { useAuthStore } from '@/stores/auth-store'

type ProxyEnvelope<T> = { code?: number; message?: string; data?: T }

export type SystemModelVideoJobStatus =
  | 'queued'
  | 'submitting'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export type SystemModelVideoJob = {
  job_id: string
  status: SystemModelVideoJobStatus | string
  progress?: number | null
  url?: string | null
  /** true：成片需走 admin /content 代下（上游 /content 或内网地址） */
  needs_proxy?: boolean | null
  upstream_task_id?: string | null
  queue_position?: number | null
  error?: string | null
  model_key?: string
  created_at?: number
  updated_at?: number
}

const VIDEO_JOB_POLL_TIMEOUT_MS = 35 * 60 * 1000

async function proxyPost<T>(
  path: string,
  body: unknown,
  apiBase?: string,
  timeoutMs = 180_000,
  abortSignal?: AbortSignal,
): Promise<T> {
  assertNotAborted(abortSignal)
  const token = useAuthStore.getState().token
  if (!token || !isRealUserSession(token)) {
    throw new Error('请先登录后再使用系统模型')
  }
  const base = resolveApiBase(apiBase).replace(/\/+$/, '')
  const url = base.startsWith('/') ? `${base}${path}` : `${base}${path}`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: mergeFetchSignal(abortSignal, timeoutMs),
    })
    const json = (await res.json()) as ProxyEnvelope<T> & { detail?: string }
    if (!res.ok) {
      const hint = json.message || (typeof json.detail === 'string' ? json.detail : undefined)
      noteClientSessionFailure(res.status, hint, json.code)
      throw new Error(hint || `系统模型代理请求失败 (${res.status})`)
    }
    if (json.code !== 0) {
      noteClientSessionFailure(res.status, json.message, json.code)
      throw new Error(json.message || '系统模型代理请求失败')
    }
    if (json.data === undefined) throw new Error('系统模型代理请求失败')
    return json.data
  } catch (error: unknown) {
    assertNotAborted(abortSignal)
    throw error
  }
}

async function proxyGet<T>(
  path: string,
  apiBase?: string,
  timeoutMs = 60_000,
  abortSignal?: AbortSignal,
): Promise<T> {
  assertNotAborted(abortSignal)
  const token = useAuthStore.getState().token
  if (!token || !isRealUserSession(token)) {
    throw new Error('请先登录后再使用系统模型')
  }
  const base = resolveApiBase(apiBase).replace(/\/+$/, '')
  const url = base.startsWith('/') ? `${base}${path}` : `${base}${path}`
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: mergeFetchSignal(abortSignal, timeoutMs),
    })
    const json = (await res.json()) as ProxyEnvelope<T> & { detail?: string }
    if (!res.ok) {
      const hint = json.message || (typeof json.detail === 'string' ? json.detail : undefined)
      noteClientSessionFailure(res.status, hint, json.code)
      throw new Error(hint || `系统模型代理请求失败 (${res.status})`)
    }
    if (json.code !== 0) {
      noteClientSessionFailure(res.status, json.message, json.code)
      throw new Error(json.message || '系统模型代理请求失败')
    }
    if (json.data === undefined) throw new Error('系统模型代理请求失败')
    return json.data
  } catch (error: unknown) {
    assertNotAborted(abortSignal)
    throw error
  }
}

function sleep(ms: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new DOMException('视频生成已取消', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      abortSignal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('视频生成已取消', 'AbortError'))
    }
    abortSignal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function applySystemModelVideoJobProgress(
  job: SystemModelVideoJob,
  onProgress?: VideoProgressCallback,
): void {
  const status = String(job.status || '').toLowerCase()
  if (status === 'queued') {
    const pos = Number(job.queue_position)
    if (Number.isFinite(pos) && pos > 0) {
      onProgress?.(formatVideoQueuedProgress(pos))
    } else {
      onProgress?.(VIDEO_PROGRESS_QUEUED)
    }
    return
  }
  if (status === 'submitting') {
    onProgress?.(VIDEO_PROGRESS_SUBMITTING)
    return
  }
  if (status === 'running') {
    const progress =
      job.progress != null && Number.isFinite(Number(job.progress))
        ? Number(job.progress)
        : undefined
    onProgress?.(formatVideoTaskProgress('running', progress))
    return
  }
  if (status === 'succeeded') {
    onProgress?.({
      message: '生成完成，准备下载…',
      progress: 100,
      status: 'completed',
    })
  }
}

export async function createSystemModelVideoJob(options: {
  modelKey: string
  prompt: string
  durationSec?: number
  aspectRatio?: string
  resolution?: string
  imageUrl?: string
  apiBase?: string
  abortSignal?: AbortSignal
}): Promise<SystemModelVideoJob> {
  const resolution = normalizeVideoResolution(options.resolution) ?? '720P'
  return proxyPost<SystemModelVideoJob>(
    '/client/system-models/video/jobs',
    {
      model_key: options.modelKey,
      prompt: options.prompt,
      duration_sec: options.durationSec ?? 5,
      aspect_ratio: options.aspectRatio ?? '16:9',
      resolution,
      image_url: options.imageUrl,
    },
    options.apiBase,
    60_000,
    options.abortSignal,
  )
}

export async function getSystemModelVideoJob(options: {
  jobId: string
  apiBase?: string
  abortSignal?: AbortSignal
}): Promise<SystemModelVideoJob> {
  return proxyGet<SystemModelVideoJob>(
    `/client/system-models/video/jobs/${encodeURIComponent(options.jobId)}`,
    options.apiBase,
    60_000,
    options.abortSignal,
  )
}

/** 系统模型成片代下地址（带登录态，由 admin 用上游 Key 拉取） */
export function buildSystemModelVideoJobContentUrl(
  apiBase: string | undefined,
  jobId: string,
): string {
  const base = resolveApiBase(apiBase).replace(/\/+$/, '')
  const id = String(jobId || '').trim()
  if (!base || !id) return ''
  return `${base}/client/system-models/video/jobs/${encodeURIComponent(id)}/content`
}

export function isSystemModelVideoJobContentUrl(url: string): boolean {
  try {
    const path = /^https?:\/\//i.test(url) ? new URL(url).pathname : url
    return /\/client\/system-models\/video\/jobs\/[^/]+\/content\/?$/i.test(path)
  } catch {
    return /\/client\/system-models\/video\/jobs\/[^/]+\/content\/?$/i.test(url)
  }
}

export function resolveSystemModelVideoDownloadUrl(options: {
  job: SystemModelVideoJob
  apiBase?: string
}): string {
  const jobId = String(options.job.job_id || '').trim()
  const direct = String(options.job.url || '').trim()
  const needsProxy = Boolean(options.job.needs_proxy)
  if (direct && !needsProxy) return direct
  return buildSystemModelVideoJobContentUrl(options.apiBase, jobId)
}

export async function cancelSystemModelVideoJob(options: {
  jobId: string
  apiBase?: string
  abortSignal?: AbortSignal
}): Promise<SystemModelVideoJob> {
  return proxyPost<SystemModelVideoJob>(
    `/client/system-models/video/jobs/${encodeURIComponent(options.jobId)}/cancel`,
    {},
    options.apiBase,
    30_000,
    options.abortSignal,
  )
}

/** 轮询 admin 异步视频 job 直至成功/失败/超时 */
export async function pollSystemModelVideoJob(options: {
  jobId: string
  apiBase?: string
  abortSignal?: AbortSignal
  onProgress?: VideoProgressCallback
  timeoutMs?: number
}): Promise<string> {
  const started = Date.now()
  const timeoutMs = options.timeoutMs ?? VIDEO_JOB_POLL_TIMEOUT_MS
  try {
    while (Date.now() - started < timeoutMs) {
      assertNotAborted(options.abortSignal)
      const job = await getSystemModelVideoJob({
        jobId: options.jobId,
        apiBase: options.apiBase,
        abortSignal: options.abortSignal,
      })
      applySystemModelVideoJobProgress(job, options.onProgress)
      const status = String(job.status || '').toLowerCase()
      if (status === 'succeeded') {
        const downloadUrl = resolveSystemModelVideoDownloadUrl({
          job,
          apiBase: options.apiBase,
        })
        if (!downloadUrl) throw new Error('视频任务已完成但未返回地址')
        return downloadUrl
      }
      if (status === 'failed' || status === 'cancelled') {
        throw new Error(
          job.error?.trim() || (status === 'cancelled' ? '视频生成已取消' : '视频生成失败'),
        )
      }
      await sleep(VIDEO_POLL_INTERVAL_MS, options.abortSignal)
    }
    throw new Error('视频生成超时')
  } catch (error: unknown) {
    if (isVideoGenerationAbortError(error)) {
      void cancelSystemModelVideoJob({
        jobId: options.jobId,
        apiBase: options.apiBase,
      }).catch(() => undefined)
    }
    throw error
  }
}

export async function proxySystemModelChat(options: {
  modelKey: string
  prompt: string
  temperature?: number
  apiBase?: string
  abortSignal?: AbortSignal
}): Promise<string> {
  const data = await proxyPost<{ content: string }>(
    '/client/system-models/chat',
    {
      model_key: options.modelKey,
      prompt: options.prompt,
      temperature: options.temperature ?? 0.7,
    },
    options.apiBase,
    180_000,
    options.abortSignal,
  )
  return data.content
}

export async function proxySystemModelImage(options: {
  modelKey: string
  prompt: string
  size?: string
  imageUrls?: string[]
  resolution?: string
  quality?: string
  apiBase?: string
  abortSignal?: AbortSignal
}): Promise<string> {
  const body: Record<string, unknown> = {
    model_key: options.modelKey,
    prompt: options.prompt,
    size: options.size ?? '1024x1024',
    image_urls: options.imageUrls,
  }
  if (options.resolution) body.resolution = options.resolution
  if (options.quality) body.quality = options.quality

  const data = await proxyPost<{ url: string }>(
    '/client/system-models/image',
    body,
    options.apiBase,
    180_000,
    options.abortSignal,
  )
  return data.url
}

/**
 * 系统模型生视频：创建 admin 异步 job 并轮询（短请求，不再挂起单次长 POST）。
 */
export async function proxySystemModelVideo(options: {
  modelKey: string
  prompt: string
  durationSec?: number
  aspectRatio?: string
  resolution?: string
  imageUrl?: string
  apiBase?: string
  abortSignal?: AbortSignal
  onProgress?: VideoProgressCallback
  onJobCreated?: (job: SystemModelVideoJob) => void | Promise<void>
  resumeJobId?: string
}): Promise<string> {
  let jobId = options.resumeJobId?.trim() || ''
  try {
    if (!jobId) {
      options.onProgress?.(VIDEO_PROGRESS_SUBMITTING)
      const created = await createSystemModelVideoJob(options)
      jobId = String(created.job_id || '').trim()
      if (!jobId) throw new Error('系统模型未返回视频任务 ID')
      applySystemModelVideoJobProgress(created, options.onProgress)
      await options.onJobCreated?.(created)
    }
    return await pollSystemModelVideoJob({
      jobId,
      apiBase: options.apiBase,
      abortSignal: options.abortSignal,
      onProgress: options.onProgress,
    })
  } catch (error: unknown) {
    if (jobId && isVideoGenerationAbortError(error)) {
      void cancelSystemModelVideoJob({
        jobId,
        apiBase: options.apiBase,
      }).catch(() => undefined)
    }
    throw error
  }
}
