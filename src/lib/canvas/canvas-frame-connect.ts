// Copyright (c) local-creator contributors. All rights reserved.

import type { Connection, FinalConnectionState, Node } from '@xyflow/react'
import {
  CANVAS_CONNECTION_RADIUS,
  CANVAS_CONNECTOR_HIT_PX,
  CANVAS_EDGE_HANDLE_LEFT,
  CANVAS_EDGE_HANDLE_RIGHT,
} from '@/lib/canvas/canvas-edge-utils'
import {
  CANVAS_IMAGE_PREVIEW_WIDTH_PX,
  resolveCanvasVideoPreviewDimensions,
} from '@/lib/canvas/canvas-image-node-layout'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'

const FRAME_CONNECT_TARGET_TYPES = new Set<string>([
  CANVAS_NODE_TYPES.imageNode,
  CANVAS_NODE_TYPES.storyVideo,
])

function resolveCanvasVideoPreviewHeight(aspectRatio?: string): number {
  return resolveCanvasVideoPreviewDimensions(aspectRatio).height
}

function resolveCanvasVideoDefaultPreviewWidth(aspectRatio?: string): number {
  return resolveCanvasVideoPreviewDimensions(aspectRatio).width
}

/** 与 canvas-image-node / canvas-video-node 标题区一致：12px 行高 + 2px 间距 */
const CANVAS_MEDIA_NODE_TITLE_HEIGHT = 14

/** 图片节点预览最大高度（16:9） */
const CANVAS_IMAGE_MAX_PREVIEW_HEIGHT = Math.round(CANVAS_IMAGE_PREVIEW_WIDTH_PX * (16 / 9))

interface CanvasFrameConnectBounds {
  x: number
  y: number
  width: number
  height: number
  handleAnchor: { x: number; y: number }
}

export function isCanvasFrameConnectTarget(node: Node | null | undefined): boolean {
  return Boolean(node?.type && FRAME_CONNECT_TARGET_TYPES.has(node.type))
}

function getCanvasNodeSize(node: Node): { width: number; height: number } {
  const measured = node.measured
  const width =
    measured?.width ?? (typeof node.width === 'number' ? node.width : Number(node.style?.width) || 0)
  const height =
    measured?.height ??
    (typeof node.height === 'number' ? node.height : Number(node.style?.height) || 0)
  return { width, height }
}

function resolveNodeAbsolutePosition(
  node: Node,
  nodeById: Map<string, Node>,
): { x: number; y: number } {
  let x = node.position.x
  let y = node.position.y
  let current = node
  while (current.parentId) {
    const parent = nodeById.get(current.parentId)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    current = parent
  }
  return { x, y }
}

function resolveMediaPreviewBounds(node: Node): { width: number; previewHeight: number } {
  const measured = getCanvasNodeSize(node)
  const width =
    measured.width > 0
      ? measured.width
      : node.type === CANVAS_NODE_TYPES.storyVideo
        ? resolveCanvasVideoDefaultPreviewWidth(
            (node.data as { aspectRatio?: string }).aspectRatio,
          )
        : CANVAS_IMAGE_PREVIEW_WIDTH_PX

  if (measured.height > CANVAS_MEDIA_NODE_TITLE_HEIGHT) {
    const rawPreviewHeight = measured.height - CANVAS_MEDIA_NODE_TITLE_HEIGHT
    const maxPreviewHeight =
      node.type === CANVAS_NODE_TYPES.storyVideo
        ? resolveCanvasVideoPreviewHeight(
            (node.data as { aspectRatio?: string }).aspectRatio,
          )
        : CANVAS_IMAGE_MAX_PREVIEW_HEIGHT
    return {
      width,
      previewHeight: Math.min(rawPreviewHeight, maxPreviewHeight),
    }
  }

  return {
    width,
    previewHeight:
      node.type === CANVAS_NODE_TYPES.storyVideo
        ? resolveCanvasVideoPreviewHeight(
            (node.data as { aspectRatio?: string }).aspectRatio,
          )
        : CANVAS_IMAGE_MAX_PREVIEW_HEIGHT,
  }
}

