// Copyright (c) local-creator contributors. All rights reserved.

import type { WorkflowEpisode, WorkflowShot, WorkflowTask } from '@/types/workflow'
import type { VideoRemoteJobSnapshot } from '@/types/video-remote-job'
import { generateUUID } from '@/lib/utils'
import {
  readWorkflowData,
  readWorkflowTasks,
  writeWorkflowData,
  writeWorkflowTasks,
} from '@/lib/storage/workflow-service'
import { cancelWorkflowTask, upsertWorkflowTask, isActiveTaskStatus } from '@/lib/workflow/task-service'
import { updateShotList } from '@/lib/workflow/shot-utils'
import { isWorkflowVideoTaskResumable } from '@/lib/workflow/workflow-video-resume-service'
import { useTaskStore } from '@/stores/task-store'
import { useWorkflowSessionStore } from '@/stores/workflow-session-store'

export const VIDEO_POLL_MS = 2000
export const VIDEO_HANG_MS = 30 * 60 * 1000

const VIDEO_SESSION_PREFIX = 'lc:video:'

export interface InflightVideoSession {
  taskId: string
  promise: Promise<void>
  isBatch: boolean
  generatingShotId?: string | null
}

/** projectId → taskId → session（支持同项目多路单镜/批量生视频） */
const inflightVideoByProject = new Map<string, Map<string, InflightVideoSession>>()

/** 用户终止后标记镜头，生视频流程在关键节点检查后提前退出 */
const cancelledVideoShotIds = new Set<string>()

/** 单镜生视频 AbortController（shotId → controller） */
const videoAbortControllersByShot = new Map<string, AbortController>()

export function markWorkflowVideoGenerationCancelled(shotId: string): void {
  cancelledVideoShotIds.add(shotId)
}

export function isWorkflowVideoGenerationCancelled(shotId: string): boolean {
  return cancelledVideoShotIds.has(shotId)
}

export function clearWorkflowVideoGenerationCancelled(shotId: string): void {
  cancelledVideoShotIds.delete(shotId)
}

export function bindWorkflowVideoGenerationAbort(shotId: string, controller: AbortController): void {
  videoAbortControllersByShot.get(shotId)?.abort()
  videoAbortControllersByShot.set(shotId, controller)
}

export function unbindWorkflowVideoGenerationAbort(
  shotId: string,
  controller?: AbortController,
): void {
  const current = videoAbortControllersByShot.get(shotId)
  if (!current) return
  if (!controller || current === controller) {
    videoAbortControllersByShot.delete(shotId)
  }
}

/** 终止时 abort 网络请求并标记取消 */
export function abortWorkflowVideoGenerationSignal(shotId: string): void {
  markWorkflowVideoGenerationCancelled(shotId)
  videoAbortControllersByShot.get(shotId)?.abort()
  videoAbortControllersByShot.delete(shotId)
}

function syncWorkflowSessionShotPatch(
  projectId: string,
  shotId: string,
  patch: Partial<WorkflowShot>,
): void {
  const session = useWorkflowSessionStore.getState()
  if (session.projectId !== projectId || !session.data?.shots) return
  session.patchData({ shots: updateShotList(session.data.shots, shotId, patch) })
}

async function persistWorkflowShotPatch(
  projectId: string,
  shotId: string,
  patch: Partial<WorkflowShot>,
): Promise<void> {
  const data = await readWorkflowData(projectId)
  const shots = updateShotList(data.shots ?? [], shotId, patch)
  await writeWorkflowData(projectId, { ...data, shots })
  syncWorkflowSessionShotPatch(projectId, shotId, patch)
}

/** 终止工坊单镜/批量中的某路生视频，并同步分镜 videoStatus 与任务记录 */
export async function stopWorkflowVideoGeneration(
  projectId: string,
  options?: { taskId?: string | null; shotId?: string | null },
): Promise<boolean> {
  const shotIdHint = options?.shotId ?? null
  if (shotIdHint) {
    abortWorkflowVideoGenerationSignal(shotIdHint)
  }

  const inflightSessions = listInflightVideoGenerations(projectId)
  const inflightSession = shotIdHint
    ? inflightSessions.find((session) => !session.isBatch && session.generatingShotId === shotIdHint)
    : options?.taskId
      ? inflightSessions.find((session) => session.taskId === options.taskId)
      : undefined

  let taskId = options?.taskId ?? inflightSession?.taskId ?? null
  let shotId = shotIdHint

  const tasks = await readWorkflowTasks(projectId)
  if (!taskId && shotId) {
    const matched = tasks.find(
      (item) =>
        item.type === 'video' && item.shotId === shotId && isActiveTaskStatus(item.status),
    )
    taskId = matched?.id ?? null
  }
  if (!shotId && taskId) {
    shotId = tasks.find((item) => item.id === taskId)?.shotId ?? null
    if (shotId) abortWorkflowVideoGenerationSignal(shotId)
  }

  let didCancel = false
  if (taskId) {
    cancelInflightVideoGeneration(projectId, taskId)
    const cancelled = await cancelVideoGenerationTask(projectId, taskId, {
      progressMessage: '已终止',
      errorMessage: '生视频已取消',
    })
    didCancel = Boolean(cancelled)
  } else if (shotIdHint) {
    for (const session of inflightSessions) {
      if (!session.isBatch && session.generatingShotId === shotIdHint) {
        cancelInflightVideoGeneration(projectId, session.taskId)
        didCancel = true
      }
    }
  }

  if (shotId) {
    await persistWorkflowShotPatch(projectId, shotId, { videoStatus: 'failed' })
    return true
  }
  return didCancel
}

