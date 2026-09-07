// Copyright (c) local-creator contributors. All rights reserved.

import type { Node } from '@xyflow/react'
import type { CanvasVideoNodeData } from '@/types/canvas-nodes'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import type { VideoRemoteJobSnapshot } from '@/types/video-remote-job'
import type { WorkflowTaskStatus } from '@/types/workflow'
import {
  isCanvasApiAvailable,
  listCanvasProjects,
  patchCanvasData,
  readCanvasData,
} from '@/lib/storage/canvas-service'
import { patchCanvasNodeData, patchCanvasNodeDataPersisted, getCanvasProjectRunBridge } from '@/lib/canvas/canvas-project-run-bridge'
import {
  listCanvasInflightRuns,
  cancelCanvasInflightRun,
  hasCanvasInflightRun,
} from '@/lib/canvas/canvas-inflight-run-service'
import { useTaskStore } from '@/stores/task-store'
import { VIDEO_HANG_MS } from '@/lib/workflow/video-task-service'
import {
  isCanvasVideoNodeResumable,
  listResumableCanvasVideoNodes,
} from '@/lib/canvas/canvas-video-resume-service'
import { isVideoRemoteJobStale } from '@/lib/video/video-remote-job'
import { hasCanvasVideoLocalOutput } from '@/lib/canvas/canvas-video-drag-items'
import { buildCanvasVideoGenerationElapsedPatch } from '@/lib/canvas/canvas-generation-elapsed'
import { hasVideoResumeLock } from '@/lib/video/video-resume-session-lock'
import { resolveRunningVideoProgressMessageForUi } from '@/lib/video/video-progress'
import type { UnifiedTaskEntry } from '@/lib/workflow/task-service'
import {
  failRunningCanvasRunHistoryForNode,
  releaseCanvasNodeRunSession,
} from '@/lib/canvas/canvas-run-history-service'

export interface CanvasVideoTaskEntry {
  projectId: string
  projectTitle: string
  nodeId: string
  node: Node
  label: string
  status: WorkflowTaskStatus
  progressMessage?: string
  errorMessage?: string
  remoteJob?: VideoRemoteJobSnapshot
  createdAt: number
  updatedAt: number
}

function resolveCanvasVideoNodeLabel(data: CanvasVideoNodeData, nodeId: string): string {
  return data.videoName?.trim() || data.label?.trim() || `视频 ${nodeId.slice(-6)}`
}

function hasCanvasVideoTaskFailure(data: CanvasVideoNodeData): boolean {
  return data.status === 'error' || Boolean(data.error?.trim())
}

function isCanvasVideoTaskTerminal(data: CanvasVideoNodeData): boolean {
  return data.status === 'success' || hasCanvasVideoTaskFailure(data)
}

function resolveCanvasVideoTaskStatus(
  data: CanvasVideoNodeData,
  now = Date.now(),
): WorkflowTaskStatus | null {
  if (hasCanvasVideoLocalOutput(data)) return null
  if (hasCanvasVideoTaskFailure(data)) return 'failed'
  if (data.status === 'success') return 'completed'
  if (data.status === 'running') return 'running'
  if (data.remoteJob?.apiTaskId && !isVideoRemoteJobStale(data.remoteJob, now)) {
    return 'running'
  }
  return null
}

export function buildCanvasVideoTaskEntry(
  projectId: string,
  projectTitle: string,
  node: Node,
  now = Date.now(),
): CanvasVideoTaskEntry | null {
  if (node.type !== CANVAS_NODE_TYPES.storyVideo) return null
  const data = node.data as CanvasVideoNodeData
  const status = resolveCanvasVideoTaskStatus(data, now)
  if (!status || status === 'completed') return null

  return {
    projectId,
    projectTitle,
    nodeId: node.id,
    node,
    label: resolveCanvasVideoNodeLabel(data, node.id),
    status,
    progressMessage:
      status === 'running'
        ? resolveRunningVideoProgressMessageForUi(data.progressMessage)
        : data.progressMessage,
    errorMessage: data.error,
    remoteJob: data.remoteJob,
    createdAt: data.remoteJob?.createdAt ?? data.statusUpdatedAt ?? now,
    updatedAt: data.statusUpdatedAt ?? data.remoteJob?.createdAt ?? now,
  }
}

