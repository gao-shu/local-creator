// Copyright (c) Haode AI. All rights reserved.

import type { Connection, Node } from '@xyflow/react'
import { isCanvasCharacterImageNode } from '@/lib/canvas/canvas-image-character'
import { CANVAS_NODE_TYPES, type CanvasImageNodeData } from '@/types/canvas-nodes'

/** 非法音色绑定时的用户提示（L3 建边拦截复用） */
export const CANVAS_VOICE_BIND_ONLY_FROM_CHARACTER =
  '音色只能由人物节点连入' as const

function isCanvasVoiceNode(node: Node | null | undefined): boolean {
  return Boolean(node && node.type === CANVAS_NODE_TYPES.voiceNode)
}

function isCanvasCharacterImageGraphNode(node: Node | null | undefined): boolean {
  if (!node || node.type !== CANVAS_NODE_TYPES.imageNode) return false
  return isCanvasCharacterImageNode(node.data as CanvasImageNodeData)
}

/**
 * 轻薄方案：仅允许「人物 → 音色」绑定连线。
 * source / target 为画布节点（非 handle id）。
 */
export function canBindVoiceFromCharacter(
  source: Node | null | undefined,
  target: Node | null | undefined,
): boolean {
  if (!source || !target || source.id === target.id) return false
  return isCanvasCharacterImageGraphNode(source) && isCanvasVoiceNode(target)
}

/** 连线任一端为音色节点 */
export function involvesCanvasVoiceNode(
  source: Node | null | undefined,
  target: Node | null | undefined,
): boolean {
  return isCanvasVoiceNode(source) || isCanvasVoiceNode(target)
}

/**
 * 建边是否允许：与音色无关的边一律放行；
 * 涉及音色时必须满足「人物 → 音色」。
 */
export function isCanvasVoiceAwareConnectionAllowed(
  source: Node | null | undefined,
  target: Node | null | undefined,
): boolean {
  if (!involvesCanvasVoiceNode(source, target)) return true
  return canBindVoiceFromCharacter(source, target)
}

export function resolveCanvasConnectionEndpoints(
  connection: Pick<Connection, 'source' | 'target'>,
  nodes: Node[],
): { source: Node | undefined; target: Node | undefined } {
  const sourceId = String(connection.source || '').trim()
  const targetId = String(connection.target || '').trim()
  return {
    source: sourceId ? nodes.find((node) => node.id === sourceId) : undefined,
    target: targetId ? nodes.find((node) => node.id === targetId) : undefined,
  }
}
