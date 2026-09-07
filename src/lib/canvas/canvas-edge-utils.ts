// Copyright (c) Haode AI. All rights reserved.

import type { Edge } from '@xyflow/react'

/** 画布节点默认左右连接点 id（与 CanvasNodeConnector 一致） */
export const CANVAS_EDGE_HANDLE_LEFT = 'left'
export const CANVAS_EDGE_HANDLE_RIGHT = 'right'

/** 连接点可见圆圈直径（px） */
export const CANVAS_CONNECTOR_VISUAL_PX = 26
/** 连线拖拽热区直径 = 圆圈半径 × 2（px） */
export const CANVAS_CONNECTOR_HIT_PX = CANVAS_CONNECTOR_VISUAL_PX * 2
/** React Flow 连线吸附半径，与热区一致 */
export const CANVAS_CONNECTION_RADIUS = CANVAS_CONNECTOR_HIT_PX
export function normalizeCanvasEdge(edge: Edge): Edge {
  return {
    ...edge,
    type: edge.type ?? 'canvas',
    selectable: edge.selectable ?? true,
    focusable: edge.focusable ?? true,
    sourceHandle: edge.sourceHandle ?? CANVAS_EDGE_HANDLE_RIGHT,
    targetHandle: edge.targetHandle ?? CANVAS_EDGE_HANDLE_LEFT,
  }
}

export function normalizeCanvasEdges(edges: Edge[]): Edge[] {
  return edges.map(normalizeCanvasEdge)
}
