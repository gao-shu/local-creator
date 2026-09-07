// Copyright (c) Haode AI. All rights reserved.

/** ffprobe 视频音轨与时长探测结果 */
export interface ProbeVideoAudioResult {
  hasAudio: boolean
  durationSec: number | null
  error?: string
}

/** ffmpeg 抽音写 mp3 结果 */
export interface ExtractAudioResult {
  success: boolean
  outputAbs?: string
  error?: string
}

export interface MediaProbeVideoAudioPayload {
  inputPath: string
  projectRoot?: string
}

export interface MediaExtractAudioPayload {
  inputPath: string
  outputPath: string
  startSec?: number
  endSec?: number
  projectRoot?: string
}
