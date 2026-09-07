// Copyright (c) local-creator contributors. All rights reserved.

import { probeLocalAudioDurationSec } from '@/lib/voice/voice-audio-utils'

/** Seedance 2.0（doubao-seedance-2-0）微视生视频入参上限 */
export const SEEDANCE_20_MAX_REFERENCE_IMAGES = 9
export const SEEDANCE_20_MAX_AUDIO_CONTENTS = 3
export const SEEDANCE_20_MAX_AUDIO_TOTAL_SEC = 15.2

export function isSeedance20WeishiModel(modelName?: string | null): boolean {
  const normalized = String(modelName || '').trim().toLowerCase()
  if (!normalized) return false
  if (/seedance-2\.5|seedance_2\.5|doubao-seedance-2-5/.test(normalized)) return false
  return (
    normalized === 'seedance-2.0' ||
    normalized === 'seedance-2.0-fast' ||
    normalized.includes('seedance-2.0') ||
    /doubao-seedance-2-0/.test(normalized)
  )
}

export async function assertSeedance20WeishiVideoLimits(options: {
  modelName?: string | null
  referenceImageCount: number
  referenceAudioPaths?: string[]
  generateAudio?: boolean
}): Promise<void> {
  if (!isSeedance20WeishiModel(options.modelName)) return

  const imageCount = Math.max(0, options.referenceImageCount)
  if (imageCount > SEEDANCE_20_MAX_REFERENCE_IMAGES) {
    throw new Error(
      `参考图超过 Seedance 2.0 上限（最多 ${SEEDANCE_20_MAX_REFERENCE_IMAGES} 张，当前 ${imageCount} 张），请减少 @ 引用或参考图`,
    )
  }

  const audioPaths =
    options.generateAudio === false
      ? []
      : (options.referenceAudioPaths ?? []).map((path) => String(path || '').trim()).filter(Boolean)

  if (audioPaths.length > SEEDANCE_20_MAX_AUDIO_CONTENTS) {
    throw new Error(
      `参考音频超过 Seedance 2.0 上限（最多 ${SEEDANCE_20_MAX_AUDIO_CONTENTS} 个，当前 ${audioPaths.length} 个），请合并或减少音频`,
    )
  }

  if (audioPaths.length === 0) return

  let totalSec = 0
  for (const path of audioPaths) {
    totalSec += await probeLocalAudioDurationSec(path)
  }

  if (totalSec > SEEDANCE_20_MAX_AUDIO_TOTAL_SEC + 0.05) {
    throw new Error(
      `参考音频总时长超过 Seedance 2.0 上限（最多 ${SEEDANCE_20_MAX_AUDIO_TOTAL_SEC} 秒，当前 ${totalSec.toFixed(1)} 秒），请裁剪音频`,
    )
  }
}
