// Copyright (c) local-creator contributors. All rights reserved.

import { normalizeStoredMediaPath } from '@/lib/storage/media-path-resolver'

export interface VideoExtractAudioAvailability {
  available: boolean
  disabledReason?: string
}

/** 本地视频是否可抽音（画布 / 工坊共用） */
export function resolveVideoExtractAudioAvailability(options: {
  outputPath?: string | null
  running?: boolean
  uploading?: boolean
  mediaMissing?: boolean
}): VideoExtractAudioAvailability {
  if (options.running) {
    return { available: false, disabledReason: '视频生成中，请稍后再试' }
  }
  if (options.uploading) {
    return { available: false, disabledReason: '视频上传中，请稍后再试' }
  }

  const raw = normalizeStoredMediaPath(String(options.outputPath || '').trim())
  if (!raw || raw.startsWith('preview:')) {
    return { available: false, disabledReason: '请先生成或上传本地视频' }
  }
  if (/^https?:\/\//i.test(raw)) {
    return { available: false, disabledReason: '视频尚未落盘到本地，无法提取音频' }
  }
  if (options.mediaMissing) {
    return { available: false, disabledReason: '视频文件不存在或路径无效' }
  }

  return { available: true }
}
