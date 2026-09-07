// Copyright (c) local-creator contributors. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import { isCanvasApiAvailable, patchCanvasData } from '@/lib/storage/canvas-service'

export interface CanvasProjectRunBridge {
  patchNode: (
    nodeId: string,
    patch: Record<string, unknown>,
    options?: { flush?: boolean },
  ) => void
  markNodeRunning: (nodeId: string) => void
  markNodeIdle: (nodeId: string) => void
  getNodes: () => Node[]
  appendGraph?: (nodes: Node[], edges: Edge[]) => void
  removeNodesByIds?: (nodeIds: string[], options?: { silent?: boolean }) => void
  reloadFromDisk?: () => Promise<void>
}

const bridges = new Map<string, CanvasProjectRunBridge>()

export function registerCanvasProjectRunBridge(
  projectId: string,
  bridge: CanvasProjectRunBridge,
): () => void {
  bridges.set(projectId, bridge)
  return () => {
    if (bridges.get(projectId) === bridge) {
      bridges.delete(projectId)
    }
  }
}

export function getCanvasProjectRunBridge(projectId: string): CanvasProjectRunBridge | undefined {
  return bridges.get(projectId)
}

export function patchCanvasNodeData(
  projectId: string,
  nodeId: string,
  patch: Record<string, unknown>,
  options?: { flush?: boolean },
): void {
  bridges.get(projectId)?.patchNode(nodeId, patch, options)
}

/** 编辑器未挂载时，将节点补丁直接写入画布项目文件 */
export async function patchCanvasNodeDataPersisted(
  projectId: string,
  nodeId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const bridge = bridges.get(projectId)
  if (bridge) {
    bridge.patchNode(nodeId, patch, { flush: true })
    return
  }
  if (!isCanvasApiAvailable()) return
  try {
    await patchCanvasData(projectId, (current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    }))
  } catch {
    /* 后台完成时写入失败可忽略，用户重新进入会走中断恢复 */
  }
}
