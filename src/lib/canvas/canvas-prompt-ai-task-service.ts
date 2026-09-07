// Copyright (c) Haode AI. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import type { AppSettings } from '@/types/settings'
import type { WorkflowTask } from '@/types/workflow'
import {
  getCanvasProjectRunBridge,
  patchCanvasNodeData,
} from '@/lib/canvas/canvas-project-run-bridge'
import {
  resolveCanvasPromptExtractErrorMessage,
  runCanvasPromptExtract,
} from '@/lib/canvas/canvas-prompt-extract-action'
import {
  resolveCanvasPromptStoryboardErrorMessage,
  runCanvasPromptStoryboard,
} from '@/lib/canvas/canvas-storyboard-action'
import type { PromptAiBusyKind, PromptAiBusyState } from '@/lib/canvas/canvas-prompt-ai-actions'
import {
  canPersistCanvasPromptAiResult,
  isCanvasPromptAiAbortError,
} from '@/lib/canvas/canvas-prompt-ai-cancel'
import {
  isCanvasApiAvailable,
  listCanvasProjects,
  patchCanvasData,
  readCanvasTasks,
  upsertCanvasTask,
  writeCanvasTasks,
} from '@/lib/storage/canvas-service'
import { isActiveTaskStatus } from '@/lib/workflow/task-service'
import type { UnifiedTaskEntry } from '@/lib/workflow/task-service'
import { useTaskStore } from '@/stores/task-store'
import { generateUUID } from '@/lib/utils'

export const CANVAS_PROMPT_AI_HANG_MS = 10 * 60 * 1000

const CANVAS_EXTRACT_SESSION_PREFIX = 'haode:canvas:extract:'
const CANVAS_STORYBOARD_SESSION_PREFIX = 'haode:canvas:storyboard:'

export interface CanvasPromptAiTaskEntry {
  projectId: string
  projectTitle: string
  task: WorkflowTask
}

interface CanvasPromptAiInflightRun {
  projectId: string
  taskId: string
  kind: PromptAiBusyKind
  sourceNodeId: string
  promise: Promise<CanvasPromptAiTaskResult>
  cancelled: boolean
  abortController: AbortController
}

export interface CanvasPromptAiTaskResult {
  kind: PromptAiBusyKind
  sourceNodeId: string
  appliedToUi: boolean
  /** 用户主动取消：不得 toast 成功，不得写入分镜/资产 */
  cancelled?: boolean
  summary?: string
  createdNodeIds?: string[]
}

const inflightByKey = new Map<string, CanvasPromptAiInflightRun>()

function inflightKey(projectId: string, kind: PromptAiBusyKind, sourceNodeId: string): string {
  return `${projectId}:${kind}:${sourceNodeId}`
}

function isCanvasPromptAiTask(task: WorkflowTask): boolean {
  return (
    Boolean(task.canvasSourceNodeId) &&
    (task.type === 'extract' || task.type === 'storyboard')
  )
}

function refreshUnifiedTaskStore(): void {
  void useTaskStore.getState().refresh()
}

function getCanvasExtractSessionTaskId(projectId: string): string | null {
  try {
    return sessionStorage.getItem(`${CANVAS_EXTRACT_SESSION_PREFIX}${projectId}`)
  } catch {
    return null
  }
}

function setCanvasExtractSessionTaskId(projectId: string, taskId: string): void {
  try {
    sessionStorage.setItem(`${CANVAS_EXTRACT_SESSION_PREFIX}${projectId}`, taskId)
  } catch {
    /* ignore */
  }
}

export function clearCanvasExtractSessionTaskId(projectId: string): void {
  try {
    sessionStorage.removeItem(`${CANVAS_EXTRACT_SESSION_PREFIX}${projectId}`)
  } catch {
    /* ignore */
  }
}