function getProjectInflightMap(projectId: string): Map<string, InflightVideoSession> {
  let map = inflightVideoByProject.get(projectId)
  if (!map) {
    map = new Map()
    inflightVideoByProject.set(projectId, map)
  }
  return map
}

export function registerInflightVideoGeneration(
  projectId: string,
  taskId: string,
  promise: Promise<void>,
  options?: { isBatch?: boolean; generatingShotId?: string | null },
): void {
  const map = getProjectInflightMap(projectId)
  map.set(taskId, {
    taskId,
    promise,
    isBatch: options?.isBatch ?? false,
    generatingShotId: options?.generatingShotId ?? null,
  })
  addVideoSessionTaskId(projectId, taskId)
  void promise.finally(() => {
    const current = inflightVideoByProject.get(projectId)
    if (!current?.has(taskId)) return
    current.delete(taskId)
    removeVideoSessionTaskId(projectId, taskId)
    if (current.size === 0) {
      inflightVideoByProject.delete(projectId)
    }
  })
}

export function listInflightVideoGenerations(projectId: string): InflightVideoSession[] {
  const map = inflightVideoByProject.get(projectId)
  return map ? [...map.values()] : []
}

export function countInflightVideoGenerations(
  projectId: string,
  options?: { singleShotOnly?: boolean },
): number {
  const sessions = listInflightVideoGenerations(projectId)
  if (options?.singleShotOnly) {
    return sessions.filter((session) => !session.isBatch).length
  }
  return sessions.length
}

export function isInflightVideoTask(projectId: string, taskId: string): boolean {
  return inflightVideoByProject.get(projectId)?.has(taskId) ?? false
}

export function getInflightVideoGeneration(projectId: string): InflightVideoSession | undefined {
  const map = inflightVideoByProject.get(projectId)
  if (!map || map.size === 0) return undefined
  return map.values().next().value
}

export function isVideoGenerationInflight(projectId: string): boolean {
  const map = inflightVideoByProject.get(projectId)
  return map != null && map.size > 0
}

export function listAllInflightVideoGenerations(): Array<{
  projectId: string
  session: InflightVideoSession
}> {
  const result: Array<{ projectId: string; session: InflightVideoSession }> = []
  for (const [projectId, map] of inflightVideoByProject.entries()) {
    for (const session of map.values()) {
      result.push({ projectId, session })
    }
  }
  return result
}

/** 用户终止任务时立即解除内存中的生视频会话，避免 UI 继续显示「进行中」 */
export function cancelInflightVideoGeneration(projectId: string, taskId?: string): boolean {
  const map = inflightVideoByProject.get(projectId)
  if (!map || map.size === 0) return false
  if (taskId) {
    if (!map.has(taskId)) return false
    map.delete(taskId)
    removeVideoSessionTaskId(projectId, taskId)
    if (map.size === 0) {
      inflightVideoByProject.delete(projectId)
    }
    return true
  }
  inflightVideoByProject.delete(projectId)
  clearVideoSessionTaskIds(projectId)
  return true
}

export function getActiveVideoTask(
  tasks: WorkflowTask[],
  projectId?: string,
): WorkflowTask | null {
  const running = tasks.filter(
    (t) => t.type === 'video' && (t.status === 'pending' || t.status === 'running'),
  )
  if (!running.length) return null
  if (projectId && isVideoGenerationInflight(projectId)) {
    const inflightIds = new Set(
      listInflightVideoGenerations(projectId).map((session) => session.taskId),
    )
    const matched = running.find((task) => inflightIds.has(task.id))
    if (matched) return matched
  }
  const sessionIds = projectId ? getVideoSessionTaskIds(projectId) : []
  if (sessionIds.length > 0) {
    for (let i = sessionIds.length - 1; i >= 0; i -= 1) {
      const matched = running.find((task) => task.id === sessionIds[i])
      if (matched) return matched
    }
  }
  return running[0] ?? null
}

