// Copyright (c) local-creator contributors. All rights reserved.

import { Position } from '@xyflow/react'
import { CANVAS_CONNECTOR_HIT_PX } from '@/lib/canvas/canvas-edge-utils'

/** 热区居中在框边，RF 取外缘；补偿到热区中心 = 圆圈十字中心 */
export function canvasConnectorCenterX(x: number, position: Position): number {
  const half = CANVAS_CONNECTOR_HIT_PX / 2
  if (position === Position.Left) return x + half
  if (position === Position.Right) return x - half
  return x
}
