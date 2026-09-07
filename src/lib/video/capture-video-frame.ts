// Copyright (c) haode-ai-client. All rights reserved.

function seekVideoToTime(video: HTMLVideoElement, time: number): Promise<void> {
  const target = Math.max(0, time)
  if (Math.abs(video.currentTime - target) < 0.02) return Promise.resolve()

  return new Promise((resolve) => {
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      window.clearTimeout(timer)
    }
    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      resolve()
    }
    const timer = window.setTimeout(() => {
      cleanup()
      resolve()
    }, 5000)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)
    video.currentTime = target
  })
}

function drawVideoFrameToDataUrl(video: HTMLVideoElement): string | null {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.92)
  } catch {
    return null
  }
}

async function captureFrameFromSrcAtTime(src: string, time: number): Promise<string | null> {
  if (/^(local-image:|file:|blob:)/i.test(src)) {
    return null
  }

  try {
    const blob = await fetch(src).then((res) => res.blob())
    const objectUrl = URL.createObjectURL(blob)
    return await new Promise<string | null>((resolve) => {
      const temp = document.createElement('video')
      const finish = (value: string | null) => {
        URL.revokeObjectURL(objectUrl)
        resolve(value)
      }
      temp.onloadedmetadata = () => {
        const duration = Number.isFinite(temp.duration) ? temp.duration : time
        temp.currentTime = Math.min(Math.max(0, time), Math.max(0, duration - 0.001))
      }
      temp.onseeked = () => {
        finish(drawVideoFrameToDataUrl(temp))
      }
      temp.onerror = () => finish(null)
      temp.src = objectUrl
    })
  } catch {
    return null
  }
}

/** 从 video 元素截取指定时刻帧，返回 JPEG data URL */
export async function captureVideoFrame(
  video: HTMLVideoElement,
  options?: { time?: number },
): Promise<string | null> {
  if (!video.videoWidth) return null

  const time = options?.time
  if (time != null && Number.isFinite(time)) {
    await seekVideoToTime(video, time)
  }

  const currentTime = video.currentTime
  const src = video.src

  if (/^(local-image:|file:|blob:)/i.test(src)) {
    return drawVideoFrameToDataUrl(video)
  }

  return captureFrameFromSrcAtTime(src, currentTime)
}

/** 从视频预览地址截取首帧，用于列表缩略图（不可播放） */
export async function resolveVideoThumbnailSrc(previewSrc: string): Promise<string | null> {
  const src = String(previewSrc || '').trim()
  if (!src || src.startsWith('preview:')) return null
  if (/^data:image\//i.test(src)) return src

  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    let settled = false
    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      video.removeAttribute('src')
      video.load()
      resolve(value)
    }
    const timer = window.setTimeout(() => finish(null), 8000)
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      video.currentTime = duration > 0 ? Math.min(0.1, duration * 0.05) : 0
    }
    video.onseeked = () => {
      window.clearTimeout(timer)
      finish(drawVideoFrameToDataUrl(video))
    }
    video.onerror = () => {
      window.clearTimeout(timer)
      finish(null)
    }
    video.src = src
  })
}

/** 截取视频尾帧（最后一帧） */
export async function captureVideoLastFrame(video: HTMLVideoElement): Promise<string | null> {
  if (!video.videoWidth || !Number.isFinite(video.duration) || video.duration <= 0) {
    return null
  }
  const tailTime = Math.max(0, video.duration - 0.04)
  return captureVideoFrame(video, { time: tailTime })
}