function getCanvasStoryboardSessionTaskId(projectId: string): string | null {
  try {
    return sessionStorage.getItem(`${CANVAS_STORYBOARD_SESSION_PREFIX}${projectId}`)
  } catch {
    return null
  }
}

function setCanvasStoryboardSessionTaskId(projectId: string, taskId: string): void {
  try {
    sessionStorage.setItem(`${CANVAS_STORYBOARD_SESSION_PREFIX}${projectId}`, taskId)
  } catch {
    /* ignore */
  }
}

export function clearCanvasStoryboardSessionTaskId(projectId: string): void {
  try {
    sessionStorage.removeItem(`${CANVAS_STORYBOARD_SESSION_PREFIX}${projectId}`)
  } catch {
    /* ignore */
  }
}

function clearCanvasPromptAiSession(projectId: string, kind: PromptAiBusyKind): void {
  if (kind === 'extract') clearCanvasExtractSessionTaskId(projectId)
  else clearCanvasStoryboardSessionTaskId(projectId)
}

function getCanvasPromptAiSessionTaskId(projectId: string, kind: PromptAiBusyKind): string | null {
  return kind === 'extract'
    ? getCanvasExtractSessionTaskId(projectId)
    : getCanvasStoryboardSessionTaskId(projectId)
}

function setCanvasPromptAiSessionTaskId(
  projectId: string,
  kind: PromptAiBusyKind,
  taskId: string,
): void {
  if (kind === 'extract') setCanvasExtractSessionTaskId(projectId, taskId)
  else setCanvasStoryboardSessionTaskId(projectId, taskId)
}

export function getActiveCanvasPromptExtractTask(
  tasks: WorkflowTask[],
  projectId?: string,
): WorkflowTask | null {
  const sessionId = projectId ? getCanvasExtractSessionTaskId(projectId) : null
  const running = tasks.filter(
    (task) =>
      task.type === 'extract' &&
      Boolean(task.canvasSourceNodeId) &&
      isActiveTaskStatus(task.status),
  )
  if (!running.length || !sessionId) return null
  return running.find((task) => task.id === sessionId) ?? null
}

export function getActiveCanvasPromptStoryboardTask(
  tasks: WorkflowTask[],
  projectId?: string,
): WorkflowTask | null {
  const sessionId = projectId ? getCanvasStoryboardSessionTaskId(projectId) : null
  const running = tasks.filter(
    (task) =>
      task.type === 'storyboard' &&
      Boolean(task.canvasSourceNodeId) &&
      isActiveTaskStatus(task.status),
  )
  if (!running.length || !sessionId) return null
  return running.find((task) => task.id === sessionId) ?? null
}

export function resolveCanvasPromptAiBusyState(
  tasks: WorkflowTask[],
  projectId: string,
): PromptAiBusyState | null {
  const extract = getActiveCanvasPromptExtractTask(tasks, projectId)
  if (extract?.canvasSourceNodeId) {
    return { kind: 'extract', nodeId: extract.canvasSourceNodeId }
  }
  const storyboard = getActiveCanvasPromptStoryboardTask(tasks, projectId)
  if (storyboard?.canvasSourceNodeId) {
    return { kind: 'storyboard', nodeId: storyboard.canvasSourceNodeId }
  }
  return null
}

export function getInflightCanvasPromptAiTask(
  projectId: string,
  kind?: PromptAiBusyKind,
  sourceNodeId?: string,
): CanvasPromptAiInflightRun | undefined {
  if (kind && sourceNodeId) {
    return inflightByKey.get(inflightKey(projectId, kind, sourceNodeId))
  }
  for (const run of inflightByKey.values()) {
    if (run.projectId === projectId) return run
  }
  return undefined
}

function resolvePromptAiTaskLabel(task: WorkflowTask): string {
  const kindLabel = task.type === 'extract' ? '提取资产' : '智能分镜'
  return `文本节点 · ${kindLabel}`
}

