// Copyright (c) Haode AI. All rights reserved.

import type { Edge, Node } from '@xyflow/react'

const PASTE_OFFSET = 40

export function cloneCanvasSelection(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } | null {
  const selected = nodes.filter((node) => node.selected)
  if (!selected.length) return null

  const selectedIds = new Set(selected.map((node) => node.id))
  const idMap = new Map<string, string>()
  const stamp = Date.now()

  const clonedNodes = selected.map((node, index) => {
    const nextId = `${node.type}_${stamp}_${index}`
    idMap.set(node.id, nextId)
    return {
      ...node,
      id: nextId,
      selected: true,
      position: {
        x: node.position.x + PASTE_OFFSET,
        y: node.position.y + PASTE_OFFSET,
      },
      data: { ...node.data },
    }
  })

  const clonedEdges = edges
    .filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    .map((edge, index) => ({
      ...edge,
      id: `e_clip_${stamp}_${index}`,
      source: idMap.get(edge.source) || edge.source,
      target: idMap.get(edge.target) || edge.target,
    }))

  return { nodes: clonedNodes, edges: clonedEdges }
}

export function deselectAllNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => ({ ...node, selected: false }))
}

/** 复制单个节点（偏移放置，不含连线） */
export function cloneSingleCanvasNode(node: Node, offset = PASTE_OFFSET): Node {
  const stamp = Date.now()
  return {
    ...node,
    id: `${node.type}_${stamp}_dup`,
    selected: true,
    position: {
      x: node.position.x + offset,
      y: node.position.y + offset,
    },
    data: { ...node.data },
  }
}