export function createVideoTaskId(): string {
  return `task_${generateUUID()}`
}

function episodeMeta(episode?: WorkflowEpisode | null) {
  if (!episode) return {}
  return {
    episodeId: episode.id,
    episodeIndex: episode.episodeIndex,
    episodeTitle: episode.title,
  }
}

function readVideoSessionTaskIds(projectId: string): string[] {
  try {
    const raw = sessionStorage.getItem(`${VIDEO_SESSION_PREFIX}${projectId}`)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
      }
    } catch {
      /* 兼容旧版单 taskId 字符串 */
    }
    return raw.length > 0 ? [raw] : []
  } catch {
    return []
  }
}

function writeVideoSessionTaskIds(projectId: string, taskIds: string[]) {
  try {
    if (taskIds.length === 0) {
      sessionStorage.removeItem(`${VIDEO_SESSION_PREFIX}${projectId}`)
      return
    }
    sessionStorage.setItem(`${VIDEO_SESSION_PREFIX}${projectId}`, JSON.stringify(taskIds))
  } catch {
    /* ignore */
  }
}

export function getVideoSessionTaskIds(projectId: string): string[] {
  return readVideoSessionTaskIds(projectId)
}

export function getVideoSessionTaskId(projectId: string): string | null {
  const ids = readVideoSessionTaskIds(projectId)
  return ids[ids.length - 1] ?? null
}

export function addVideoSessionTaskId(projectId: string, taskId: string) {
  const ids = new Set(readVideoSessionTaskIds(projectId))
  ids.add(taskId)
  writeVideoSessionTaskIds(projectId, [...ids])
}

export function removeVideoSessionTaskId(projectId: string, taskId: string) {
  writeVideoSessionTaskIds(
    projectId,
    readVideoSessionTaskIds(projectId).filter((id) => id !== taskId),
  )
}

export function setVideoSessionTaskId(projectId: string, taskId: string) {
  addVideoSessionTaskId(projectId, taskId)
}

export function clearVideoSessionTaskId(projectId: string) {
  clearVideoSessionTaskIds(projectId)
}

export function clearVideoSessionTaskIds(projectId: string) {
  writeVideoSessionTaskIds(projectId, [])
}

async function persistVideoTask(projectId: string, task: WorkflowTask, refresh = true) {
  await upsertWorkflowTask(projectId, task)
  if (refresh) void useTaskStore.getState().refresh()
}

function isActiveVideoSessionTask(projectId: string, taskId: string): boolean {
  if (isInflightVideoTask(projectId, taskId)) return true
  return getVideoSessionTaskIds(projectId).includes(taskId)
}

/** 清理已中断或超时的生视频任务（关应用后 tasks.json 可能仍为 running） */
export async function reconcileStaleVideoTasks(
  projectId: string,
): Promise<WorkflowTask | null> {
  const tasks = await readWorkflowTasks(projectId)
  const now = Date.now()
  let changed = false
  let failedTask: WorkflowTask | null = null

  const next = tasks.map((task) => {
    if (task.type !== 'video' || (task.status !== 'pending' && task.status !== 'running')) {
      return task
    }

    if (isWorkflowVideoTaskResumable(task, now)) {
      return task
    }

    const updatedAt = task.updatedAt ?? task.createdAt ?? 0
    const sameSession = isActiveVideoSessionTask(projectId, task.id)
    const hung = now - updatedAt > VIDEO_HANG_MS

    if (sameSession && !hung) return task

    changed = true
    const failed: WorkflowTask = {
      ...task,
      status: 'failed',
      errorMessage: hung
        ? '生视频超时，请稍后重试'
        : '生视频已中断，请重新生成',
      progressMessage: '生视频已中断',
      updatedAt: now,
    }
    failedTask = failed
    return failed
  })

  const latestCompletedAt = tasks
    .filter((t) => t.type === 'video' && t.status === 'completed')
    .reduce((max, t) => Math.max(max, t.updatedAt ?? t.createdAt ?? 0), 0)

  const reconciled = next.map((task) => {
    if (task.type !== 'video' || (task.status !== 'pending' && task.status !== 'running')) {
      return task
    }
    // 批量汇总任务仍在内存会话中时，勿因单镜 completed 更新更晚而误判为中断
    if (isActiveVideoSessionTask(projectId, task.id)) {
      return task
    }
    const updatedAt = task.updatedAt ?? task.createdAt ?? 0
    if (latestCompletedAt > updatedAt) {
      changed = true
      const failed: WorkflowTask = {
        ...task,
        status: 'failed',
        errorMessage: '生视频已中断，请重新生成',
        progressMessage: '生视频已中断',
        updatedAt: now,
      }
      failedTask = failedTask ?? failed
      return failed
    }
    return task
  })

  if (!changed) return null

  await writeWorkflowTasks(projectId, reconciled)
  for (const task of reconciled) {
    if (task.status === 'failed' && failedTask?.id === task.id) {
      removeVideoSessionTaskId(projectId, task.id)
    }
  }
  return failedTask
}

