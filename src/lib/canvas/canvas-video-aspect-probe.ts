// Copyright (c) local-creator contributors. All rights reserved.

import { VIDEO_ASPECT_OPTIONS } from '@/lib/workflow/storyboard-video-presets'

function toVideoProbeSrc(source: string): string {
  const trimmed = String(source || '').trim()
  if (!trimmed) return ''
  if (/^(data:|https?:|file:|blob:)/i.test(trimmed)) return trimmed
  const normalized = trimmed.replace(/\\/g, '/')
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${normalized}`
  }
  if (normalized.startsWith('//')) {
    return `file:${normalized}`
  }
  return trimmed
}

/** 将视频原始宽高归一到画布支持的 16:9 / 9:16 / 1:1 */
export function normalizeVideoAspectLabel(width: number, height: number): string {
  if (width <= 0 || height <= 0) {
    return VIDEO_ASPECT_OPTIONS[0]?.value ?? '16:9'
  }
  const ratio = width / height
  if (ratio > 1.15) return '16:9'
  if (ratio < 0.87) return '9:16'
  return '1:1'
}

/** 读取本地/远程视频 metadata，返回标准画幅标签 */
export function probeVideoAspectRatio(source: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const src = toVideoProbeSrc(source)
    if (!src) {
      reject(new Error('无效视频路径'))
      return
    }

    const video = document.createElement('video')
    video.preload = 'metadata'

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('error', onErr)
      video.src = ''
    }

    const onMeta = () => {
      const label = normalizeVideoAspectLabel(video.videoWidth, video.videoHeight)
      cleanup()
      resolve(label)
    }

    const onErr = () => {
      cleanup()
      reject(new Error('无法读取视频尺寸'))
    }

    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('error', onErr)
    video.src = src
  })
}

export async function resolveCanvasVideoImportAspectRatio(
  sourcePath?: string,
): Promise<string | undefined> {
  const path = String(sourcePath || '').trim()
  if (!path) return undefined
  try {
    return await probeVideoAspectRatio(path)
  } catch {
    return undefined
  }
}
