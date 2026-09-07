// Copyright (c) Haode AI. All rights reserved.

import type { Node } from '@xyflow/react'
import { CANVAS_NODE_TYPES, type CanvasVideoNodeData } from '@/types/canvas-nodes'

export const CANVAS_VIDEO_DEFAULT_NAME_COLOR = 'text-cyan-600 dark:text-cyan-400'

export const CANVAS_VIDEO_NAME_PREFIX = '视频'

const CANVAS_VIDEO_NAME_SEPARATOR = '  '

export function hasCanvasVideoNamePrefix(name?: string | null): boolean {
  return String(name || '').trim().startsWith(CANVAS_VIDEO_NAME_PREFIX)
}

/** 剥离「视频」前缀，返回主体名称 */
export function stripCanvasVideoNamePrefix(name?: string | null): string {
  const trimmed = String(name || '').trim()
  if (!trimmed.startsWith(CANVAS_VIDEO_NAME_PREFIX)) return trimmed
  return trimmed.slice(CANVAS_VIDEO_NAME_PREFIX.length).trimStart()
}

/** 确保视频节点名称以「视频」+ 双空格开头（任务面板与节点标题统一） */
export function formatCanvasVideoNodeName(name?: string | null): string {
  const body = stripCanvasVideoNamePrefix(name)
  if (!body) return CANVAS_VIDEO_NAME_PREFIX
  return `${CANVAS_VIDEO_NAME_PREFIX}${CANVAS_VIDEO_NAME_SEPARATOR}${body}`
}

/** 新建视频节点默认名称：视频  1 / 视频  2 … */
export function generateCanvasDefaultVideoName(existingNames: string[] = []): string {
  const used = new Set(existingNames.map((name) => name.trim().toLowerCase()).filter(Boolean))
  for (let index = 1; index <= 999; index += 1) {
    const candidate = `${CANVAS_VIDEO_NAME_PREFIX}${CANVAS_VIDEO_NAME_SEPARATOR}${index}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
  return `${CANVAS_VIDEO_NAME_PREFIX}${CANVAS_VIDEO_NAME_SEPARATOR}${Date.now().toString().slice(-4)}`
}

export function collectCanvasVideoNodeNames(nodes: Node[]): string[] {
  return nodes
    .filter((node) => node.type === CANVAS_NODE_TYPES.storyVideo)
    .map((node) => String((node.data as CanvasVideoNodeData).videoName || '').trim())
    .filter(Boolean)
}

export function assignDefaultVideoNodeData(
  nodes: Node[],
  data?: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...(data ?? {}) }
  const existing = String(next.videoName || '').trim()
  if (existing) {
    next.videoName = formatCanvasVideoNodeName(existing)
  } else {
    next.videoName = generateCanvasDefaultVideoName(collectCanvasVideoNodeNames(nodes))
  }
  return next
}

export function resolveCanvasVideoDisplayName(options: {
  videoName?: string
}): {
  nickname: string
  rolePrefix: string
  label: string
  colorClass: string
} {
  const raw = String(options.videoName || '').trim()
  const label = formatCanvasVideoNodeName(raw || undefined)
  const body = raw ? stripCanvasVideoNamePrefix(raw) : stripCanvasVideoNamePrefix(label)
  const nickname = body || '1'
  return {
    nickname,
    rolePrefix: CANVAS_VIDEO_NAME_PREFIX,
    label,
    colorClass: CANVAS_VIDEO_DEFAULT_NAME_COLOR,
  }
}

/** 为缺少 videoName 的已有节点批量补默认名称 */
export function backfillCanvasVideoNodeNames(nodes: Node[]): { nodes: Node[]; changed: boolean } {
  const takenNames = collectCanvasVideoNodeNames(nodes)
  let changed = false
  const next = nodes.map((node) => {
    if (node.type !== CANVAS_NODE_TYPES.storyVideo) return node
    const data = node.data as CanvasVideoNodeData
    const raw = String(data.videoName || '').trim()
    const videoName = raw
      ? formatCanvasVideoNodeName(raw)
      : generateCanvasDefaultVideoName(takenNames)
    if (!raw) takenNames.push(videoName)
    if (videoName === raw) return node
    changed = true
    return { ...node, data: { ...data, videoName } }
  })
  return { nodes: changed ? next : nodes, changed }
}
