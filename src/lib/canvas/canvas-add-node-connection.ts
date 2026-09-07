// Copyright (c) local-creator contributors. All rights reserved.

import { addEdge, type Edge, type FinalConnectionState } from '@xyflow/react'
import { CANVAS_EDGE_HANDLE_LEFT, CANVAS_EDGE_HANDLE_RIGHT } from '@/lib/canvas/canvas-edge-utils'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import { createCanvasNode } from '@/lib/canvas/canvas-node-factory'

/** 从节点 + 号发起添加时的连线方向 */
export type CanvasAddNodeConnection =
  | { direction: 'source'; nodeId: string; handleId?: string }
  | { direction: 'target'; nodeId: string; handleId?: string }

export function buildCanvasAddNodeConnectionFromConnectState(
  connectionState: FinalConnectionState,
): CanvasAddNodeConnection | null {
  const fromNode = connectionState.fromNode
  if (!fromNode) return null

  const handleType = connectionState.fromHandle?.type
  const handleId =
    connectionState.fromHandleId ??
    (handleType === 'target' ? CANVAS_EDGE_HANDLE_LEFT : CANVAS_EDGE_HANDLE_RIGHT)

  if (handleType === 'target') {
    return { direction: 'target', nodeId: fromNode.id, handleId }
  }
  return { direction: 'source', nodeId: fromNode.id, handleId }
}

/** 连线拖到空白处松手：等同右键添加节点（带预置连线） */
export function shouldOpenAddNodeMenuOnConnectEnd(
  connectionState: FinalConnectionState,
  frameSnapAction: 'none' | 'snap',
): boolean {
  if (frameSnapAction === 'snap') return false
  if (!connectionState.fromNode) return false
  if (connectionState.isValid && connectionState.toNode) return false
  return true
}

export function buildCanvasNodeDefaultData(type: string): Record<string, unknown> {
  if (type === CANVAS_NODE_TYPES.shotPrompt) return { prompt: '' }
  if (type === CANVAS_NODE_TYPES.note) return { label: '备注' }
  if (type === CANVAS_NODE_TYPES.voiceNode) return { label: '音色' }
  if (type === CANVAS_NODE_TYPES.audioNode) return { label: '音频', audioRelativePath: '' }
  return {}
}

export function createConnectedCanvasNode(
  type: string,
  position: { x: number; y: number },
  connection?: CanvasAddNodeConnection | null,
  extraData?: Record<string, unknown>,
): { node: ReturnType<typeof createCanvasNode>; edge: Edge | null } {
  const node = createCanvasNode(type, position, {
    ...buildCanvasNodeDefaultData(type),
    ...extraData,
  })
  if (!connection) {
    return { node, edge: null }
  }

  if (connection.direction === 'source') {
    return {
      node,
      edge: {
        id: `e_${connection.nodeId}_${node.id}`,
        type: 'canvas',
        source: connection.nodeId,
        sourceHandle: connection.handleId ?? CANVAS_EDGE_HANDLE_RIGHT,
        target: node.id,
        targetHandle: CANVAS_EDGE_HANDLE_LEFT,
      },
    }
  }

  return {
    node,
    edge: {
      id: `e_${node.id}_${connection.nodeId}`,
      type: 'canvas',
      source: node.id,
      sourceHandle: CANVAS_EDGE_HANDLE_RIGHT,
      target: connection.nodeId,
      targetHandle: connection.handleId ?? CANVAS_EDGE_HANDLE_LEFT,
    },
  }
}

export function appendConnectedNodeEdge(
  edges: Edge[],
  edge: Edge | null,
): Edge[] {
  if (!edge) return edges
  return addEdge(edge, edges)
}
