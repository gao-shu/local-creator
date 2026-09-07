// Copyright (c) local-creator contributors. All rights reserved.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { toLocalImageUrl } from '@/lib/storage/media-path-resolver'

export type LocalMediaPlayerKind = 'audio' | 'video'

export interface UseLocalMediaPlayerOptions {
  /** 本地绝对路径，或已是 local-image:/http(s) URL */
  src?: string
  kind?: LocalMediaPlayerKind
  /** 默认区间起点（秒） */
  startSec?: number
  /** 默认区间终点（秒）；null 表示到片尾 */
  endSec?: number | null
  onTimeUpdate?: (currentTime: number) => void
  /** 绑定页面内已有 video/audio 元素（弹窗预览用） */
  mediaElement?: HTMLMediaElement | null
  /** 备选：RefObject 绑定（mediaElement 优先） */
  elementRef?: RefObject<HTMLMediaElement | null>
}

export interface UseLocalMediaPlayerPlayOptions {
  startSec?: number
  endSec?: number | null
}

export interface UseLocalMediaPlayerResult {
  ready: boolean
  playing: boolean
  currentTime: number
  duration: number | null
  error: string | null
  play: (options?: UseLocalMediaPlayerPlayOptions) => void
  pause: () => void
  toggle: () => void
  seek: (sec: number) => void
  stop: () => void
}

const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v'])

function resolveMediaUrl(path: string): string {
  const text = String(path || '').trim()
  if (!text) return ''
  if (
    text.startsWith('local-image:') ||
    text.startsWith('data:') ||
    text.startsWith('preview:') ||
    /^https?:\/\//i.test(text)
  ) {
    return text
  }
  return toLocalImageUrl(text)
}

function inferMediaKind(src: string, kind?: LocalMediaPlayerKind): LocalMediaPlayerKind {
  if (kind) return kind
  const ext = src.replace(/\\/g, '/').match(/(\.[^./\\]+)$/)?.[1]?.toLowerCase() ?? ''
  return VIDEO_EXTENSIONS.has(ext) ? 'video' : 'audio'
}

function createDetachedMediaElement(kind: LocalMediaPlayerKind): HTMLMediaElement {
  if (kind === 'video') {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.playsInline = true
    return video
  }
  const audio = new Audio()
  audio.preload = 'auto'
  return audio
}

function detachMediaElement(media: HTMLMediaElement) {
  media.pause()
  media.removeAttribute('src')
  media.load()
}

function resolveBoundMediaElement(
  mediaElement?: HTMLMediaElement | null,
  elementRef?: RefObject<HTMLMediaElement | null>,
): HTMLMediaElement | null {
  return mediaElement ?? elementRef?.current ?? null
}

