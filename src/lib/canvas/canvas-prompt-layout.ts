// Copyright (c) local-creator contributors. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import {
  CANVAS_GRAPH_NODE_GAP_Y,
  CANVAS_GRAPH_PROMPT_WIDTH,
  CANVAS_INLINE_SHOT_GAP_Y,
  resolveCanvasGraphNodeSize,
} from '@/lib/canvas/canvas-graph-layout'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'

import { CANVAS_IMAGE_PREVIEW_WIDTH_PX } from '@/lib/canvas/canvas-image-node-layout'

/** 与 canvas-image-node 预览宽一致 */
export const CANVAS_PROMPT_NODE_WIDTH = CANVAS_IMAGE_PREVIEW_WIDTH_PX
export const CANVAS_PROMPT_ASSET_NODE_WIDTH = CANVAS_PROMPT_NODE_WIDTH
/** 文本 → 资产列 / 资产列之间间距 */
export const CANVAS_PROMPT_COLUMN_GAP = 72
/** 提取资产：同列节点垂直间距（与 canvas-prompt-extract ROW_GAP 一致） */
export const CANVAS_PROMPT_ASSET_ROW_GAP = 56
/** 按 X 判定列归属时的容差（px） */
export const CANVAS_PROMPT_COLUMN_X_TOLERANCE = 48

export type CanvasPromptLayoutColumn = 'character' | 'scene' | 'storyboard'

/** 剧本文本右侧三列：角色资产 | 场景资产 | 分镜视频 */
export function resolveCanvasPromptColumnX(sourceX: number): {
  characterColX: number
  sceneColX: number
  storyboardColX: number
} {
  const characterColX = sourceX + CANVAS_GRAPH_PROMPT_WIDTH + CANVAS_PROMPT_COLUMN_GAP
  const sceneColX = characterColX + CANVAS_PROMPT_ASSET_NODE_WIDTH + CANVAS_PROMPT_COLUMN_GAP
  const storyboardColX = sceneColX + CANVAS_PROMPT_ASSET_NODE_WIDTH + CANVAS_PROMPT_COLUMN_GAP
  return { characterColX, sceneColX, storyboardColX }
}

function collectDirectNeighborNodeIds(sourceNodeId: string, edges: Edge[]): Set<string> {
  const ids = new Set<string>()
  for (const edge of edges) {
    if (edge.source === sourceNodeId) ids.add(edge.target)
    if (edge.target === sourceNodeId) ids.add(edge.source)
  }
  return ids
}

export function resolveCanvasPromptColumnAtX(
  sourceX: number,
  nodeX: number,
): CanvasPromptLayoutColumn | null {
  const { characterColX, sceneColX, storyboardColX } = resolveCanvasPromptColumnX(sourceX)
  const tolerance = CANVAS_PROMPT_COLUMN_X_TOLERANCE
  if (Math.abs(nodeX - characterColX) <= tolerance) return 'character'
  if (Math.abs(nodeX - sceneColX) <= tolerance) return 'scene'
  if (Math.abs(nodeX - storyboardColX) <= tolerance) return 'storyboard'
  return null
}

/** 分镜视频节点在列内占用的垂直高度（与 CANVAS_INLINE_SHOT_GAP_Y 一致，含标题行） */
export function resolveCanvasStoryVideoStackHeight(node: Node): number {
  const measured =
    typeof node.height === 'number'
      ? node.height
      : typeof node.style?.height === 'number'
        ? node.style.height
        : null
  if (node.type === CANVAS_NODE_TYPES.storyVideo) {
    return measured ?? CANVAS_INLINE_SHOT_GAP_Y - CANVAS_GRAPH_NODE_GAP_Y
  }
  return measured ?? resolveCanvasGraphNodeSize(node.type, node.data as Record<string, unknown>).height
}

function resolveCanvasGraphNodeBottom(node: Node): number {
  return node.position.y + resolveCanvasStoryVideoStackHeight(node)
}

function nodeMatchesPromptColumn(
  node: Node,
  sourceX: number,
  column: CanvasPromptLayoutColumn,
): boolean {
  const col = resolveCanvasPromptColumnAtX(sourceX, node.position.x)
  if (col !== column) return false
  if (column === 'storyboard') return node.type === CANVAS_NODE_TYPES.storyVideo
  return node.type === CANVAS_NODE_TYPES.imageNode
}

/** 文本节点某一列已连线子节点的最大底边 Y；无节点时返回 null */
export function resolveCanvasPromptColumnBottom(
  sourceNode: Node,
  column: CanvasPromptLayoutColumn,
  nodes: Node[],
  edges: Edge[],
): number | null {
  const connectedIds = collectDirectNeighborNodeIds(sourceNode.id, edges)
  const sourceX = sourceNode.position.x
  let maxBottom: number | null = null

  for (const node of nodes) {
    if (!connectedIds.has(node.id)) continue
    if (!nodeMatchesPromptColumn(node, sourceX, column)) continue
    const bottom = resolveCanvasGraphNodeBottom(node)
    maxBottom = maxBottom === null ? bottom : Math.max(maxBottom, bottom)
  }

  return maxBottom
}

/** 智能分镜：第 3 列新批次起始 Y（重复分镜时接在已有镜下方） */
export function resolveCanvasPromptStoryboardStartY(
  sourceNode: Node,
  nodes: Node[],
  edges: Edge[],
  gap = CANVAS_GRAPH_NODE_GAP_Y,
): number {
  const baseY = sourceNode.position.y
  const columnBottom = resolveCanvasPromptColumnBottom(sourceNode, 'storyboard', nodes, edges)
  if (columnBottom === null) return baseY
  return columnBottom + gap
}

/** 提取资产：角色 / 场景列新批次起始 Y（重复提取时接在已有资产下方） */
export function resolveCanvasPromptAssetColumnStartY(
  sourceNode: Node,
  column: 'character' | 'scene',
  nodes: Node[],
  edges: Edge[],
  gap = CANVAS_PROMPT_ASSET_ROW_GAP,
): number {
  const baseY = sourceNode.position.y
  const columnBottom = resolveCanvasPromptColumnBottom(sourceNode, column, nodes, edges)
  if (columnBottom === null) return baseY
  return columnBottom + gap
}
