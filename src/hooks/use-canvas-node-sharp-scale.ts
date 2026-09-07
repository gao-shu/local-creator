// Copyright (c) Haode AI. All rights reserved.

import { useMemo, type CSSProperties } from 'react'
import { useViewport } from '@xyflow/react'

type SharpScaleOrigin =
  | 'top left'
  | 'top right'
  | 'top center'
  | 'center'
  | 'bottom right'
  | 'bottom left'
  | 'bottom center'

interface UseCanvasNodeSharpScaleOptions {
  transformOrigin?: SharpScaleOrigin
  /** 与反缩放组合的 transform，如 translateX(-50%) */
  extraTransform?: string
}

/** 抵消 React Flow 画布缩放，避免节点内悬浮按钮/文字发糊 */
export function useCanvasNodeSharpScale(options: UseCanvasNodeSharpScaleOptions = {}) {
  const { zoom } = useViewport()
  const transformOrigin = options.transformOrigin ?? 'top right'
  const extraTransform = options.extraTransform?.trim()

  return useMemo(() => {
    const inverseScale = 1 / zoom
    const scalePart = `scale(${inverseScale})`
    const transform = extraTransform ? `${extraTransform} ${scalePart}` : scalePart
    const style: CSSProperties = {
      transform,
      transformOrigin,
    }
    return { zoom, inverseScale, style }
  }, [zoom, transformOrigin, extraTransform])
}