export function toUnifiedCanvasPromptAiTaskEntry(entry: CanvasPromptAiTaskEntry): UnifiedTaskEntry {
  return {
    source: 'canvas',
    projectId: entry.projectId,
    projectTitle: entry.projectTitle,
    task: {
      id: entry.task.id,
      type: entry.task.type,
      status: entry.task.status,
      progressMessage: entry.task.progressMessage,
      errorMessage: entry.task.errorMessage,
      label: resolvePromptAiTaskLabel(entry.task),
      createdAt: entry.task.createdAt,
      updatedAt: entry.task.updatedAt ?? entry.task.createdAt,
    },
  }
}

export async function listCanvasPromptAiTaskEntries(): Promise<CanvasPromptAiTaskEntry[]> {
  if (!isCanvasApiAvailable()) return []
  const projects = await listCanvasProjects()
  const groups = await Promise.all(
    projects.map(async (project) => {
      try {
        const tasks = await readCanvasTasks(project.id)
        return tasks
          .filter((task) => isCanvasPromptAiTask(task) && isActiveTaskStatus(task.status))
          .map((task) => ({
            projectId: project.id,
            projectTitle: project.title,
            task,
          }))
      } catch {
        return []
      }
    }),
  )
  return groups
    .flat()
    .sort((a, b) => (b.task.updatedAt ?? b.task.createdAt) - (a.task.updatedAt ?? a.task.createdAt))
}

async function appendCanvasGraphPersisted(
  projectId: string,
  newNodes: Node[],
  newEdges: Edge[],
): Promise<void> {
  if (!newNodes.length && !newEdges.length) return
  await patchCanvasData(projectId, (current) => ({
    ...current,
    nodes: [...current.nodes, ...newNodes],
    edges: [...current.edges, ...newEdges],
  }))
  const bridge = getCanvasProjectRunBridge(projectId)
  bridge?.appendGraph?.(newNodes, newEdges)
}

async function removeCanvasNodesPersisted(projectId: string, nodeIds: string[]): Promise<void> {
  if (!nodeIds.length) return
  const idSet = new Set(nodeIds)
  await patchCanvasData(projectId, (current) => ({
    ...current,
    nodes: current.nodes.filter((node) => !idSet.has(node.id)),
    edges: current.edges.filter(
      (edge) => !idSet.has(edge.source) && !idSet.has(edge.target),
    ),
  }))
  const bridge = getCanvasProjectRunBridge(projectId)
  bridge?.removeNodesByIds?.(nodeIds, { silent: true })
}

async function failCanvasPromptAiTask(
  projectId: string,
  taskId: string,
  kind: PromptAiBusyKind,
  sourceNodeId: string,
  message: string,
  progressMessage: string,
  createdAt: number,
): Promise<void> {
  const now = Date.now()
  await upsertCanvasTask(projectId, {
    id: taskId,
    type: kind,
    status: 'failed',
    canvasSourceNodeId: sourceNodeId,
    errorMessage: message,
    progressMessage,
    createdAt,
    updatedAt: now,
  })
  clearCanvasPromptAiSession(projectId, kind)
  refreshUnifiedTaskStore()
}