/** 本地音视频播放：支持整段/区间试听，可绑定 DOM 元素或内部 Audio/Video */
export function useLocalMediaPlayer(
  options: UseLocalMediaPlayerOptions = {},
): UseLocalMediaPlayerResult {
  const {
    src,
    kind,
    startSec = 0,
    endSec = null,
    onTimeUpdate,
    mediaElement,
    elementRef,
  } = options

  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const detachedRef = useRef<HTMLMediaElement | null>(null)
  const activeRangeRef = useRef<{ startSec: number; endSec: number | null }>({
    startSec: 0,
    endSec: null,
  })
  const onTimeUpdateRef = useRef(onTimeUpdate)
  onTimeUpdateRef.current = onTimeUpdate

  const getMediaElement = useCallback((): HTMLMediaElement | null => {
    return resolveBoundMediaElement(mediaElement, elementRef) ?? detachedRef.current
  }, [elementRef, mediaElement])

  useEffect(() => {
    const trimmedSrc = String(src || '').trim()
    const external = resolveBoundMediaElement(mediaElement, elementRef)
    let detached: HTMLMediaElement | null = null
    let media: HTMLMediaElement | null = external

    setReady(false)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(null)
    setError(null)
    activeRangeRef.current = { startSec: 0, endSec: null }

    if (!trimmedSrc) {
      if (external) {
        external.pause()
        external.removeAttribute('src')
        external.load()
      }
      if (detachedRef.current) {
        detachMediaElement(detachedRef.current)
        detachedRef.current = null
      }
      return
    }

    const mediaKind = inferMediaKind(trimmedSrc, kind)
    const url = resolveMediaUrl(trimmedSrc)
    if (!url) {
      setError('无法解析媒体路径')
      return
    }

    if (!media) {
      detached = createDetachedMediaElement(mediaKind)
      detachedRef.current = detached
      media = detached
    }

    const handleLoadedMetadata = () => {
      const nextDuration = Number.isFinite(media!.duration) ? media!.duration : null
      setDuration(nextDuration)
      setReady(true)
      setError(null)
    }

    const handleTimeUpdate = () => {
      const t = media!.currentTime
      setCurrentTime(t)
      onTimeUpdateRef.current?.(t)
      const rangeEnd = activeRangeRef.current.endSec
      if (rangeEnd != null && Number.isFinite(rangeEnd) && t >= rangeEnd - 0.04) {
        media!.pause()
        setPlaying(false)
      }
    }

    const handlePlay = () => setPlaying(true)
    const handlePause = () => setPlaying(false)
    const handleEnded = () => setPlaying(false)
    const handleError = () => {
      setError('无法播放媒体文件')
      setReady(false)
      setPlaying(false)
    }

    media.addEventListener('loadedmetadata', handleLoadedMetadata)
    media.addEventListener('timeupdate', handleTimeUpdate)
    media.addEventListener('play', handlePlay)
    media.addEventListener('pause', handlePause)
    media.addEventListener('ended', handleEnded)
    media.addEventListener('error', handleError)

    if (media.src !== url) {
      media.src = url
    }
    if (media.readyState >= HTMLMediaElement.HAVE_METADATA) {
      handleLoadedMetadata()
    }

    return () => {
      media!.removeEventListener('loadedmetadata', handleLoadedMetadata)
      media!.removeEventListener('timeupdate', handleTimeUpdate)
      media!.removeEventListener('play', handlePlay)
      media!.removeEventListener('pause', handlePause)
      media!.removeEventListener('ended', handleEnded)
      media!.removeEventListener('error', handleError)
      if (detached) {
        detachMediaElement(detached)
        detachedRef.current = null
      } else if (external) {
        external.pause()
      }
    }
  }, [src, kind, mediaElement, elementRef])

  const pause = useCallback(() => {
    getMediaElement()?.pause()
  }, [getMediaElement])

  const stop = useCallback(() => {
    const media = getMediaElement()
    if (!media) return
    const start = activeRangeRef.current.startSec
    media.pause()
    try {
      media.currentTime = start
    } catch {
      /* ignore seek errors */
    }
    setCurrentTime(start)
    setPlaying(false)
  }, [getMediaElement])

  const seek = useCallback(
    (sec: number) => {
      const media = getMediaElement()
      if (!media || !Number.isFinite(sec)) return
      try {
        media.currentTime = sec
        setCurrentTime(sec)
      } catch {
        /* ignore seek errors */
      }
    },
    [getMediaElement],
  )

  const play = useCallback(
    (playOptions?: UseLocalMediaPlayerPlayOptions) => {
      const media = getMediaElement()
      if (!media) return

      const start = playOptions?.startSec ?? startSec ?? 0
      const end =
        playOptions?.endSec !== undefined
          ? playOptions.endSec
          : endSec !== undefined
            ? endSec
            : null

      activeRangeRef.current = { startSec: start, endSec: end }
      setError(null)

      try {
        media.currentTime = start
        setCurrentTime(start)
      } catch {
        /* ignore seek errors */
      }

      void media.play().catch(() => {
        setError('播放失败')
        setPlaying(false)
      })
    },
    [endSec, getMediaElement, startSec],
  )

  const toggle = useCallback(() => {
    const media = getMediaElement()
    if (!media) return
    if (media.paused) {
      play()
    } else {
      pause()
    }
  }, [getMediaElement, pause, play])

  return {
    ready,
    playing,
    currentTime,
    duration,
    error,
    play,
    pause,
    toggle,
    seek,
    stop,
  }
}

/** 格式化播放时间（秒 → m:ss.s） */
export function formatLocalMediaTimeLabel(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '0:00.0'
  const minutes = Math.floor(sec / 60)
  const seconds = sec % 60
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
}