export async function cancelVideoGenerationTask(
  projectId: string,
  taskId: string,
  options?: { errorMessage?: string; progressMessage?: string },
): Promise<WorkflowTask | null> {
  cancelInflightVideoGeneration(projectId, taskId)
  const cancelled = await cancelWorkflowTask(projectId, taskId, {
    errorMessage: options?.errorMessage ?? '任务已手动终止',
    progressMessage: options?.progressMessage ?? '已终止',
  })
  if (cancelled) {
    removeVideoSessionTaskId(projectId, taskId)
  }
  void useTaskStore.getState().refresh()
  return cancelled
}

export async function startVideoGenerationTask(
  projectId: string,
  taskId: string,
  options: {
    episode?: WorkflowEpisode | null
    progressMessage: string
    createdAt?: number
    shotId?: string
  },
): Promise<number> {
  const createdAt = options.createdAt ?? Date.now()
  addVideoSessionTaskId(projectId, taskId)
  await persistVideoTask(projectId, {
    id: taskId,
    type: 'video',
    status: 'running',
    progressMessage: options.progressMessage,
    shotId: options.shotId,
    ...episodeMeta(options.episode),
    createdAt,
    updatedAt: createdAt,
  })
  return createdAt
}

export async function persistVideoTaskRemoteJob(
  projectId: string,
  taskId: string,
  remoteJob: VideoRemoteJobSnapshot,
  options?: { shotId?: string; progressMessage?: string },
): Promise<void> {
  const tasks = await readWorkflowTasks(projectId)
  const existing = tasks.find((item) => item.id === taskId)
  if (existing && !isActiveTaskStatus(existing.status)) return

  await persistVideoTask(
    projectId,
    {
      id: taskId,
      type: 'video',
      status: 'running',
      progressMessage: options?.progressMessage ?? existing?.progressMessage ?? '生视频中…',
      shotId: options?.shotId ?? existing?.shotId,
      remoteJob,
      episodeId: existing?.episodeId,
      episodeIndex: existing?.episodeIndex,
      episodeTitle: existing?.episodeTitle,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    },
    true,
  )
}

export async function updateVideoGenerationTask(
  projectId: string,
  taskId: string,
  progressMessage: string,
  createdAt: number,
  episode?: WorkflowEpisode | null,
) {
  const tasks = await readWorkflowTasks(projectId)
  const existing = tasks.find((t) => t.id === taskId)
  if (existing && !isActiveTaskStatus(existing.status)) return

  await persistVideoTask(
    projectId,
    {
      ...(existing ?? {}),
      id: taskId,
      type: 'video',
      status: 'running',
      progressMessage,
      shotId: existing?.shotId,
      remoteJob: existing?.remoteJob,
      errorMessage: existing?.errorMessage,
      ...episodeMeta(episode),
      episodeId: episode?.id ?? existing?.episodeId,
      episodeIndex: episode?.episodeIndex ?? existing?.episodeIndex,
      episodeTitle: episode?.title ?? existing?.episodeTitle,
      createdAt: existing?.createdAt ?? createdAt,
      updatedAt: Date.now(),
    },
    false,
  )
  void useTaskStore.getState().refresh()
}

export async function finishVideoGenerationTask(
  projectId: string,
  taskId: string,
  outcome: {
    status: 'completed' | 'failed'
    progressMessage: string
    errorMessage?: string
  },
  createdAt: number,
  episode?: WorkflowEpisode | null,
) {
  const tasks = await readWorkflowTasks(projectId)
  const existing = tasks.find((t) => t.id === taskId)
  if (existing && !isActiveTaskStatus(existing.status)) {
    removeVideoSessionTaskId(projectId, taskId)
    return
  }

  removeVideoSessionTaskId(projectId, taskId)
  const meta = episode
    ? episodeMeta(episode)
    : {
        episodeId: existing?.episodeId,
        episodeIndex: existing?.episodeIndex,
        episodeTitle: existing?.episodeTitle,
      }
  await persistVideoTask(projectId, {
    id: taskId,
    type: 'video',
    status: outcome.status,
    progressMessage: outcome.progressMessage,
    errorMessage: outcome.errorMessage,
    shotId: existing?.shotId,
    remoteJob: undefined,
    ...meta,
    createdAt,
    updatedAt: Date.now(),
  })
  void useTaskStore.getState().refresh()
}