async function executeCanvasPromptStoryboardTask(input: {
  projectId: string
  taskId: string
  sourceNode: Node
  content: string
  settings: AppSettings
  existingNodes: Node[]
  existingEdges: Edge[]
  inflight: CanvasPromptAiInflightRun
}): Promise<CanvasPromptAiTaskResult> {
  const { projectId, taskId, sourceNode, inflight } = input
  const sourceNodeId = sourceNode.id
  const createdAt = Date.now()

  try {
    await upsertCanvasTask(projectId, {
      id: taskId,
      type: 'storyboard',
      status: 'running',
      canvasSourceNodeId: sourceNodeId,
      progressMessage: '智能分镜中…',
      createdAt,
      updatedAt: createdAt,
    })
    refreshUnifiedTaskStore()

    const signal = inflight.abortController.signal
    const result = await runCanvasPromptStoryboard({
      sourceNode,
      content: input.content,
      settings: input.settings,
      canvasProjectId: projectId,
      existingNodes: input.existingNodes,
      existingEdges: input.existingEdges,
      signal,
    })

    // 二次门闸：取消/abort 后即便 LLM 已返回也禁止落盘与追加节点
    if (signal.aborted) inflight.cancelled = true
    if (!canPersistCanvasPromptAiResult({ cancelled: inflight.cancelled, signal })) {
      return { kind: 'storyboard', sourceNodeId, appliedToUi: false, cancelled: true }
    }

    await appendCanvasGraphPersisted(projectId, result.nodes, result.edges)
    patchCanvasNodeData(
      projectId,
      sourceNodeId,
      { lastStoryboardSummary: result.summary },
      { flush: true },
    )

    const now = Date.now()
    await upsertCanvasTask(projectId, {
      id: taskId,
      type: 'storyboard',
      status: 'completed',
      canvasSourceNodeId: sourceNodeId,
      progressMessage: `已生成 ${result.shots.length} 个分镜`,
      createdAt,
      updatedAt: now,
    })
    clearCanvasStoryboardSessionTaskId(projectId)
    refreshUnifiedTaskStore()

    return {
      kind: 'storyboard',
      sourceNodeId,
      appliedToUi: Boolean(getCanvasProjectRunBridge(projectId)),
      summary: result.summary,
      createdNodeIds: result.nodes.map((node) => node.id),
    }
  } catch (error: unknown) {
    if (inflight.cancelled || isCanvasPromptAiAbortError(error)) {
      return { kind: 'storyboard', sourceNodeId, appliedToUi: false, cancelled: true }
    }
    const message = resolveCanvasPromptStoryboardErrorMessage(error)
    await failCanvasPromptAiTask(
      projectId,
      taskId,
      'storyboard',
      sourceNodeId,
      message,
      '智能分镜失败',
      createdAt,
    )
    throw error
  }
}

async function executeCanvasPromptExtractTask(input: {
  projectId: string
  taskId: string
  sourceNode: Node
  content: string
  settings: AppSettings
  existingNodes: Node[]
  existingEdges: Edge[]
  boundAssetIds: string[]
  inflight: CanvasPromptAiInflightRun
}): Promise<CanvasPromptAiTaskResult> {
  const { projectId, taskId, sourceNode, inflight, boundAssetIds } = input
  const sourceNodeId = sourceNode.id
  const createdAt = Date.now()

  try {
    await upsertCanvasTask(projectId, {
      id: taskId,
      type: 'extract',
      status: 'running',
      canvasSourceNodeId: sourceNodeId,
      progressMessage: '资产提取中…',
      createdAt,
      updatedAt: createdAt,
    })
    refreshUnifiedTaskStore()

    const signal = inflight.abortController.signal
    const result = await runCanvasPromptExtract({
      sourceNode,
      content: input.content,
      settings: input.settings,
      canvasProjectId: projectId,
      existingNodes: input.existingNodes,
      existingEdges: input.existingEdges,
      signal,
    })

    // 二次门闸：取消/abort 后即便 LLM 已返回也禁止删旧资产与落盘
    if (signal.aborted) inflight.cancelled = true
    if (!canPersistCanvasPromptAiResult({ cancelled: inflight.cancelled, signal })) {
      return { kind: 'extract', sourceNodeId, appliedToUi: false, cancelled: true }
    }

    // 成功且未取消后再清空旧资产并写入，避免取消后已删原节点却无新结果
    if (boundAssetIds.length) {
      await removeCanvasNodesPersisted(projectId, boundAssetIds)
      patchCanvasNodeData(projectId, sourceNodeId, { lastExtractSummary: undefined }, { flush: true })
    }

    await appendCanvasGraphPersisted(projectId, result.assetNodes, result.assetEdges)
    patchCanvasNodeData(
      projectId,
      sourceNodeId,
      { lastExtractSummary: result.summary },
      { flush: true },
    )

    const now = Date.now()
    await upsertCanvasTask(projectId, {
      id: taskId,
      type: 'extract',
      status: 'completed',
      canvasSourceNodeId: sourceNodeId,
      progressMessage: result.summary,
      createdAt,
      updatedAt: now,
    })
    clearCanvasExtractSessionTaskId(projectId)
    refreshUnifiedTaskStore()

    return {
      kind: 'extract',
      sourceNodeId,
      appliedToUi: Boolean(getCanvasProjectRunBridge(projectId)),
      summary: result.summary,
      createdNodeIds: result.assetNodes.map((node) => node.id),
    }
  } catch (error: unknown) {
    if (inflight.cancelled || isCanvasPromptAiAbortError(error)) {
      return { kind: 'extract', sourceNodeId, appliedToUi: false, cancelled: true }
    }
    const message = resolveCanvasPromptExtractErrorMessage(error)
    await failCanvasPromptAiTask(
      projectId,
      taskId,
      'extract',
      sourceNodeId,
      message,
      '资产提取失败',
      createdAt,
    )
    throw error
  }
}

