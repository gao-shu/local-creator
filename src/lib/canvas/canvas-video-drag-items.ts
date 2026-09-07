// Copyright (c) local-creator contributors. All rights reserved.

import type { Node } from '@xyflow/react'
import type { AppSettings } from '@/types/settings'
import { resolveCanvasProjectRoot } from '@/lib/canvas/canvas-project-paths'
import { resolveCanvasVideoDisplayName } from '@/lib/canvas/canvas-video-naming'
import { compareNodesByStoryboardShot } from '@/lib/canvas/canvas-shot-utils'
import { resolveProjectRoot } from '@/lib/storage/project-paths'
import { normalizeStoredMediaPath } from '@/lib/storage/media-path-resolver'
import { CANVAS_NODE_TYPES, type CanvasVideoNodeData } from '@/types/canvas-nodes'

export interface CanvasVideoDragItem {
  nodeId: string
  storedPath: string
  projectRoot?: string
  filename: string
}

export function isCanvasVideoNodeType(type: string | undefined): boolean {
  return type === CANVAS_NODE_TYPES.storyVideo || type === 'videoPrompt'
}

function sortSelectedVideoNodes(a: Node, b: Node): number {
  return compareNodesByStoryboardShot(a, b)
}

export function getSelectedCanvasVideoNodes(nodes: Node[]): Node[] {
  return nodes
    .filter((node) => node.selected && isCanvasVideoNodeType(String(node.type || '')))
    .sort(sortSelectedVideoNodes)
}

/** 节点是否已有可用的本地/远程成片路径（非 preview 占位） */
export function hasCanvasVideoLocalOutput(data: CanvasVideoNodeData): boolean {
  const raw = String(data.outputPath || '').trim()
  return Boolean(raw && !raw.startsWith('preview:'))
}

/** 已有成片但 status/remoteJob 未清理的脏状态（关应用或恢复失败时常见） */
export function isStuckCanvasVideoNodeWithOutput(data: CanvasVideoNodeData): boolean {
  if (!hasCanvasVideoLocalOutput(data)) return false
  return (
    data.status === 'running' ||
    Boolean(data.remoteJob?.apiTaskId?.trim()) ||
    Boolean(data.progressMessage?.trim())
  )
}

export function normalizeStuckCanvasVideoNodeData(
  data: CanvasVideoNodeData,
  now = Date.now(),
): CanvasVideoNodeData {
  if (!isStuckCanvasVideoNodeWithOutput(data)) return data
  return {
    ...data,
    status: 'success',
    error: undefined,
    progressMessage: undefined,
    remoteJob: undefined,
    statusUpdatedAt: now,
  }
}

export function normalizeStuckCanvasVideoNodes(nodes: Node[]): Node[] {
  let changed = false
  const next = nodes.map((node) => {
    if (node.type !== CANVAS_NODE_TYPES.storyVideo) return node
    const data = node.data as CanvasVideoNodeData
    const normalized = normalizeStuckCanvasVideoNodeData(data)
    if (normalized === data) return node
    changed = true
    return { ...node, data: normalized }
  })
  return changed ? next : nodes
}

/** 与视频预览一致：有 outputPath 且非运行中即可拖（不要求 status===success） */
export function resolveCanvasVideoNodeDragPath(data: CanvasVideoNodeData): string {
  if (data.status === 'running' && !hasCanvasVideoLocalOutput(data)) return ''
  const raw = String(data.outputPath || '').trim()
  if (!raw || raw.startsWith('preview:')) return ''
  return normalizeStoredMediaPath(raw)
}

/** 多选时从选中节点里解析可拖到剪映的视频条目 */
export function resolveSelectedVideoDragItems(options: {
  nodes: Node[]
  canvasProjectId: string
  settings?: AppSettings | null
  appDataDir?: string
}): CanvasVideoDragItem[] {
  const selectedCount = options.nodes.filter((node) => node.selected).length
  if (selectedCount < 2) return []

  const videoNodes = getSelectedCanvasVideoNodes(options.nodes)
  const items: CanvasVideoDragItem[] = []

  videoNodes.forEach((node) => {
    const data = node.data as CanvasVideoNodeData
    const storedPath = resolveCanvasVideoNodeDragPath(data)
    if (!storedPath) return

    const display = resolveCanvasVideoDisplayName({ videoName: data.videoName })
    let projectRoot: string | undefined
    if (options.settings && options.appDataDir) {
      projectRoot =
        data.outputOwnerKind === 'workflow' && data.outputOwnerProjectId
          ? resolveProjectRoot(options.settings, options.appDataDir, data.outputOwnerProjectId)
          : resolveCanvasProjectRoot(options.settings, options.appDataDir, options.canvasProjectId)
    }

    const base =
      display.label.replace(/[^\w\u4e00-\u9fa5.-]+/g, '_').trim() || `video_${items.length + 1}`

    items.push({
      nodeId: node.id,
      storedPath,
      projectRoot,
      filename: `${base}.mp4`,
    })
  })

  return items
}