export async function listCanvasVideoTaskEntries(): Promise<CanvasVideoTaskEntry[]> {
  if (!isCanvasApiAvailable()) return []
  const projects = await listCanvasProjects()
  const groups = await Promise.all(
    projects.map(async (project) => {
      try {
        const data = await readCanvasData(project.id)
        return data.nodes
          .map((node) => buildCanvasVideoTaskEntry(project.id, project.title, node))
          .filter((entry): entry is CanvasVideoTaskEntry => entry != null)
      } catch {
        return []
      }
    }),
  )
  return groups
    .flat()
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function toUnifiedCanvasTaskEntry(entry: CanvasVideoTaskEntry): UnifiedTaskEntry {
  return {
    source: 'canvas',
    projectId: entry.projectId,
    projectTitle: entry.projectTitle,
    task: {
      id: entry.nodeId,
      type: 'video',
      status: entry.status,
      progressMessage: entry.progressMessage,
      errorMessage: entry.errorMessage,
      label: entry.label,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    },
  }
}

export async function listResumableCanvasVideoEntries(): Promise<CanvasVideoTaskEntry[]> {
  const entries = await listCanvasVideoTaskEntries()
  return entries.filter((entry) => isCanvasVideoNodeResumable(entry.node))
}

function refreshUnifiedTaskStore(): void {
  void useTaskStore.getState().refresh()
}

/** 清理无 remoteJob 或已超时的画布生视频节点（关应用后节点可能仍为 running） */
export async function reconcileStaleCanvasVideoTasks(
  projectId: string,
): Promise<{ nodeId: string; error: string } | null> {
  if (!isCanvasApiAvailable()) return null

  let data: Awaited<ReturnType<typeof readCanvasData>>
  try {
    data = await readCanvasData(projectId)
  } catch {
    return null
  }

  const now = Date.now()
  let changed = false
  let failed: { nodeId: string; error: string } | null = null
  const historyFailQueue: Array<{ nodeId: string; error: string }> = []

  const nextNodes = data.nodes.map((node) => {
    if (node.type !== CANVAS_NODE_TYPES.storyVideo) return node
    const nodeData = node.data as CanvasVideoNodeData

    if (nodeData.status === 'running' && nodeData.error?.trim()) {
      changed = true
      const patch = {
        status: 'error' as const,
        progressMessage: undefined,
        remoteJob: undefined,
        statusUpdatedAt: now,
      }
      patchCanvasNodeData(projectId, node.id, patch)
      historyFailQueue.push({ nodeId: node.id, error: nodeData.error.trim() })
      return { ...node, data: { ...nodeData, ...patch } }
    }

    if (hasCanvasVideoLocalOutput(nodeData)) {
      const stuck =
        nodeData.status === 'running' ||
        Boolean(nodeData.remoteJob?.apiTaskId?.trim()) ||
        Boolean(nodeData.progressMessage?.trim())
      if (!stuck) return node
      changed = true
      const patch = {
        status: 'success' as const,
        error: undefined,
        progressMessage: undefined,
        remoteJob: undefined,
        statusUpdatedAt: now,
      }
      patchCanvasNodeData(projectId, node.id, patch)
      return { ...node, data: { ...nodeData, ...patch } }
    }

    const wasActive =
      nodeData.status === 'running' || Boolean(nodeData.remoteJob?.apiTaskId?.trim())
    if (!wasActive) return node
    if (hasCanvasInflightRun(projectId, node.id)) return node
    if (isCanvasVideoNodeResumable(node, now)) return node
    if (hasVideoResumeLock('canvas', projectId, node.id)) return node

    const hung = Boolean(nodeData.remoteJob && isVideoRemoteJobStale(nodeData.remoteJob, now))
    const activityAt = nodeData.remoteJob?.createdAt ?? nodeData.statusUpdatedAt ?? 0
    const staleWithoutJob =
      !nodeData.remoteJob?.apiTaskId?.trim() && now - activityAt > VIDEO_HANG_MS
    if (!hung && !staleWithoutJob && nodeData.status === 'running') return node

    changed = true
    const error = hung ? '视频生成已超时，请重新生成' : '视频生成已中断，请重新生成'
    failed = failed ?? { nodeId: node.id, error }
    historyFailQueue.push({ nodeId: node.id, error })
    const patch = {
      status: 'error' as const,
      error,
      progressMessage: undefined,
      remoteJob: undefined,
      statusUpdatedAt: now,
    }
    patchCanvasNodeData(projectId, node.id, patch)
    return { ...node, data: { ...nodeData, ...patch } }
  })

  if (!changed) return null
  await patchCanvasData(projectId, (current) => ({ ...current, nodes: nextNodes }))
  const bridge = getCanvasProjectRunBridge(projectId)
  const syncedNodeIds = new Set(historyFailQueue.map((item) => item.nodeId))
  for (const nodeId of syncedNodeIds) {
    releaseCanvasNodeRunSession(projectId, nodeId, (id) => bridge?.markNodeIdle(id))
  }
  for (const item of historyFailQueue) {
    await failRunningCanvasRunHistoryForNode(projectId, item.nodeId, item.error)
  }
  refreshUnifiedTaskStore()
  return failed
}

async function readCanvasVideoNodeData(
  projectId: string,
  nodeId: string,
): Promise<CanvasVideoNodeData | null> {
  if (!isCanvasApiAvailable()) return null
  try {
    const data = await readCanvasData(projectId)
    const node = data.nodes.find((item) => item.id === nodeId)
    if (!node || node.type !== CANVAS_NODE_TYPES.storyVideo) return null
    return node.data as CanvasVideoNodeData
  } catch {
    return null
  }
}

export async function persistCanvasVideoRemoteJob(
  projectId: string,
  nodeId: string,
  remoteJob: VideoRemoteJobSnapshot,
): Promise<void> {
  const nodeData = await readCanvasVideoNodeData(projectId, nodeId)
  if (nodeData && isCanvasVideoTaskTerminal(nodeData)) return

  await patchCanvasNodeDataPersisted(projectId, nodeId, {
    remoteJob,
    status: 'running',
    error: undefined,
    statusUpdatedAt: Date.now(),
    ...(nodeData?.generationStartedAt
      ? {}
      : { generationStartedAt: remoteJob.createdAt || Date.now(), generationElapsedMs: undefined }),
  })
  refreshUnifiedTaskStore()
}

export async function updateCanvasVideoTaskProgress(
  projectId: string,
  nodeId: string,
  progressMessage: string,
): Promise<void> {
  const bridge = getCanvasProjectRunBridge(projectId)
  const liveNode = bridge?.getNodes()?.find((item) => item.id === nodeId)
  if (liveNode?.type === CANVAS_NODE_TYPES.storyVideo) {
    if (isCanvasVideoTaskTerminal(liveNode.data as CanvasVideoNodeData)) return
  }

  const nodeData = await readCanvasVideoNodeData(projectId, nodeId)
  if (nodeData && isCanvasVideoTaskTerminal(nodeData)) return

  // 只更新进度文案，避免失败结案后被晚到的进度写回 status=running
  await patchCanvasNodeDataPersisted(projectId, nodeId, {
    progressMessage,
    statusUpdatedAt: Date.now(),
  })
  refreshUnifiedTaskStore()
}

export async function finishCanvasVideoTask(
  projectId: string,
  nodeId: string,
  outcome: {
    status: 'success' | 'error'
    patch?: Record<string, unknown>
    error?: string
    progressMessage?: string
  },
): Promise<void> {
  const now = Date.now()
  const liveNode = getCanvasProjectRunBridge(projectId)
    ?.getNodes()
    ?.find((item) => item.id === nodeId)
  const diskData = await readCanvasVideoNodeData(projectId, nodeId)
  const timingSource =
    (liveNode?.type === CANVAS_NODE_TYPES.storyVideo
      ? (liveNode.data as CanvasVideoNodeData)
      : undefined) ?? diskData
  const elapsedPatch = timingSource
    ? buildCanvasVideoGenerationElapsedPatch(timingSource, now)
    : { generationStartedAt: now, generationElapsedMs: 0 }

  const nodePatch = {
    ...outcome.patch,
    ...elapsedPatch,
    status: outcome.status,
    error: outcome.error,
    progressMessage: outcome.progressMessage,
    remoteJob: undefined,
    statusUpdatedAt: now,
  }
  patchCanvasNodeData(projectId, nodeId, nodePatch)
  if (isCanvasApiAvailable()) {
    await patchCanvasData(projectId, (current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...nodePatch } } : node,
      ),
    }))
  } else {
    await patchCanvasNodeDataPersisted(projectId, nodeId, nodePatch)
  }
  if (outcome.status === 'error' && outcome.error?.trim()) {
    await failRunningCanvasRunHistoryForNode(projectId, nodeId, outcome.error.trim())
  }
  refreshUnifiedTaskStore()
}

/** 从全局任务列表移除画布生视频任务（终止内存会话并清除节点上的进行中/失败状态） */
export async function dismissCanvasVideoTask(projectId: string, nodeId: string): Promise<boolean> {
  if (!isCanvasApiAvailable()) return false
  cancelCanvasInflightRun(projectId, nodeId)
  const nodeData = await readCanvasVideoNodeData(projectId, nodeId)
  if (!nodeData) return false
  await patchCanvasNodeDataPersisted(projectId, nodeId, {
    status: 'idle',
    error: undefined,
    progressMessage: undefined,
    remoteJob: undefined,
    statusUpdatedAt: Date.now(),
  })
  await failRunningCanvasRunHistoryForNode(projectId, nodeId, '任务已取消')
  refreshUnifiedTaskStore()
  return true
}

export function listResumableCanvasVideoNodesFromGraph(nodes: Node[]): Node[] {
  return listResumableCanvasVideoNodes(nodes)
}