export function startCanvasPromptStoryboardTask(input: {
  projectId: string
  sourceNode: Node
  content: string
  settings: AppSettings
  existingNodes: Node[]
  existingEdges: Edge[]
}): { taskId: string; promise: Promise<CanvasPromptAiTaskResult> } {
  const key = inflightKey(input.projectId, 'storyboard', input.sourceNode.id)
  const existing = inflightByKey.get(key)
  if (existing) return { taskId: existing.taskId, promise: existing.promise }

  const taskId = `task_${generateUUID()}`
  setCanvasStoryboardSessionTaskId(input.projectId, taskId)

  const inflight: CanvasPromptAiInflightRun = {
    projectId: input.projectId,
    taskId,
    kind: 'storyboard',
    sourceNodeId: input.sourceNode.id,
    cancelled: false,
    abortController: new AbortController(),
    promise: Promise.resolve({ kind: 'storyboard', sourceNodeId: input.sourceNode.id, appliedToUi: false }),
  }

  const promise = executeCanvasPromptStoryboardTask({
    ...input,
    taskId,
    inflight,
  }).finally(() => {
    if (inflightByKey.get(key)?.taskId === taskId) {
      inflightByKey.delete(key)
    }
  })

  inflight.promise = promise
  inflightByKey.set(key, inflight)
  return { taskId, promise }
}

export function startCanvasPromptExtractTask(input: {
  projectId: string
  sourceNode: Node
  content: string
  settings: AppSettings
  existingNodes: Node[]
  existingEdges: Edge[]
  boundAssetIds: string[]
}): { taskId: string; promise: Promise<CanvasPromptAiTaskResult> } {
  const key = inflightKey(input.projectId, 'extract', input.sourceNode.id)
  const existing = inflightByKey.get(key)
  if (existing) return { taskId: existing.taskId, promise: existing.promise }

  const taskId = `task_${generateUUID()}`
  setCanvasExtractSessionTaskId(input.projectId, taskId)

  const inflight: CanvasPromptAiInflightRun = {
    projectId: input.projectId,
    taskId,
    kind: 'extract',
    sourceNodeId: input.sourceNode.id,
    cancelled: false,
    abortController: new AbortController(),
    promise: Promise.resolve({ kind: 'extract', sourceNodeId: input.sourceNode.id, appliedToUi: false }),
  }

  const promise = executeCanvasPromptExtractTask({
    ...input,
    taskId,
    inflight,
  }).finally(() => {
    if (inflightByKey.get(key)?.taskId === taskId) {
      inflightByKey.delete(key)
    }
  })

  inflight.promise = promise
  inflightByKey.set(key, inflight)
  return { taskId, promise }
}