/** 连线吸附仅使用预览框（不含控制台等绝对浮层），避免多节点垂直堆叠时 hitbox 重叠误连 */
export function resolveCanvasFrameConnectBounds(
  node: Node,
  nodeById: Map<string, Node>,
): CanvasFrameConnectBounds | null {
  if (!isCanvasFrameConnectTarget(node)) return null

  const abs = resolveNodeAbsolutePosition(node, nodeById)
  const { width, previewHeight } = resolveMediaPreviewBounds(node)
  const height = CANVAS_MEDIA_NODE_TITLE_HEIGHT + previewHeight

  return {
    x: abs.x,
    y: abs.y,
    width,
    height,
    handleAnchor: {
      x: abs.x,
      y: abs.y + CANVAS_MEDIA_NODE_TITLE_HEIGHT + previewHeight / 2,
    },
  }
}

function isPointInConnectBounds(
  point: { x: number; y: number },
  bounds: CanvasFrameConnectBounds,
  padding = 0,
): boolean {
  return (
    point.x >= bounds.x - padding &&
    point.x <= bounds.x + bounds.width + padding &&
    point.y >= bounds.y - padding &&
    point.y <= bounds.y + bounds.height + padding
  )
}

function distanceSquaredToRect(
  point: { x: number; y: number },
  bounds: CanvasFrameConnectBounds,
): number {
  const right = bounds.x + bounds.width
  const bottom = bounds.y + bounds.height
  const closestX = Math.max(bounds.x, Math.min(point.x, right))
  const closestY = Math.max(bounds.y, Math.min(point.y, bottom))
  const dx = point.x - closestX
  const dy = point.y - closestY
  return dx * dx + dy * dy
}

function distanceSquaredBetweenPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

/** 左右连接点中心（锚在预览框外 translate ±50% 热区，与 CanvasNodeConnector 一致） */
function resolveCanvasFrameHandleCenters(bounds: CanvasFrameConnectBounds): {
  left: { x: number; y: number }
  right: { x: number; y: number }
} {
  const halfHit = CANVAS_CONNECTOR_HIT_PX / 2
  const y = bounds.handleAnchor.y
  return {
    left: { x: bounds.x - halfHit, y },
    right: { x: bounds.x + bounds.width + halfHit, y },
  }
}

/** 松手点到该节点最近连接点的距离平方 */
function nearestHandleDistanceSquared(
  point: { x: number; y: number },
  bounds: CanvasFrameConnectBounds,
): number {
  const handles = resolveCanvasFrameHandleCenters(bounds)
  return Math.min(
    distanceSquaredBetweenPoints(point, handles.left),
    distanceSquaredBetweenPoints(point, handles.right),
  )
}

function isPointerNearCanvasFrameHandle(
  point: { x: number; y: number },
  bounds: CanvasFrameConnectBounds,
): boolean {
  const radiusSq = CANVAS_CONNECTION_RADIUS * CANVAS_CONNECTION_RADIUS
  return nearestHandleDistanceSquared(point, bounds) <= radiusSq
}

/** 预览框正中心落点（用于区分「点预览区」与「点连接点」） */
function isPointerInPreviewBody(
  point: { x: number; y: number },
  bounds: CanvasFrameConnectBounds,
): boolean {
  if (!isPointInConnectBounds(point, bounds, 0)) return false
  const handlePad = CANVAS_CONNECTOR_HIT_PX / 2
  return (
    point.x > bounds.x + handlePad &&
    point.x < bounds.x + bounds.width - handlePad
  )
}

/** 松手坐标下应吸附的图片/视频节点：优先最近连接点，预览区落点次之 */
export function findCanvasFrameConnectTargetAtPoint(
  nodes: Node[],
  point: { x: number; y: number },
): Node | null {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const radiusSq = CANVAS_CONNECTION_RADIUS * CANVAS_CONNECTION_RADIUS
  let bestNode: Node | null = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const node of nodes) {
    const bounds = resolveCanvasFrameConnectBounds(node, nodeById)
    if (!bounds) continue

    const handleDistance = nearestHandleDistanceSquared(point, bounds)
    const insidePreview = isPointInConnectBounds(point, bounds, 0)

    let score: number
    if (handleDistance <= radiusSq) {
      score = handleDistance
    } else if (insidePreview) {
      score = distanceSquaredToRect(point, bounds) + 1_000_000
    } else {
      continue
    }

    if (score < bestScore) {
      bestScore = score
      bestNode = node
    }
  }

  return bestNode
}

