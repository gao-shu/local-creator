// Copyright (c) local-creator contributors. All rights reserved.

import type { Node } from '@xyflow/react'
import { normalizeCanvasProjectSettings } from '@/lib/canvas/canvas-project-settings'
import type { CanvasProjectData } from '@/types/canvas'
import { CANVAS_NODE_TYPES, type CanvasImageNodeData, type CanvasVideoNodeData } from '@/types/canvas-nodes'
import { hasCanvasVideoLocalOutput } from '@/lib/canvas/canvas-video-drag-items'
import { isVideoRemoteJobStale } from '@/lib/video/video-remote-job'

const RUNTIME_NODE_FIELDS = [
  'status',
  'remoteJob',
  'progressMessage',
  'error',
  'outputPath',
  'outputOwnerKind',
  'outputOwnerProjectId',
  'statusUpdatedAt',
] as const

function readNodeStatusUpdatedAt(data: Record<string, unknown>): number {
  return Number(data.statusUpdatedAt) || 0
}

function isCanvasNodeRuntimeActive(data: Record<string, unknown>, now = Date.now()): boolean {
  if (data.status === 'running') return true
  const remoteJob = data.remoteJob as { apiTaskId?: string; createdAt?: number } | undefined
  return Boolean(remoteJob?.apiTaskId?.trim() && !isVideoRemoteJobStale(remoteJob, now))
}

function pickRuntimeNodePatch(data: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const key of RUNTIME_NODE_FIELDS) {
    if (key in data) patch[key] = data[key]
  }
  return patch
}

function isTerminalCanvasNodeStatus(status: unknown): boolean {
  return status === 'success' || status === 'error'
}

function mergeCanvasNodeRuntime(
  memoryNode: Node,
  diskNode: Node | undefined,
  now = Date.now(),
): Node {
  if (!diskNode) return memoryNode
  const memoryData = memoryNode.data as Record<string, unknown>
  const diskData = diskNode.data as Record<string, unknown>

  // 图片节点无后台写盘：内存已进入终态时整节点以内存为准（含 outputPath）
  if (
    memoryNode.type === CANVAS_NODE_TYPES.imageNode &&
    isTerminalCanvasNodeStatus(memoryData.status)
  ) {
    return memoryNode
  }

  const diskTs = readNodeStatusUpdatedAt(diskData)
  const memoryTs = readNodeStatusUpdatedAt(memoryData)
  const diskActive = isCanvasNodeRuntimeActive(diskData, now)
  const memoryActive = isCanvasNodeRuntimeActive(memoryData, now)

  // 本地已结束（如生图成功），磁盘仍停留在 running：以内存为准，避免旧 outputPath 被写回
  if (isTerminalCanvasNodeStatus(memoryData.status) && diskData.status === 'running') {
    return memoryNode
  }

  if (!diskActive && !memoryActive && diskTs <= memoryTs) return memoryNode
  if (memoryActive && !diskActive && memoryTs >= diskTs) return memoryNode
  if (diskActive || diskTs > memoryTs) {
    return {
      ...memoryNode,
      data: {
        ...memoryData,
        ...pickRuntimeNodePatch(diskData),
      },
    }
  }
  return memoryNode
}

function stripDeprecatedNodeFields(node: Node): Node {
  const data = node.data as Record<string, unknown>
  if (node.type === CANVAS_NODE_TYPES.shotPrompt) {
    const { llmModelId: _llm, ...rest } = data
    return { ...node, data: rest }
  }
  if (node.type === CANVAS_NODE_TYPES.imageNode) {
    const { imageModelId: _image, ...rest } = data
    return { ...node, data: rest }
  }
  return node
}

/** 自动保存前合并磁盘上的节点运行态，避免旧内存快照覆盖任务进度 */
export function mergeCanvasProjectDataForPersist(
  disk: CanvasProjectData,
  memory: CanvasProjectData,
  now = Date.now(),
): CanvasProjectData {
  const diskNodeById = new Map(disk.nodes.map((node) => [node.id, node]))
  const nodes = memory.nodes
    .map((node) => mergeCanvasNodeRuntime(node, diskNodeById.get(node.id), now))
    .map(stripDeprecatedNodeFields)
  return {
    version: 1,
    nodes,
    edges: memory.edges,
    viewport: memory.viewport,
    settings: normalizeCanvasProjectSettings(memory.settings ?? disk.settings),
  }
}

export function normalizeCanvasProjectDataFromDisk(raw: unknown): CanvasProjectData {
  const empty: CanvasProjectData = {
    version: 1,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 0.9 },
  }
  if (!raw || typeof raw !== 'object') return empty
  const record = raw as Record<string, unknown>
  const viewportRaw = record.viewport as Partial<CanvasProjectData['viewport']> | undefined
  const nodes = Array.isArray(record.nodes)
    ? (record.nodes as CanvasProjectData['nodes']).map(stripDeprecatedNodeFields)
    : []
  const settingsRaw = record.settings
  return {
    version: 1,
    nodes,
    edges: Array.isArray(record.edges) ? (record.edges as CanvasProjectData['edges']) : [],
    viewport: {
      x: Number(viewportRaw?.x) || 0,
      y: Number(viewportRaw?.y) || 0,
      zoom: Number(viewportRaw?.zoom) || 0.9,
    },
    settings: normalizeCanvasProjectSettings(
      settingsRaw && typeof settingsRaw === 'object'
        ? (settingsRaw as CanvasProjectData['settings'])
        : undefined,
    ),
  }
}

export function isCanvasNodeRuntimeBusy(node: Node, now = Date.now()): boolean {
  if (node.type === CANVAS_NODE_TYPES.storyVideo) {
    const data = node.data as CanvasVideoNodeData
    if (data.status === 'success' || data.status === 'error') return false
    if (data.status === 'running') return true
    if (!hasCanvasVideoLocalOutput(data) && data.remoteJob?.apiTaskId?.trim()) {
      return !isVideoRemoteJobStale(data.remoteJob, now)
    }
    return false
  }
  if (node.type === CANVAS_NODE_TYPES.imageNode) {
    return (node.data as CanvasImageNodeData).status === 'running'
  }
  return false
}

export function collectBusyCanvasNodeLabels(
  nodes: Node[],
  nodeIds: Iterable<string>,
  isNodeRunning?: (nodeId: string) => boolean,
): string[] {
  const idSet = new Set(nodeIds)
  const labels: string[] = []
  for (const node of nodes) {
    if (!idSet.has(node.id)) continue
    if (!isNodeRunning?.(node.id) && !isCanvasNodeRuntimeBusy(node)) continue
    const data = node.data as { label?: string; videoName?: string; imageName?: string }
    labels.push(
      data.videoName?.trim() ||
        data.imageName?.trim() ||
        data.label?.trim() ||
        `节点 ${node.id.slice(-6)}`,
    )
  }
  return labels
}
