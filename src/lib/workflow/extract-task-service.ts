import type { WorkflowTask } from '@/types/workflow'
import { readWorkflowTasks, writeWorkflowTasks } from '@/lib/storage/workflow-service'

export const EXTRACT_POLL_MS = 2000
export const EXTRACT_HANG_MS = 10 * 60 * 1000

const EXTRACT_SESSION_PREFIX = 'haode:extract:'

export type ExtractSessionKind = 'replace_all' | 'episode_reextract'

function sessionTaskKey(projectId: string) {
  return `${EXTRACT_SESSION_PREFIX}${projectId}`
}

function sessionKindKey(projectId: string) {
  return `${EXTRACT_SESSION_PREFIX}${projectId}:kind`
}

export function getExtractSessionKind(projectId: string): ExtractSessionKind | null {
  try {
    const raw = sessionStorage.getItem(sessionKindKey(projectId))
    if (raw === 'replace_all' || raw === 'episode_reextract') return raw
    return null
  } catch {
    return null
  }
}

/** 从任务推断提取类型（切页/轮询恢复 UI 用） */
export function resolveExtractKindFromTask(
  task: WorkflowTask | null | undefined,
): ExtractSessionKind | null {
  if (!task || task.type !== 'extract') return null
  if (task.episodeId) return 'episode_reextract'
  const msg = task.progressMessage ?? ''
  if (/重提本集|重提第\s*\d+\s*集/.test(msg)) return 'episode_reextract'
  return 'replace_all'
}

export function getActiveExtractTask(
  tasks: WorkflowTask[],
  projectId?: string,
): WorkflowTask | null {
  const sessionId = projectId ? getExtractSessionTaskId(projectId) : null
  const running = tasks.filter(
    (t) => t.type === 'extract' && (t.status === 'pending' || t.status === 'running'),
  )
  if (!running.length) return null

  if (!sessionId) return null

  return running.find((t) => t.id === sessionId) ?? null
}

function getExtractSessionTaskId(projectId: string) {
  try {
    return sessionStorage.getItem(sessionTaskKey(projectId))
  } catch {
    return null
  }
}

export function setExtractSessionTaskId(
  projectId: string,
  taskId: string,
  kind?: ExtractSessionKind,
) {
  try {
    sessionStorage.setItem(sessionTaskKey(projectId), taskId)
    if (kind) {
      sessionStorage.setItem(sessionKindKey(projectId), kind)
    }
  } catch {
    /* ignore */
  }
}

export function clearExtractSessionTaskId(projectId: string) {
  try {
    sessionStorage.removeItem(sessionTaskKey(projectId))
    sessionStorage.removeItem(sessionKindKey(projectId))
  } catch {
    /* ignore */
  }
}

/** 清理已中断或超时的提取任务（切页/关应用后 tasks.json 可能仍为 running） */
export async function reconcileStaleExtractTasks(
  projectId: string,
): Promise<WorkflowTask | null> {
  const sessionTaskId = getExtractSessionTaskId(projectId)
  const tasks = await readWorkflowTasks(projectId)
  const now = Date.now()
  let changed = false
  let failedTask: WorkflowTask | null = null

  const next = tasks.map((task) => {
    if (task.type !== 'extract' || (task.status !== 'pending' && task.status !== 'running')) {
      return task
    }

    const updatedAt = task.updatedAt ?? task.createdAt ?? 0
    const sameSession = sessionTaskId === task.id
    const hung = now - updatedAt > EXTRACT_HANG_MS

    if (sameSession && !hung) return task

    changed = true
    const failed: WorkflowTask = {
      ...task,
      status: 'failed',
      errorMessage: hung
        ? '资产提取超时，请稍后重试'
        : '资产提取已中断，请重新点击 AI 提取资产',
      progressMessage: '提取已中断',
      updatedAt: now,
    }
    failedTask = failed
    return failed
  })

  // 若已有更新的 completed 任务，清理同类型的遗留 running（避免按钮永久禁用）
  const latestCompletedAt = tasks
    .filter((t) => t.type === 'extract' && t.status === 'completed')
    .reduce((max, t) => Math.max(max, t.updatedAt ?? t.createdAt ?? 0), 0)

  const reconciled = next.map((task) => {
    if (task.type !== 'extract' || (task.status !== 'pending' && task.status !== 'running')) {
      return task
    }
    const updatedAt = task.updatedAt ?? task.createdAt ?? 0
    if (latestCompletedAt > updatedAt) {
      changed = true
      const failed: WorkflowTask = {
        ...task,
        status: 'failed',
        errorMessage: '资产提取已中断，请重新点击 AI 提取资产',
        progressMessage: '提取已中断',
        updatedAt: now,
      }
      failedTask = failedTask ?? failed
      return failed
    }
    return task
  })

  if (!changed) return null

  await writeWorkflowTasks(projectId, reconciled)
  if (sessionTaskId && failedTask?.id === sessionTaskId) {
    clearExtractSessionTaskId(projectId)
  }
  return failedTask
}
