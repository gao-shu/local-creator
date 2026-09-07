// Copyright (c) Haode AI. All rights reserved.

import type { Node } from '@xyflow/react'
import { CANVAS_NODE_TYPES, type CanvasPromptNodeData } from '@/types/canvas-nodes'

export const CANVAS_TEXT_NAME_PREFIX = '文本'

/** 文本节点标题色：与人物粉 / 视频青区分，对齐节点内 violet 分镜提示 */
export const CANVAS_TEXT_DEFAULT_NAME_COLOR = 'text-violet-600 dark:text-violet-400'

const CANVAS_TEXT_NAME_SEPARATOR = '  '

export function hasCanvasTextNamePrefix(name?: string | null): boolean {
  return String(name || '').trim().startsWith(CANVAS_TEXT_NAME_PREFIX)
}

/** 剥离「文本」前缀，返回主体名称 */
export function stripCanvasTextNamePrefix(name?: string | null): string {
  const trimmed = String(name || '').trim()
  if (!trimmed.startsWith(CANVAS_TEXT_NAME_PREFIX)) return trimmed
  return trimmed.slice(CANVAS_TEXT_NAME_PREFIX.length).trimStart()
}

/** 确保文本节点名称以「文本」+ 双空格开头（任务面板与节点标题统一） */
export function formatCanvasTextNodeName(name?: string | null): string {
  const body = stripCanvasTextNamePrefix(name)
  if (!body) return CANVAS_TEXT_NAME_PREFIX
  return `${CANVAS_TEXT_NAME_PREFIX}${CANVAS_TEXT_NAME_SEPARATOR}${body}`
}

/** 新建文本节点默认名称：文本  1 / 文本  2 … */
export function generateCanvasDefaultTextName(existingNames: string[] = []): string {
  const used = new Set(existingNames.map((name) => name.trim().toLowerCase()).filter(Boolean))
  for (let index = 1; index <= 999; index += 1) {
    const candidate = `${CANVAS_TEXT_NAME_PREFIX}${CANVAS_TEXT_NAME_SEPARATOR}${index}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
  return `${CANVAS_TEXT_NAME_PREFIX}${CANVAS_TEXT_NAME_SEPARATOR}${Date.now().toString().slice(-4)}`
}

export function collectCanvasPromptNodeLabels(nodes: Node[]): string[] {
  return nodes
    .filter((node) => node.type === CANVAS_NODE_TYPES.shotPrompt)
    .map((node) => formatCanvasTextNodeName((node.data as CanvasPromptNodeData).label))
    .filter(Boolean)
}

export function assignDefaultPromptNodeData(
  nodes: Node[],
  data?: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...(data ?? {}) }
  const existing = String(next.label || '').trim()
  if (existing) {
    next.label = formatCanvasTextNodeName(existing)
  } else {
    next.label = generateCanvasDefaultTextName(collectCanvasPromptNodeLabels(nodes))
  }
  return next
}

export function resolveCanvasTextDisplayName(options: {
  label?: string
}): { label: string } {
  return { label: formatCanvasTextNodeName(options.label) }
}

/** 为已有文本节点补全「文本」前缀或默认名称 */
export function backfillCanvasPromptNodeLabels(nodes: Node[]): { nodes: Node[]; changed: boolean } {
  const takenNames = collectCanvasPromptNodeLabels(nodes)
  let changed = false
  const next = nodes.map((node) => {
    if (node.type !== CANVAS_NODE_TYPES.shotPrompt) return node
    const data = node.data as CanvasPromptNodeData
    const raw = String(data.label || '').trim()
    const label = raw
      ? formatCanvasTextNodeName(raw)
      : generateCanvasDefaultTextName(takenNames)
    if (!raw) takenNames.push(label)
    if (label === raw) return node
    changed = true
    return { ...node, data: { ...data, label } }
  })
  return { nodes: changed ? next : nodes, changed }
}