export function buildCanvasFrameSnapConnection(params: {
  fromNodeId: string
  fromHandleId: string
  fromHandleType: 'source' | 'target'
  targetNodeId: string
}): Connection {
  const { fromNodeId, fromHandleId, fromHandleType, targetNodeId } = params

  if (fromHandleType === 'source') {
    return {
      source: fromNodeId,
      sourceHandle: fromHandleId || CANVAS_EDGE_HANDLE_RIGHT,
      target: targetNodeId,
      targetHandle: CANVAS_EDGE_HANDLE_LEFT,
    }
  }

  return {
    source: targetNodeId,
    sourceHandle: CANVAS_EDGE_HANDLE_RIGHT,
    target: fromNodeId,
    targetHandle: fromHandleId || CANVAS_EDGE_HANDLE_LEFT,
  }
}

export function hasCanvasConnectionPair(
  edges: { source: string; target: string }[],
  source: string,
  target: string,
): boolean {
  return edges.some((edge) => edge.source === source && edge.target === target)
}

export function resolveCanvasFrameConnectEnd(params: {
  nodes: Node[]
  edges: { source: string; target: string }[]
  connectionState: FinalConnectionState
}):
  | { action: 'none' }
  | {
      action: 'snap'
      connection: Connection
      replace?: { source: string; target: string }
    } {
  const { nodes, edges, connectionState } = params
  if (!connectionState.fromNode || !connectionState.fromHandle?.type) {
    return { action: 'none' }
  }

  const point = connectionState.pointer ?? connectionState.to
  if (!point) return { action: 'none' }

  const snapTarget = findCanvasFrameConnectTargetAtPoint(nodes, point)
  if (!snapTarget || snapTarget.id === connectionState.fromNode.id) {
    return { action: 'none' }
  }

  const fromHandleId =
    connectionState.fromHandleId ??
    (connectionState.fromHandle.type === 'source'
      ? CANVAS_EDGE_HANDLE_RIGHT
      : CANVAS_EDGE_HANDLE_LEFT)

  const connection = buildCanvasFrameSnapConnection({
    fromNodeId: connectionState.fromNode.id,
    fromHandleId,
    fromHandleType: connectionState.fromHandle.type,
    targetNodeId: snapTarget.id,
  })

  if (connectionState.isValid) {
    if (connectionState.toNode?.id === snapTarget.id) return { action: 'none' }

    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const toNode = connectionState.toNode
    const snapBounds = resolveCanvasFrameConnectBounds(snapTarget, nodeById)
    const pointerOnSnapPreviewBody =
      snapBounds != null && isPointerInPreviewBody(point, snapBounds)

    // 已命中连接点且落点不在另一节点预览区：信任 React Flow，避免相邻节点误替换
    if (
      toNode &&
      isCanvasFrameConnectTarget(toNode) &&
      !pointerOnSnapPreviewBody
    ) {
      const toBounds = resolveCanvasFrameConnectBounds(toNode, nodeById)
      if (toBounds && isPointerNearCanvasFrameHandle(point, toBounds)) {
        return { action: 'none' }
      }
    }

    const wrongSource =
      connectionState.fromHandle.type === 'source'
        ? connectionState.fromNode.id
        : connectionState.toNode?.id
    const wrongTarget =
      connectionState.fromHandle.type === 'source'
        ? connectionState.toNode?.id
        : connectionState.fromNode.id
    if (!wrongSource || !wrongTarget) return { action: 'none' }

    return {
      action: 'snap',
      connection,
      replace: { source: wrongSource, target: wrongTarget },
    }
  }

  if (hasCanvasConnectionPair(edges, connection.source!, connection.target!)) {
    return { action: 'none' }
  }

  return { action: 'snap', connection }
}
