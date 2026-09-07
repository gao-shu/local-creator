// Copyright (c) Haode AI. All rights reserved.

import type { Node } from '@xyflow/react'
import { CANVAS_NODE_TYPES, type CanvasVideoNodeData } from '@/types/canvas-nodes'
import { formatCanvasTextNodeName } from '@/lib/canvas/canvas-prompt-naming'
import { resolveStoryboardShotNumber } from '@/lib/canvas/canvas-shot-utils'
import { formatCanvasVideoNodeName } from '@/lib/canvas/canvas-video-naming'
import { createCanvasNode } from '@/lib/canvas/canvas-node-factory'

export const GROUP_PADDING = 24
export const GROUP_HEADER = 36
export const GROUP_NODE_EST_WIDTH = 300
export const GROUP_NODE_EST_HEIGHT = 300

const EST_WIDTH = GROUP_NODE_EST_WIDTH
const EST_HEIGHT = GROUP_NODE_EST_HEIGHT

function isGroupNode(node: Node): boolean {
  return node.type === CANVAS_NODE_TYPES.group || node.type === 'group'
}

export function computeNodesBounds(nodes: Node[]): {
  x: number
  y: number
  width: number
  height: number
} {
  if (!nodes.length) {
    return { x: 0, y: 0, width: EST_WIDTH, height: EST_HEIGHT }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const node of nodes) {
    const width =
      typeof node.width === 'number'
        ? node.width
        : typeof node.style?.width === 'number'
          ? node.style.width
          : EST_WIDTH
    const height =
      typeof node.height === 'number'
        ? node.height
        : typeof node.style?.height === 'number'
          ? node.style.height
          : EST_HEIGHT

    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + width)
    maxY = Math.max(maxY, node.position.y + height)
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, EST_WIDTH),
    height: Math.max(maxY - minY, EST_HEIGHT),
  }
}

export function wrapNodesInGroup(
  selected: Node[],
  allNodes: Node[],
  label = '分组',
): Node[] {
  const targets = selected.filter((node) => !isGroupNode(node) && !node.parentId)
  if (!targets.length) return allNodes

  const bounds = computeNodesBounds(targets)
  const groupId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const groupX = bounds.x - GROUP_PADDING
  const groupY = bounds.y - GROUP_PADDING - GROUP_HEADER
  const groupWidth = bounds.width + GROUP_PADDING * 2
  const groupHeight = bounds.height + GROUP_PADDING * 2 + GROUP_HEADER

  const groupNode: Node = {
    ...createCanvasNode(CANVAS_NODE_TYPES.group, { x: groupX, y: groupY }, { label }),
    id: groupId,
    style: { width: groupWidth, height: groupHeight },
    zIndex: 0,
    draggable: true,
    selectable: true,
  }

  const targetIds = new Set(targets.map((node) => node.id))
  const repositioned = allNodes.map((node) => {
    if (!targetIds.has(node.id)) return node
    return {
      ...node,
      parentId: groupId,
      extent: 'parent' as const,
      expandParent: true,
      position: {
        x: node.position.x - groupX,
        y: node.position.y - groupY,
      },
      zIndex: 1,
    }
  })

  return [groupNode, ...repositioned]
}

export function createGroupForChildNodes(
  childNodes: Node[],
  absolutePosition: { x: number; y: number },
  label: string,
): { group: Node; children: Node[] } {
  const bounds = computeNodesBounds(
    childNodes.map((node) => ({ ...node, position: { x: node.position.x, y: node.position.y } })),
  )
  const groupId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const groupX = absolutePosition.x
  const groupY = absolutePosition.y
  const groupWidth = bounds.width + GROUP_PADDING * 2
  const groupHeight = bounds.height + GROUP_PADDING * 2 + GROUP_HEADER

  const group: Node = {
    ...createCanvasNode(CANVAS_NODE_TYPES.group, { x: groupX, y: groupY }, { label }),
    id: groupId,
    width: groupWidth,
    height: groupHeight,
    style: { width: groupWidth, height: groupHeight },
    zIndex: 0,
    draggable: true,
    selectable: true,
  }

  // childNodes 已是分组内局部坐标（从 0,0 起），勿再减 groupX/groupY
  const children = childNodes.map((node) => ({
    ...node,
    parentId: groupId,
    extent: 'parent' as const,
    expandParent: true,
    position: {
      x: node.position.x + GROUP_PADDING,
      y: node.position.y + GROUP_HEADER + GROUP_PADDING,
    },
    zIndex: 1,
  }))

  return { group, children }
}

export function expandNodeRemovals(nodes: Node[], removedIds: string[]): string[] {
  const ids = new Set(removedIds)
  let changed = true
  while (changed) {
    changed = false
    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id)
        changed = true
      }
    }
  }
  return Array.from(ids)
}

export function getNodeDisplayLabel(node: Node): string {
  const data = node.data as Record<string, unknown>
  if (node.type === CANVAS_NODE_TYPES.storyVideo) {
    const videoName = String(data.videoName || '').trim()
    if (videoName) return formatCanvasVideoNodeName(videoName)
    const shotNumber = resolveStoryboardShotNumber(data as CanvasVideoNodeData)
    if (shotNumber != null) {
      return formatCanvasVideoNodeName(`镜 ${shotNumber}`)
    }
  }
  if (node.type === CANVAS_NODE_TYPES.shotPrompt) {
    return formatCanvasTextNodeName(String(data.label || ''))
  }
  if (typeof data.label === 'string' && data.label.trim()) return data.label.trim()
  const shotNumber = resolveStoryboardShotNumber(data as CanvasVideoNodeData)
  if (shotNumber != null) return `镜 ${shotNumber}`
  switch (node.type) {
    case CANVAS_NODE_TYPES.shotPrompt:
      return 'Prompt'
    case CANVAS_NODE_TYPES.referenceImage:
      return '图片'
    case CANVAS_NODE_TYPES.imageNode:
      return '生图'
    case CANVAS_NODE_TYPES.storyVideo:
      return '生视频'
    case CANVAS_NODE_TYPES.voiceNode:
      return '音色'
    case CANVAS_NODE_TYPES.audioNode:
      return '音频'
    case CANVAS_NODE_TYPES.group:
      return '分组'
    case CANVAS_NODE_TYPES.note:
      return '备注'
    default:
      return String(node.type || '节点')
  }
}
