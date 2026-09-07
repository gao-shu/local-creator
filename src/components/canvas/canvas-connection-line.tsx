// Copyright (c) local-creator contributors. All rights reserved.

import { getBezierPath, type ConnectionLineComponentProps } from '@xyflow/react'

/**
 * 拖拽连线预览：RF 传入的 fromX/toX 已是 handle 中心（或鼠标坐标），
 * 不要再做 canvasConnectorCenterX 偏移（否则贝塞尔切线方向会多出左右一截）。
 * 已完成连线的端点补偿见 CanvasDeletableEdge。
 */
export function CanvasConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  connectionLineStyle,
}: ConnectionLineComponentProps) {
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
    sourcePosition: fromPosition,
    targetPosition: toPosition,
  })

  return (
    <path
      fill="none"
      className="react-flow__connection-path"
      d={path}
      style={connectionLineStyle}
    />
  )
}
