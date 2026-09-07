// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react'

const MIN_ASPECT = 9 / 16
const MAX_ASPECT = 16 / 9

function clampAspectRatio(ratio: number): number {
  return Math.max(MIN_ASPECT, Math.min(MAX_ASPECT, ratio))
}

/** 根据图片原始宽高比自适应预览框 */
export function useAdaptiveImageFrame(src: string | null | undefined) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null)

  useEffect(() => {
    if (!src) {
      setAspectRatio(null)
      return
    }
    const img = new Image()
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setAspectRatio(clampAspectRatio(img.naturalWidth / img.naturalHeight))
      }
    }
    img.src = src
  }, [src])

  const onImageLoad = useCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setAspectRatio(clampAspectRatio(img.naturalWidth / img.naturalHeight))
    }
  }, [])

  const frameStyle = useMemo(() => {
    if (!src || !aspectRatio) {
      return { aspectRatio: '1 / 1' as const }
    }
    return { aspectRatio: `${aspectRatio} / 1` as const }
  }, [aspectRatio, src])

  return { frameStyle, onImageLoad, hasAspect: Boolean(aspectRatio) }
}
