import type { AppSettings } from '@/types/settings'
import type { WorkflowEpisode, WorkflowProjectData, WorkflowShot, WorkflowTask } from '@/types/workflow'
import { generateUUID } from '@/lib/utils'
import { readWorkflowTasks, writeWorkflowTasks } from '@/lib/storage/workflow-service'
import { inferEpisodeStoryboard, type InferEpisodeStoryboardResult } from '@/lib/workflow/storyboard-service'
import { upsertWorkflowTask } from '@/lib/workflow/task-service'
import { useTaskStore } from '@/stores/task-store'

export const STORYBOARD_POLL_MS = 2000
export const STORYBOARD_HANG_MS = 10 * 60 * 1000

const STORYBOARD_SESSION_PREFIX = 'lc:storyboard:'

const inflight = new Map<string, Promise<InferEpisodeStoryboardResult>>()

function getStoryboardTaskKey(projectId: string, episodeId: string) {
  return `${projectId}:${episodeId}`
}

export function getInflightStoryboardInference(
  projectId: string,
  episodeId: string,
): Promise<InferEpisodeStoryboardResult> | undefined {
  return inflight.get(getStoryboardTaskKey(projectId, episodeId))
}

export function isStoryboardInferenceInflight(projectId: string, episodeId: string) {
  return inflight.has(getStoryboardTaskKey(projectId, episodeId))
}

function getStoryboardSessionTaskId(projectId: string) {
  try {
    return sessionStorage.getItem(`${STORYBOARD_SESSION_PREFIX}${projectId}`)
  } catch {
    return null
  }
}

export function setStoryboardSessionTaskId(projectId: string, taskId: string) {
  try {
    sessionStorage.setItem(`${STORYBOARD_SESSION_PREFIX}${projectId}`, taskId)
  } catch {
    /* ignore */
  }
}

export function clearStoryboardSessionTaskId(projectId: string) {
  try {
    sessionStorage.removeItem(`${STORYBOARD_SESSION_PREFIX}${projectId}`)
  } catch {
    /* ignore */
  }
}

export function getActiveStoryboardTask(
  tasks: WorkflowTask[],
  projectId?: string,
): WorkflowTask | null {
  const sessionId = projectId ? getStoryboardSessionTaskId(projectId) : null
  const running = tasks.filter(
    (t) => t.type === 'storyboard' && (t.status === 'pending' || t.status === 'running'),
  )
  if (!running.length) return null
  if (!sessionId) return null
  return running.find((t) => t.id === sessionId) ?? null
}

/** 清理已中断或超时的分镜推理任务 */
export async function reconcileStaleStoryboardTasks(
  projectId: string,
): Promise<WorkflowTask | null> {
  const sessionTaskId = getStoryboardSessionTaskId(projectId)
  const tasks = await readWorkflowTasks(projectId)
  const now = Date.now()
  let changed = false
  let failedTask: WorkflowTask | null = null

  const next = tasks.map((task) => {
    if (task.type !== 'storyboard' || (task.status !== 'pending' && task.status !== 'running')) {
      return task
    }

    const updatedAt = task.updatedAt ?? task.createdAt ?? 0
    const sameSession = sessionTaskId === task.id
    const hung = now - updatedAt > STORYBOARD_HANG_MS

    if (sameSession && !hung) return task

    changed = true
    const failed: WorkflowTask = {
      ...task,
      status: 'failed',
      errorMessage: hung
        ? '分镜推理超时，请稍后重试'
        : '分镜推理已中断，请重新点击推理分镜',
      progressMessage: '推理已中断',
      updatedAt: now,
    }
    failedTask = failed
    return failed
  })

  const latestCompletedAt = tasks
    .filter((t) => t.type === 'storyboard' && t.status === 'completed')
    .reduce((max, t) => Math.max(max, t.updatedAt ?? t.createdAt ?? 0), 0)

  const reconciled = next.map((task) => {
    if (task.type !== 'storyboard' || (task.status !== 'pending' && task.status !== 'running')) {
      return task
    }
    const updatedAt = task.updatedAt ?? task.createdAt ?? 0
    if (latestCompletedAt > updatedAt) {
      changed = true
      const failed: WorkflowTask = {
        ...task,
        status: 'failed',
        errorMessage: '分镜推理已中断，请重新点击推理分镜',
        progressMessage: '推理已中断',
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
    clearStoryboardSessionTaskId(projectId)
  }
  return failedTask
}

function episodeProgressLabel(episode: WorkflowEpisode) {
  const title = episode.title?.trim()
  if (title) return `正在推理「${title}」分镜…`
  return `正在推理第 ${episode.episodeIndex} 集分镜…`
}

/** 写入 tasks.json 并执行分镜推理；同集并发调用会复用进行中的 Promise */
export async function inferEpisodeStoryboardWithTask(
  projectId: string,
  data: WorkflowProjectData,
  episode: WorkflowEpisode,
  options: {
    settings: AppSettings
    storyboardTemplateKey?: string
  },
): Promise<InferEpisodeStoryboardResult> {
  const key = getStoryboardTaskKey(projectId, episode.id)
  const existing = inflight.get(key)
  if (existing) return existing

  const taskId = `task_${generateUUID()}`
  const now = Date.now()
  setStoryboardSessionTaskId(projectId, taskId)

  const promise = (async (): Promise<InferEpisodeStoryboardResult> => {
    const episodeMeta = {
      episodeId: episode.id,
      episodeIndex: episode.episodeIndex,
      episodeTitle: episode.title,
    }

    try {
      await upsertWorkflowTask(projectId, {
        id: taskId,
        type: 'storyboard',
        status: 'running',
        progressMessage: episodeProgressLabel(episode),
        ...episodeMeta,
        createdAt: now,
        updatedAt: now,
      })
      void useTaskStore.getState().refresh()

      const result = await inferEpisodeStoryboard(data, episode, { ...options, projectId })

      await upsertWorkflowTask(projectId, {
        id: taskId,
        type: 'storyboard',
        status: 'completed',
        progressMessage: `已生成 ${result.shots.length} 个分镜`,
        ...episodeMeta,
        createdAt: now,
        updatedAt: Date.now(),
      })
      // 不在此处 refresh：避免 Step4 在 patch/save 前 reload 旧分镜
      return result
    } catch (error: unknown) {
      const err = error as Error
      await upsertWorkflowTask(projectId, {
        id: taskId,
        type: 'storyboard',
        status: 'failed',
        errorMessage: err.message || '推理分镜失败',
        progressMessage: '推理失败',
        ...episodeMeta,
        createdAt: now,
        updatedAt: Date.now(),
      })
      void useTaskStore.getState().refresh()
      throw error
    } finally {
      clearStoryboardSessionTaskId(projectId)
    }
  })()

  inflight.set(key, promise)
  try {
    return await promise
  } finally {
    inflight.delete(key)
  }
}
