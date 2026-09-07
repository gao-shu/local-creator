// Copyright (c) local-creator contributors. All rights reserved.

import { toLocalImageUrl } from '@/lib/storage/media-path-resolver'

export const VOICE_AUDIO_MIN_SEC = 1.8
export const VOICE_AUDIO_MAX_SEC = 15.2

const ALLOWED_VOICE_EXT = new Set(['.mp3', '.wav'])

export function isAllowedVoiceAudioPath(filePath: string): boolean {
  const ext = filePath.replace(/\\/g, '/').match(/(\.[^./\\]+)$/)?.[1]?.toLowerCase() ?? ''
  return ALLOWED_VOICE_EXT.has(ext)
}

export function formatVoiceAudioPathLabel(filePath: string): string {
  const normalized = filePath.trim()
  if (normalized.length <= 52) return normalized
  const name = normalized.split(/[\\/]/).pop() ?? normalized
  const head = normalized.slice(0, 24)
  return `${head}…${name}`
}

/** 通过 local-image 协议读取本地音频时长（秒） */
export function probeLocalAudioDurationSec(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    const url = toLocalImageUrl(filePath)
    if (!url) {
      reject(new Error('无法解析音频路径'))
      return
    }

    const cleanup = () => {
      audio.onloadedmetadata = null
      audio.onerror = null
      audio.removeAttribute('src')
      audio.load()
    }

    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const duration = audio.duration
      cleanup()
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('无法读取音频时长'))
        return
      }
      resolve(duration)
    }
    audio.onerror = () => {
      cleanup()
      reject(new Error('无法读取音频文件'))
    }
    audio.src = url
  })
}

export function validateVoiceAudioDuration(durationSec: number): string | null {
  if (durationSec < VOICE_AUDIO_MIN_SEC || durationSec > VOICE_AUDIO_MAX_SEC) {
    return `参考音频时长需在 ${VOICE_AUDIO_MIN_SEC}–${VOICE_AUDIO_MAX_SEC} 秒之间（当前 ${durationSec.toFixed(1)} 秒）`
  }
  return null
}
