// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react'

const MIN_ASPECT = 9 / 16
const MAX_ASPECT = 16 / 9

function clampAspectRatio(ratio: number): number {
  return Math.max(MIN_ASPECT, Math.min(MAX_ASPECT, ratio))
}

function parseAspectRatioParam(value: string | undefined): number {
  if (!value) return 16 / 9
  const parts = value.split(':').map(Number)
  if (parts.length === 2 && parts[0]! > 0 && parts[1]! > 0) {
    return clampAspectRatio(parts[0]! / parts[1]!)
  }
  return 16 / 9
}

/** 根据视频原始宽高比自适应预览框；无视频时用 fallbackRatio（如 16:9） */
export function useAdaptiveVideoFrame(
  src: string | null | undefined,
  fallbackRatio?: string,
  options?: {
    adaptToSource?: boolean
    /** 横屏/方形：固定预览高度 */
    anchorHeightPx?: number
    /** 竖屏：固定预览宽度（与图片一致） */
    anchorWidthPx?: number
    /** nodeData 已存画幅，在视频 metadata 未就绪前用于稳定尺寸 */
    storedAspectRatio?: string
  },
) {
  const adaptToSource = options?.adaptToSource !== false
  const anchorHeightPx = options?.anchorHeightPx
  const anchorWidthPx = options?.anchorWidthPx
  const storedRatio = parseAspectRatioParam(options?.storedAspectRatio)
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)
  const fallback = parseAspectRatioParam(fallbackRatio)

  useEffect(() => {
    if (!adaptToSource || !src) {
      setAspectRatio(null)
      return
    }
    const video = document.createElement('video')
    video.preload = 'metadata'
    const handleMeta = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setAspectRatio(clampAspectRatio(video.videoWidth / video.videoHeight))
      }
    }
    video.addEventListener('loadedmetadata', handleMeta)
    video.src = src
    return () => {
      video.removeEventListener('loadedmetadata', handleMeta)
      video.src = ''
    }
  }, [adaptToSource, src])

  const onVideoLoadedMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      if (!adaptToSource) return
      const video = event.currentTarget
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setAspectRatio(clampAspectRatio(video.videoWidth / video.videoHeight))
      }
    },
    [adaptToSource],
  )

  const frameStyle = useMemo(() => {
    if (anchorHeightPx != null || anchorWidthPx != null) {
      const ratio =
        adaptToSource && src ? (aspectRatio ?? storedRatio) : fallback
      const isPortrait = ratio < 1
      if (isPortrait && anchorWidthPx != null) {
        return {
          width: anchorWidthPx,
          height: Math.round(anchorWidthPx / ratio),
          marginLeft: 'auto',
          marginRight: 'auto',
        } as const
      }
      const height = anchorHeightPx ?? anchorWidthPx!
      return {
        height,
        width: Math.round(height * ratio),
        marginLeft: 'auto',
        marginRight: 'auto',
      } as const
    }
    // 有成片时外框只跟视频真实宽高比走；元数据未就绪前用 16:9 占位，避免 nodeData 归一化标签（如 1:1）撑出黑边
    if (adaptToSource && src) {
      const ratio = aspectRatio ?? 16 / 9
      return { aspectRatio: `${ratio} / 1` as const }
    }
    return { aspectRatio: `${fallback} / 1` as const }
  }, [adaptToSource, anchorHeightPx, anchorWidthPx, aspectRatio, fallback, src, storedRatio])

  const previewWidth = useMemo(() => {
    if (typeof frameStyle.width === 'number') return frameStyle.width
    return anchorWidthPx ?? anchorHeightPx ?? 320
  }, [anchorHeightPx, anchorWidthPx, frameStyle])

  return { frameStyle, onVideoLoadedMetadata, previewWidth }
}
