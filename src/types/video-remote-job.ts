// Copyright (c) local-creator contributors. All rights reserved.

/** 可恢复轮询的远端视频任务快照（不含 API Key） */
export type VideoRemoteJobProvider =
  | 'zhipu'
  | 'openai_compatible'
  | 'weishi'
  | 'grok'
  | 'agnes_video_25'

export interface VideoRemoteJobSnapshot {
  provider: VideoRemoteJobProvider
  apiTaskId: string
  /** OpenAI 兼容 / 微视轮询基址 */
  createUrl?: string
  /** 恢复时从设置中匹配模型 */
  modelId?: string
  modelKey?: string
  createdAt: number
  durationSec?: number
  resolution?: string
}

export const VIDEO_REMOTE_JOB_HANG_MS = 30 * 60 * 1000
