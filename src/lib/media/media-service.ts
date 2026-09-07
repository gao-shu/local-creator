// Copyright (c) local-creator contributors. All rights reserved.

import type {
  ExtractAudioResult,
  MediaExtractAudioPayload,
  MediaProbeVideoAudioPayload,
  ProbeVideoAudioResult,
} from '@/types/media'

export interface MediaAPI {
  probeVideoAudio: (payload: MediaProbeVideoAudioPayload) => Promise<ProbeVideoAudioResult>
  extractAudio: (payload: MediaExtractAudioPayload) => Promise<ExtractAudioResult>
}

export type {
  ExtractAudioResult,
  MediaExtractAudioPayload,
  MediaProbeVideoAudioPayload,
  ProbeVideoAudioResult,
} from '@/types/media'

function isMediaIpcUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /no handler registered/i.test(message)
}

function mediaUnavailableResult(): ProbeVideoAudioResult {
  return {
    hasAudio: false,
    durationSec: null,
    error: '媒体服务仅在桌面客户端可用',
  }
}

/** 探测视频音轨与时长（经 IPC → 主进程 ffprobe） */
export async function probeVideoAudio(
  payload: MediaProbeVideoAudioPayload,
): Promise<ProbeVideoAudioResult> {
  if (!window.mediaAPI?.probeVideoAudio) {
    return mediaUnavailableResult()
  }
  try {
    return await window.mediaAPI.probeVideoAudio(payload)
  } catch (error: unknown) {
    if (isMediaIpcUnavailableError(error)) {
      return {
        hasAudio: false,
        durationSec: null,
        error: '媒体服务未就绪，请完全退出并重新启动桌面客户端',
      }
    }
    throw error
  }
}

/** 从视频提取 mp3（经 IPC → 主进程 ffmpeg） */
export async function extractVideoAudio(
  payload: MediaExtractAudioPayload,
): Promise<ExtractAudioResult> {
  if (!window.mediaAPI?.extractAudio) {
    return { success: false, error: '媒体服务仅在桌面客户端可用' }
  }
  try {
    return await window.mediaAPI.extractAudio(payload)
  } catch (error: unknown) {
    if (isMediaIpcUnavailableError(error)) {
      return {
        success: false,
        error: '媒体服务未就绪，请完全退出并重新启动桌面客户端',
      }
    }
    throw error
  }
}
