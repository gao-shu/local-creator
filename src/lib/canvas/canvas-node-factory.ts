// Copyright (c) local-creator contributors. All rights reserved.

import type { Node } from '@xyflow/react'

export function createCanvasNode(
  type: string,
  position: { x: number; y: number },
  data: Record<string, unknown> = {},
): Node {
  const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  return {
    id,
    type,
    position,
    data,
  }
}