/** 切页/关应用后 tasks.json 可能仍为 running，无 session 或超时则标记失败 */
export async function reconcileStaleCanvasPromptAiTasks(
  projectId: string,
): Promise<WorkflowTask | null> {
  if (getInflightCanvasPromptAiTask(projectId)) return null

  const tasks = await readCanvasTasks(projectId)
  const now = Date.now()
  let changed = false
  let failedTask: WorkflowTask | null = null

  const next = tasks.map((task) => {
    if (!isCanvasPromptAiTask(task) || !isActiveTaskStatus(task.status)) return task

    const kind = task.type as PromptAiBusyKind
    const sessionTaskId = getCanvasPromptAiSessionTaskId(projectId, kind)
    const updatedAt = task.updatedAt ?? task.createdAt ?? 0
    const sameSession = sessionTaskId === task.id
    const hung = now - updatedAt > CANVAS_PROMPT_AI_HANG_MS

    if (sameSession && !hung) return task

    changed = true
    const failed: WorkflowTask = {
      ...task,
      status: 'failed',
      errorMessage: hung
        ? kind === 'extract'
          ? '资产提取超时，请稍后重试'
          : '智能分镜超时，请稍后重试'
        : kind === 'extract'
          ? '资产提取已中断，请重新提取'
          : '智能分镜已中断，请重新生成',
      progressMessage: kind === 'extract' ? '提取已中断' : '分镜已中断',
      updatedAt: now,
    }
    failedTask = failed
    return failed
  })

  if (!changed) return null

  await writeCanvasTasks(projectId, next)
  if (failedTask) {
    const kind = failedTask.type as PromptAiBusyKind
    clearCanvasPromptAiSession(projectId, kind)
  }
  refreshUnifiedTaskStore()
  return failedTask
}

export async function cancelCanvasPromptAiTask(
  projectId: string,
  taskId: string,
): Promise<boolean> {
  const tasks = await readCanvasTasks(projectId)
  const task = tasks.find((item) => item.id === taskId)
  if (!task || !isCanvasPromptAiTask(task) || !isActiveTaskStatus(task.status)) {
    return false
  }

  const kind = task.type as PromptAiBusyKind
  const sourceNodeId = task.canvasSourceNodeId
  if (sourceNodeId) {
    const inflight = getInflightCanvasPromptAiTask(projectId, kind, sourceNodeId)
    if (inflight) {
      inflight.cancelled = true
      try {
        inflight.abortController.abort()
      } catch {
        /* ignore */
      }
    }
  }

  const now = Date.now()
  await upsertCanvasTask(projectId, {
    ...task,
    status: 'failed',
    errorMessage: kind === 'extract' ? '资产提取已取消' : '智能分镜已取消',
    progressMessage: '已取消',
    updatedAt: now,
  })
  clearCanvasPromptAiSession(projectId, kind)
  refreshUnifiedTaskStore()
  return true
}

/** 按当前忙态取消画布智能分镜 / 提取资产（节点遮罩与运行队列用） */
export async function cancelActiveCanvasPromptAi(
  projectId: string,
  busy?: PromptAiBusyState | null,
): Promise<boolean> {
  const inflight = busy
    ? getInflightCanvasPromptAiTask(projectId, busy.kind, busy.nodeId)
    : getInflightCanvasPromptAiTask(projectId)
  if (!inflight) return false
  return cancelCanvasPromptAiTask(projectId, inflight.taskId)
}

export async function dismissCanvasPromptAiTask(
  projectId: string,
  taskId: string,
): Promise<boolean> {
  if (await cancelCanvasPromptAiTask(projectId, taskId)) return true
  const tasks = await readCanvasTasks(projectId)
  const next = tasks.filter((task) => task.id !== taskId)
  if (next.length === tasks.length) return false
  await writeCanvasTasks(projectId, next)
  refreshUnifiedTaskStore()
  return true
}
