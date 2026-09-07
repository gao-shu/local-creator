// Copyright (c) local-creator contributors. All rights reserved.

import type { WorkflowEpisode, WorkflowTask } from '@/types/workflow'
import { generateUUID } from '@/lib/utils'
import { readWorkflowTasks, writeWorkflowTasks } from '@/lib/storage/workflow-service'
import { cancelWorkflowTask, isActiveTaskStatus, upsertWorkflowTask } from '@/lib/workflow/task-service'
import { useTaskStore } from '@/stores/task-store'

export const IMAGE_HANG_MS = 30 * 60 * 1000

const IMAGE_SESSION_PREFIX = 'haode:image:'

export interface InflightImageSession {
  taskId: string
  promise: Promise<void>
  shotId?: string | null
  assetId?: string | null
}

/** projectId → taskId → session（支持同项目多路分镜/资产生图） */
const inflightImageByProject = new Map<string, Map<string, InflightImageSession>>()

function getProjectInflightMap(projectId: string): Map<string, InflightImageSession> {
  let map = inflightImageByProject.get(projectId)
  if (!map) {
    map = new Map()
    inflightImageByProject.set(projectId, map)
  }
  return map
}

export function createImageTaskId(): string {
  return `task_${generateUUID()}`
}

export function registerInflightImageGeneration(
  projectId: string,
  taskId: string,
  promise: Promise<void>,
  options?: { shotId?: string | null; assetId?: string | null },
): void {
  const map = getProjectInflightMap(projectId)
  map.set(taskId, {
    taskId,
    promise,
    shotId: options?.shotId ?? null,
    assetId: options?.assetId ?? null,
  })
  addImageSessionTaskId(projectId, taskId)
  void promise.finally(() => {
    const current = inflightImageByProject.get(projectId)
    if (!current?.has(taskId)) return
    current.delete(taskId)
    removeImageSessionTaskId(projectId, taskId)
    if (current.size === 0) {
      inflightImageByProject.delete(projectId)
    }
  })
}

export function listInflightImageGenerations(projectId: string): InflightImageSession[] {
  const map = inflightImageByProject.get(projectId)
  return map ? [...map.values()] : []
}

export function isInflightImageTask(projectId: string, taskId: string): boolean {
  return inflightImageByProject.get(projectId)?.has(taskId) ?? false
}

function readImageSessionTaskIds(projectId: string): string[] {
  try {
    const raw = sessionStorage.getItem(`${IMAGE_SESSION_PREFIX}${projectId}`)
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

function writeImageSessionTaskIds(projectId: string, taskIds: string[]) {
  try {
    if (taskIds.length === 0) {
      sessionStorage.removeItem(`${IMAGE_SESSION_PREFIX}${projectId}`)
      return
    }
    sessionStorage.setItem(`${IMAGE_SESSION_PREFIX}${projectId}`, JSON.stringify(taskIds))
  } catch {
    /* ignore */
  }
}

export function getImageSessionTaskIds(projectId: string): string[] {
  return readImageSessionTaskIds(projectId)
}

function addImageSessionTaskId(projectId: string, taskId: string) {
  const ids = new Set(readImageSessionTaskIds(projectId))
  ids.add(taskId)
  writeImageSessionTaskIds(projectId, [...ids])
}

function removeImageSessionTaskId(projectId: string, taskId: string) {
  writeImageSessionTaskIds(
    projectId,
    readImageSessionTaskIds(projectId).filter((id) => id !== taskId),
  )
}

function episodeMeta(episode?: WorkflowEpisode | null) {
  if (!episode) return {}
  return {
    episodeId: episode.id,
    episodeIndex: episode.episodeIndex,
    episodeTitle: episode.title,
  }
}

async function persistImageTask(projectId: string, task: WorkflowTask, refresh = true) {
  await upsertWorkflowTask(projectId, task)
  if (refresh) void useTaskStore.getState().refresh()
}

function isActiveImageSessionTask(projectId: string, taskId: string): boolean {
  if (isInflightImageTask(projectId, taskId)) return true
  return getImageSessionTaskIds(projectId).includes(taskId)
}

/** 清理已中断或超时的生图任务 */
export async function reconcileStaleImageTasks(projectId: string): Promise<WorkflowTask | null> {
  const tasks = await readWorkflowTasks(projectId)
  const now = Date.now()
  let changed = false
  let failedTask: WorkflowTask | null = null

  const next = tasks.map((task) => {
    if (task.type !== 'image' || (task.status !== 'pending' && task.status !== 'running')) {
      return task
    }

    const updatedAt = task.updatedAt ?? task.createdAt ?? 0
    const sameSession = isActiveImageSessionTask(projectId, task.id)
    const hung = now - updatedAt > IMAGE_HANG_MS

    if (sameSession && !hung) return task

    changed = true
    const failed: WorkflowTask = {
      ...task,
      status: 'failed',
      errorMessage: hung ? '生图超时，请稍后重试' : '生图已中断，请重新生成',
      progressMessage: '生图已中断',
      updatedAt: now,
    }
    failedTask = failed
    return failed
  })

  if (!changed) return null

  await writeWorkflowTasks(projectId, next)
  for (const task of next) {
    if (task.status === 'failed' && failedTask?.id === task.id) {
      removeImageSessionTaskId(projectId, task.id)
    }
  }
  return failedTask
}

export async function cancelImageGenerationTask(
  projectId: string,
  taskId: string,
  options?: { errorMessage?: string; progressMessage?: string },
): Promise<WorkflowTask | null> {
  const map = inflightImageByProject.get(projectId)
  map?.delete(taskId)
  if (map && map.size === 0) {
    inflightImageByProject.delete(projectId)
  }
  const cancelled = await cancelWorkflowTask(projectId, taskId, {
    errorMessage: options?.errorMessage ?? '任务已手动终止',
    progressMessage: options?.progressMessage ?? '已终止',
  })
  if (cancelled) {
    removeImageSessionTaskId(projectId, taskId)
  }
  void useTaskStore.getState().refresh()
  return cancelled
}

export async function startImageGenerationTask(
  projectId: string,
  taskId: string,
  options: {
    episode?: WorkflowEpisode | null
    progressMessage: string
    createdAt?: number
    shotId?: string
    assetId?: string
  },
): Promise<number> {
  const createdAt = options.createdAt ?? Date.now()
  addImageSessionTaskId(projectId, taskId)
  await persistImageTask(projectId, {
    id: taskId,
    type: 'image',
    status: 'running',
    progressMessage: options.progressMessage,
    shotId: options.shotId,
    assetId: options.assetId,
    ...episodeMeta(options.episode),
    createdAt,
    updatedAt: createdAt,
  })
  return createdAt
}

export async function finishImageGenerationTask(
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
    removeImageSessionTaskId(projectId, taskId)
    return
  }

  removeImageSessionTaskId(projectId, taskId)
  const meta = episode
    ? episodeMeta(episode)
    : {
        episodeId: existing?.episodeId,
        episodeIndex: existing?.episodeIndex,
        episodeTitle: existing?.episodeTitle,
      }
  await persistImageTask(projectId, {
    id: taskId,
    type: 'image',
    status: outcome.status,
    progressMessage: outcome.progressMessage,
    errorMessage: outcome.errorMessage,
    shotId: existing?.shotId,
    assetId: existing?.assetId,
    ...meta,
    createdAt,
    updatedAt: Date.now(),
  })
}
