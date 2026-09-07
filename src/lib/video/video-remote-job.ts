// Copyright (c) Haode AI. All rights reserved.

import type { ModelConfig } from '@/types/settings'
import type { VideoRemoteJobSnapshot } from '@/types/video-remote-job'
import { VIDEO_REMOTE_JOB_HANG_MS } from '@/types/video-remote-job'
import { pollOpenAiVideoTask } from '@/lib/video/openai-video-client'
import { pollGrokVideoTask, resolveGrokVideoCreateUrl } from '@/lib/video/grok-video-client'
import { pollWeishiVideoTask } from '@/lib/models/weishi-video-client'
import { resolveWeishiApiKey } from '@/lib/auth/org-weishi-key'
import { pollZhipuVideoTask } from '@/lib/video/zhipu-video-client'
import { pollAgnesVideo25Task } from '@/lib/video/agnes-video-25-client'
import { resolveVideoCreateUrl } from '@/lib/models/video-model-utils'
import {
  VIDEO_PROGRESS_COMPLETED,
  VIDEO_PROGRESS_SUBMITTED,
  type VideoProgressCallback,
} from '@/lib/video/video-progress'
import { assertNotAborted } from '@/lib/video/video-generation-abort'
import { resolveVideoProviderKind } from '@/lib/video/video-provider'
import { pickVideoModel } from '@/lib/video/video-client'
import { pollSystemModelVideoJob } from '@/lib/models/system-model-proxy'

export function isVideoRemoteJobStale(job: VideoRemoteJobSnapshot, now = Date.now()): boolean {
  return now - (job.createdAt || 0) > VIDEO_REMOTE_JOB_HANG_MS
}

export function resolveModelForRemoteJob(
  models: ModelConfig[],
  job: VideoRemoteJobSnapshot,
  preferredId?: string,
): ModelConfig {
  if (job.modelId) {
    const hit = models.find(
      (item) =>
        item.id === job.modelId ||
        item.model === job.modelId ||
        item.name === job.modelId,
    )
    if (hit) return hit
  }
  if (job.modelKey) {
    const hit = models.find((item) => item.modelKey === job.modelKey)
    if (hit) return hit
  }
  return pickVideoModel(models, preferredId)
}

/** 仅恢复轮询，不再创建远端任务 */
export async function resumeVideoRemoteJob(
  job: VideoRemoteJobSnapshot,
  model: ModelConfig,
  onProgress?: VideoProgressCallback,
  options?: {
    apiBaseUrl?: string
    abortSignal?: AbortSignal
  },
): Promise<string> {
  assertNotAborted(options?.abortSignal)
  if (!job.apiTaskId?.trim()) {
    throw new Error('缺少远端视频任务 ID，无法恢复')
  }
  if (isVideoRemoteJobStale(job)) {
    throw new Error('视频生成已超时，请重新生成')
  }

  let apiKey = model.apiKey?.trim()
  if (job.provider === 'weishi') {
    apiKey = await resolveWeishiApiKey({
      model,
      apiBase: options?.apiBaseUrl,
    })
  } else if (job.provider !== 'system' && !apiKey) {
    throw new Error(`模型「${model.name}」未配置 API Key，无法恢复生视频`)
  }

  onProgress?.(VIDEO_PROGRESS_SUBMITTED)

  if (job.provider === 'system') {
    return pollSystemModelVideoJob({
      jobId: job.apiTaskId,
      apiBase: options?.apiBaseUrl,
      abortSignal: options?.abortSignal,
      onProgress,
    })
  }

  if (job.provider === 'zhipu') {
    const result = await pollZhipuVideoTask(
      apiKey!,
      job.apiTaskId,
      job.createUrl || model.endpoint,
      onProgress,
      options?.abortSignal,
    )
    if (!result.success || !result.videoUrl) {
      throw new Error(result.error || '视频生成失败')
    }
    onProgress?.(VIDEO_PROGRESS_COMPLETED)
    return result.videoUrl
  }

  if (job.provider === 'openai_compatible') {
    const createUrl =
      job.createUrl || resolveVideoCreateUrl(model) || model.endpoint || model.baseUrl || ''
    if (!createUrl.trim()) {
      throw new Error(`模型「${model.name}」未配置 API 地址，无法恢复生视频`)
    }
    // pollOpenAiVideoTask 完成时已切到「正在下载成片」，勿再回退「准备下载」
    return pollOpenAiVideoTask(
      apiKey!,
      createUrl,
      job.apiTaskId,
      onProgress,
      options?.abortSignal,
    )
  }

  if (job.provider === 'grok') {
    const createUrl =
      job.createUrl || resolveGrokVideoCreateUrl(model) || model.endpoint || model.baseUrl || ''
    if (!createUrl.trim()) {
      throw new Error(`模型「${model.name}」未配置 API 地址，无法恢复生视频`)
    }
    return pollGrokVideoTask(
      apiKey!,
      createUrl,
      job.apiTaskId,
      onProgress,
      options?.abortSignal,
    )
  }

  if (job.provider === 'weishi') {
    const createUrl = job.createUrl || model.endpoint || ''
    if (!createUrl.trim()) {
      throw new Error(`模型「${model.name}」未配置 API 地址，无法恢复生视频`)
    }
    const videoUrl = await pollWeishiVideoTask(
      apiKey!,
      createUrl,
      job.apiTaskId,
      onProgress,
      options?.abortSignal,
    )
    onProgress?.(VIDEO_PROGRESS_COMPLETED)
    return videoUrl
  }

  if (job.provider === 'agnes_video_25') {
    return pollAgnesVideo25Task(
      apiKey!,
      model,
      job.apiTaskId,
      onProgress,
      options?.abortSignal,
    )
  }

  throw new Error('不支持的远端视频任务类型，请重新生成')
}

export function buildVideoRemoteJobSnapshot(options: {
  provider: VideoRemoteJobSnapshot['provider']
  apiTaskId: string
  createUrl?: string
  model: ModelConfig
  durationSec?: number
  resolution?: string
}): VideoRemoteJobSnapshot {
  return {
    provider: options.provider,
    apiTaskId: options.apiTaskId,
    createUrl: options.createUrl,
    modelId: options.model.id,
    modelKey: options.model.modelKey,
    createdAt: Date.now(),
    durationSec: options.durationSec,
    resolution: options.resolution,
  }
}

export function resolveProviderForRemoteJob(model: ModelConfig): VideoRemoteJobSnapshot['provider'] | null {
  const kind = resolveVideoProviderKind(model)
  if (kind === 'zhipu') return 'zhipu'
  if (kind === 'grok') return 'grok'
  if (kind === 'openai_compatible') return 'openai_compatible'
  if (kind === 'weishi') return 'weishi'
  if (kind === 'agnes_video_25') return 'agnes_video_25'
  if (kind === 'system') return 'system'
  return null
}
