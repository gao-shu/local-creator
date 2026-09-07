// Copyright (c) Haode AI. All rights reserved.

import type { Node } from '@xyflow/react'
import type { CanvasNodeStatus, CanvasVideoNodeData } from '@/types/canvas-nodes'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import type { WorkflowTask, WorkflowTaskStatus, WorkflowTaskType } from '@/types/workflow'
import type { VideoRemoteJobSnapshot } from '@/types/video-remote-job'
import { VIDEO_REMOTE_JOB_HANG_MS } from '@/types/video-remote-job'
import { canRunCanvasNode } from '@/lib/canvas/canvas-run-service'
import { getNodeDisplayLabel } from '@/lib/canvas/canvas-group-utils'
import { cancelCanvasInflightRun } from '@/lib/canvas/canvas-inflight-run-service'
import { isVideoRemoteJobStale } from '@/lib/video/video-remote-job'
import { hasVideoResumeLock } from '@/lib/video/video-resume-session-lock'
import { VIDEO_HANG_MS } from '@/lib/workflow/video-task-service'
import {
  readCanvasTasks,
  upsertCanvasTask,
  writeCanvasTasks,
} from '@/lib/storage/canvas-service'
import {
  getCanvasProjectRunBridge,
  patchCanvasNodeData,
  patchCanvasNodeDataPersisted,
} from '@/lib/canvas/canvas-project-run-bridge'
import { useTaskStore } from '@/stores/task-store'
import { formatTaskTime } from '@/lib/workflow/task-service'

/** 画布节点单次执行历史（运行队列一行） */
const RUN_HISTORY_TYPES = new Set<WorkflowTaskType>(['video', 'image'])
const MAX_RUN_HISTORY = 200

export type CanvasRunQueueRow = {
  key: string
  nodeId: string
  label: string
  status: CanvasNodeStatus
  error?: string
  /** 排序/展示：任务创建时间（恢复不改写） */
  activityAt: number
  kind: 'attempt' | 'idle'
}

function refreshUnifiedTaskStore() {
  void useTaskStore.getState().refresh()
}

function newAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `canvas-run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function isCanvasNodeRunHistoryTask(task: WorkflowTask): boolean {
  return RUN_HISTORY_TYPES.has(task.type) && Boolean(task.canvasSourceNodeId?.trim())
}

function resolveRunTaskType(node: Node): WorkflowTaskType {
  return node.type === CANVAS_NODE_TYPES.storyVideo ? 'video' : 'image'
}

function mapWorkflowStatusToNodeStatus(status: WorkflowTaskStatus): CanvasNodeStatus {
  if (status === 'running' || status === 'pending') return 'running'
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'error'
  return 'idle'
}

function readOriginalJobCreatedAt(node: Node): number {
  const data = (node.data ?? {}) as CanvasVideoNodeData
  return Number(data.remoteJob?.createdAt) || Number(data.statusUpdatedAt) || Date.now()
}

async function trimRunHistory(projectId: string, tasks: WorkflowTask[]): Promise<WorkflowTask[]> {
  const history = tasks.filter(isCanvasNodeRunHistoryTask)
  if (history.length <= MAX_RUN_HISTORY) return tasks
  const keepIds = new Set(
    [...history]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_RUN_HISTORY)
      .map((item) => item.id),
  )
  const next = tasks.filter((task) => !isCanvasNodeRunHistoryTask(task) || keepIds.has(task.id))
  await writeCanvasTasks(projectId, next)
  return next
}

/** 开始一次新的节点执行（失败后再点生成也会新建，不覆盖旧记录） */
export async function startCanvasNodeRunAttempt(options: {
  projectId: string
  node: Node
  label?: string
  /** 仅用于「补齐漏写的历史」时沿用原任务创建时间；正常点击生成勿传 */
  createdAt?: number
  remoteJob?: VideoRemoteJobSnapshot
}): Promise<string> {
  const now = Date.now()
  const createdAt = options.createdAt && options.createdAt > 0 ? options.createdAt : now
  const id = newAttemptId()
  const label = options.label?.trim() || getNodeDisplayLabel(options.node)
  await upsertCanvasTask(options.projectId, {
    id,
    type: resolveRunTaskType(options.node),
    status: 'running',
    canvasSourceNodeId: options.node.id,
    label,
    progressMessage: undefined,
    errorMessage: undefined,
    remoteJob: options.remoteJob,
    createdAt,
    updatedAt: now,
  })
  const tasks = await readCanvasTasks(options.projectId)
  await trimRunHistory(options.projectId, tasks)
  refreshUnifiedTaskStore()
  return id
}

/**
 * 未完成任务自动恢复：必须挂回已有历史行，保留原 createdAt。
 * 仅当完全无历史时（升级前遗留），才按 remoteJob.createdAt 补一行。
 */
export async function ensureCanvasNodeRunAttemptForResume(options: {
  projectId: string
  node: Node
  label?: string
}): Promise<string> {
  const nodeData = (options.node.data ?? {}) as CanvasVideoNodeData
  const apiTaskId = nodeData.remoteJob?.apiTaskId?.trim()
  const tasks = await readCanvasTasks(options.projectId)
  const forNode = tasks.filter(
    (task) => isCanvasNodeRunHistoryTask(task) && task.canvasSourceNodeId === options.node.id,
  )

  const active = forNode.find((task) => task.status === 'running' || task.status === 'pending')
  if (active) return active.id

  if (apiTaskId) {
    const byRemoteJob = forNode.find((task) => task.remoteJob?.apiTaskId?.trim() === apiTaskId)
    if (byRemoteJob) {
      await upsertCanvasTask(options.projectId, {
        ...byRemoteJob,
        status: 'running',
        errorMessage: undefined,
        remoteJob: nodeData.remoteJob ?? byRemoteJob.remoteJob,
        // 保留原 createdAt；updatedAt 仅作内部进度，队列排序用 createdAt
        updatedAt: Date.now(),
      })
      refreshUnifiedTaskStore()
      return byRemoteJob.id
    }
  }

  // 升级前只有节点 remoteJob、尚无历史：补齐且沿用远端创建时间
  return startCanvasNodeRunAttempt({
    projectId: options.projectId,
    node: options.node,
    label: options.label,
    createdAt: readOriginalJobCreatedAt(options.node),
    remoteJob: nodeData.remoteJob,
  })
}

export async function updateCanvasNodeRunAttempt(
  projectId: string,
  attemptId: string,
  patch: {
    progressMessage?: string
    status?: WorkflowTaskStatus
    remoteJob?: VideoRemoteJobSnapshot
  },
): Promise<void> {
  const tasks = await readCanvasTasks(projectId)
  const existing = tasks.find((task) => task.id === attemptId)
  if (!existing || !isCanvasNodeRunHistoryTask(existing)) return
  if (existing.status === 'completed' || existing.status === 'failed') return
  await upsertCanvasTask(projectId, {
    ...existing,
    status: patch.status ?? existing.status,
    progressMessage: patch.progressMessage ?? existing.progressMessage,
    remoteJob: patch.remoteJob ?? existing.remoteJob,
    // 不改 createdAt
    updatedAt: Date.now(),
  })
}

export async function finishCanvasNodeRunAttempt(
  projectId: string,
  attemptId: string,
  outcome: { status: 'completed' | 'failed'; errorMessage?: string; progressMessage?: string },
): Promise<void> {
  const tasks = await readCanvasTasks(projectId)
  const existing = tasks.find((task) => task.id === attemptId)
  if (!existing || !isCanvasNodeRunHistoryTask(existing)) return
  await upsertCanvasTask(projectId, {
    ...existing,
    status: outcome.status,
    errorMessage: outcome.errorMessage,
    progressMessage: outcome.progressMessage,
    updatedAt: Date.now(),
    remoteJob: undefined,
  })
  if (outcome.status === 'completed' && existing.canvasSourceNodeId) {
    await failRunningCanvasRunHistoryForNode(
      projectId,
      existing.canvasSourceNodeId,
      '生成已中断，请重新生成',
      { exceptAttemptId: attemptId },
    )
  }
  refreshUnifiedTaskStore()
}

export function buildCanvasRunQueueRows(nodes: Node[], tasks: WorkflowTask[]): CanvasRunQueueRow[] {
  const attempts = tasks.filter(isCanvasNodeRunHistoryTask)
  const rows: CanvasRunQueueRow[] = attempts.map((task) => ({
    key: task.id,
    nodeId: task.canvasSourceNodeId!,
    label: task.label?.trim() || `任务 ${task.id.slice(0, 8)}`,
    status: mapWorkflowStatusToNodeStatus(task.status),
    error: task.errorMessage,
    activityAt: task.createdAt,
    kind: 'attempt' as const,
  }))

  const attemptedNodeIds = new Set(attempts.map((task) => task.canvasSourceNodeId!))
  for (const node of nodes) {
    if (!canRunCanvasNode(node)) continue
    if (attemptedNodeIds.has(node.id)) continue
    const status = (node.data as { status?: CanvasNodeStatus } | undefined)?.status
    if (status === 'running' || status === 'success' || status === 'error') continue
    rows.push({
      key: `idle:${node.id}`,
      nodeId: node.id,
      label: getNodeDisplayLabel(node),
      status: 'idle',
      activityAt: 0,
      kind: 'idle',
    })
  }

  return rows.sort((a, b) => {
    const timeDiff = b.activityAt - a.activityAt
    if (timeDiff !== 0) return timeDiff
    return a.key.localeCompare(b.key)
  })
}

export function formatCanvasRunQueueTime(activityAt: number): string {
  if (!activityAt) return '待执行'
  return formatTaskTime(activityAt)
}

export type CanvasRunHistoryReconcileResult = {
  failedCount: number
  /** 历史标失败后，同步到仍为 running 的节点（避免队列超时、画布仍生成中） */
  syncedNodes: Array<{ nodeId: string; error: string }>
}

export function applyCanvasRunHistoryNodeSync(
  nodes: Node[],
  syncedNodes: Array<{ nodeId: string; error: string }>,
): Node[] {
  if (!syncedNodes.length) return nodes
  const patchById = new Map(syncedNodes.map((item) => [item.nodeId, item.error]))
  const now = Date.now()
  return nodes.map((node) => {
    const error = patchById.get(node.id)
    if (!error) return node
    return {
      ...node,
      data: {
        ...node.data,
        status: 'error',
        error,
        progressMessage: undefined,
        remoteJob: undefined,
        statusUpdatedAt: now,
      },
    }
  })
}

function isCanvasVideoNodeBusyForSync(
  node: Node | undefined,
  now: number,
): boolean {
  if (!node || node.type !== CANVAS_NODE_TYPES.storyVideo) return false
  const data = node.data as CanvasVideoNodeData & { status?: CanvasNodeStatus }
  if (data.status === 'error' || data.status === 'success') return false
  if (data.status === 'running') return true
  if (Boolean(data.progressMessage?.trim())) return true
  const jobId = data.remoteJob?.apiTaskId?.trim()
  if (!jobId) return false
  return isVideoRemoteJobStale(data.remoteJob!, now)
}

function isNodeEligibleForHistoryFailureSync(
  node: Node | undefined,
  task: WorkflowTask,
  newestKeptRunningCreatedAt: number,
  now: number,
): boolean {
  if (!node) return false
  // 同一节点仍有更新的、未过期且可恢复的历史 → 节点跟新任务，勿被旧历史拉成失败
  if (newestKeptRunningCreatedAt > task.createdAt) return false

  if (!isCanvasVideoNodeBusyForSync(node, now)) return false

  if (task.type === 'video' && node.type === CANVAS_NODE_TYPES.storyVideo) {
    const data = node.data as CanvasVideoNodeData
    const historyJobId = task.remoteJob?.apiTaskId?.trim()
    const nodeJobId = data.remoteJob?.apiTaskId?.trim()
    if (historyJobId && nodeJobId && nodeJobId !== historyJobId) {
      // 节点已绑更新远端任务且未过期 → 不同步旧历史失败
      if (!isVideoRemoteJobStale(data.remoteJob!, now)) return false
    }
  }

  return true
}

function dedupeSyncedNodesByNodeId(
  syncedNodes: Array<{ nodeId: string; error: string }>,
): Array<{ nodeId: string; error: string }> {
  const byId = new Map<string, string>()
  for (const item of syncedNodes) {
    if (!byId.has(item.nodeId)) byId.set(item.nodeId, item.error)
  }
  return [...byId.entries()].map(([nodeId, error]) => ({ nodeId, error }))
}

async function syncCanvasNodesAfterHistoryFailure(
  projectId: string,
  syncedNodes: Array<{ nodeId: string; error: string }>,
): Promise<void> {
  const unique = dedupeSyncedNodesByNodeId(syncedNodes)
  const bridge = getCanvasProjectRunBridge(projectId)
  for (const item of unique) {
    releaseCanvasNodeRunSession(projectId, item.nodeId, (nodeId) => bridge?.markNodeIdle(nodeId))
    const patch = {
      status: 'error' as const,
      error: item.error,
      progressMessage: undefined,
      remoteJob: undefined,
      statusUpdatedAt: Date.now(),
    }
    patchCanvasNodeData(projectId, item.nodeId, patch)
    await patchCanvasNodeDataPersisted(projectId, item.nodeId, patch)
  }
}

export async function listCanvasNodeRunHistoryTasks(projectId: string): Promise<WorkflowTask[]> {
  const tasks = await readCanvasTasks(projectId)
  return tasks.filter(isCanvasNodeRunHistoryTask)
}

function markHistoryTaskFailed(
  task: WorkflowTask,
  errorMessage: string,
  now: number,
): WorkflowTask {
  return {
    ...task,
    status: 'failed',
    errorMessage,
    progressMessage: undefined,
    remoteJob: undefined,
    updatedAt: now,
  }
}

function isNodeVideoResumableWithJob(node: Node | undefined, now: number): boolean {
  if (!node || node.type !== CANVAS_NODE_TYPES.storyVideo) return false
  const data = node.data as CanvasVideoNodeData
  if (data.status !== 'running') return false
  if (!data.remoteJob?.apiTaskId?.trim()) return false
  if (isVideoRemoteJobStale(data.remoteJob, now)) return false
  return true
}

function isHistoryAttemptResumableWithNode(
  task: WorkflowTask,
  node: Node | undefined,
  now: number,
): boolean {
  if (!isNodeVideoResumableWithJob(node, now)) return false
  const data = (node!.data ?? {}) as CanvasVideoNodeData
  const historyJobId = task.remoteJob?.apiTaskId?.trim()
  const nodeJobId = data.remoteJob?.apiTaskId?.trim()
  if (!historyJobId || !nodeJobId) return false
  return historyJobId === nodeJobId
}

function shouldKeepRunningHistoryAttempt(options: {
  projectId: string
  task: WorkflowTask
  node: Node | undefined
  allTasks: WorkflowTask[]
  now: number
}): boolean {
  const nodeId = options.task.canvasSourceNodeId!
  if (hasVideoResumeLock('canvas', options.projectId, nodeId)) return true
  // 仅保留仍与节点远端任务绑定且未过期的记录；inflight  alone 不足以阻止结案
  return isHistoryAttemptResumableWithNode(options.task, options.node, options.now)
}

/** 释放节点上的本地运行会话（inflight + UI running 标记），与历史/节点 error 同步配合 */
export function releaseCanvasNodeRunSession(
  projectId: string,
  nodeId: string,
  markNodeIdle?: (nodeId: string) => void,
): void {
  cancelCanvasInflightRun(projectId, nodeId)
  markNodeIdle?.(nodeId)
}

/** 将某节点所有未结案的历史执行标为失败（节点 reconcile / 中断时同步队列） */
export async function failRunningCanvasRunHistoryForNode(
  projectId: string,
  nodeId: string,
  errorMessage: string,
  options?: { exceptAttemptId?: string },
): Promise<number> {
  const tasks = await readCanvasTasks(projectId)
  const now = Date.now()
  let count = 0
  const next = tasks.map((task) => {
    if (!isCanvasNodeRunHistoryTask(task)) return task
    if (task.canvasSourceNodeId !== nodeId) return task
    if (task.status !== 'running' && task.status !== 'pending') return task
    if (options?.exceptAttemptId && task.id === options.exceptAttemptId) return task
    count += 1
    return markHistoryTaskFailed(task, errorMessage, now)
  })
  if (!count) return 0
  await writeCanvasTasks(projectId, next)
  refreshUnifiedTaskStore()
  return count
}

/**
 * 清理运行队列里卡住的执行历史（关应用后 tasks 可能仍为 running）。
 * 仍与节点远端任务绑定的未过期记录会保留，等待自动恢复。
 */
export async function reconcileStaleCanvasRunHistory(
  projectId: string,
  nodes: Node[],
): Promise<CanvasRunHistoryReconcileResult> {
  const now = Date.now()
  const nodeById = new Map(nodes.map((item) => [item.id, item]))
  const tasks = await readCanvasTasks(projectId)

  type FailDecision = { task: WorkflowTask; errorMessage: string }
  const toFail: FailDecision[] = []
  const keptRunningCreatedAtByNode = new Map<string, number>()

  for (const task of tasks) {
    if (!isCanvasNodeRunHistoryTask(task)) continue
    if (task.status !== 'running' && task.status !== 'pending') continue

    const nodeId = task.canvasSourceNodeId!
    const node = nodeById.get(nodeId)
    if (shouldKeepRunningHistoryAttempt({ projectId, task, node, allTasks: tasks, now })) {
      const prev = keptRunningCreatedAtByNode.get(nodeId) ?? 0
      if (task.createdAt > prev) keptRunningCreatedAtByNode.set(nodeId, task.createdAt)
      continue
    }

    let errorMessage =
      task.type === 'video' ? '视频生成已超时，请重新生成' : '生图已超时，请重新生成'

    if (!node) {
      errorMessage =
        task.type === 'video' ? '视频生成已中断，请重新生成' : '生图已中断，请重新生成'
      toFail.push({ task, errorMessage })
      continue
    }

    const nodeStatus = (node.data as { status?: CanvasNodeStatus }).status
    const historyMatchesActiveVideoJob = isHistoryAttemptResumableWithNode(task, node, now)

    if (nodeStatus !== 'running' || !historyMatchesActiveVideoJob) {
      if (task.type === 'video' && task.remoteJob?.apiTaskId?.trim()) {
        if (isVideoRemoteJobStale(task.remoteJob, now)) {
          errorMessage = '视频生成已超时，请重新生成'
        } else if (!historyMatchesActiveVideoJob) {
          errorMessage = '视频生成已中断，请重新生成'
        } else {
          const hangMs = VIDEO_REMOTE_JOB_HANG_MS
          if (now - task.createdAt <= hangMs) continue
        }
      } else if (nodeStatus !== 'running') {
        errorMessage =
          task.type === 'video' ? '视频生成已中断，请重新生成' : '生图已中断，请重新生成'
      } else {
        const hangMs = task.type === 'video' ? VIDEO_REMOTE_JOB_HANG_MS : VIDEO_HANG_MS
        if (now - task.createdAt <= hangMs) continue
      }
    } else {
      const hangMs = task.type === 'video' ? VIDEO_REMOTE_JOB_HANG_MS : VIDEO_HANG_MS
      if (now - task.createdAt <= hangMs) continue
    }

    toFail.push({ task, errorMessage })
  }

  if (!toFail.length) return { failedCount: 0, syncedNodes: [] }

  const failIds = new Set(toFail.map((item) => item.task.id))
  const syncedNodes: Array<{ nodeId: string; error: string }> = []

  const latestFailByNode = new Map<string, { task: WorkflowTask; errorMessage: string }>()
  for (const item of toFail) {
    const nodeId = item.task.canvasSourceNodeId!
    const prev = latestFailByNode.get(nodeId)
    if (!prev || item.task.createdAt >= prev.task.createdAt) {
      latestFailByNode.set(nodeId, item)
    }
  }

  for (const [nodeId, { task, errorMessage }] of latestFailByNode) {
    const node = nodeById.get(nodeId)
    const newestKept = keptRunningCreatedAtByNode.get(nodeId) ?? 0
    const noActiveHistoryLeft = !keptRunningCreatedAtByNode.has(nodeId)
    if (
      isNodeEligibleForHistoryFailureSync(node, task, newestKept, now) ||
      (noActiveHistoryLeft && isCanvasVideoNodeBusyForSync(node, now))
    ) {
      syncedNodes.push({ nodeId, error: errorMessage })
    }
  }

  const next = tasks.map((task) => {
    const decision = toFail.find((item) => item.task.id === task.id)
    if (!decision) return task
    return markHistoryTaskFailed(task, decision.errorMessage, now)
  })

  await writeCanvasTasks(projectId, next)
  await syncCanvasNodesAfterHistoryFailure(projectId, syncedNodes)
  refreshUnifiedTaskStore()
  return {
    failedCount: failIds.size,
    syncedNodes: dedupeSyncedNodesByNodeId(syncedNodes),
  }
}

