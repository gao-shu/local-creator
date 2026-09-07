// Copyright (c) Haode AI. All rights reserved.

import type { Node } from '@xyflow/react'
import { CANVAS_NODE_TYPES, type CanvasPromptNodeData } from '@/types/canvas-nodes'

/** 画布剧本文本节点（shotPrompt 及历史别名） */
export function isCanvasPromptTextNode(node: Node): boolean {
  const type = String(node.type || '')
  return (
    type === CANVAS_NODE_TYPES.shotPrompt ||
    type === 'textNode' ||
    type === 'storyPrompt'
  )
}

export function readCanvasPromptNodeContent(node: Node): string {
  return String((node.data as CanvasPromptNodeData).prompt || '').trim()
}

/** 智能分镜 / 提取资产的目标文本节点：优先单选，否则唯一文本节点 */
export function resolveCanvasPromptSourceNode(nodes: Node[]): {
  node: Node | null
  hint?: string
} {
  const selected = nodes.filter((node) => node.selected && isCanvasPromptTextNode(node))
  if (selected.length > 1) {
    return { node: null, hint: '请只选中一个文本节点' }
  }
  if (selected.length === 1) {
    return { node: selected[0]! }
  }

  const promptNodes = nodes.filter(isCanvasPromptTextNode)
  if (promptNodes.length === 1) {
    return { node: promptNodes[0]! }
  }
  if (promptNodes.length === 0) {
    return { node: null, hint: '请先添加文本节点并输入剧本' }
  }
  return { node: null, hint: '请先选中一个文本节点' }
}
