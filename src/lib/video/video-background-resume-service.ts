// Copyright (c) Haode AI. All rights reserved.

import type { WorkflowShot } from '@/types/workflow'
import { readSettings } from '@/lib/storage/settings-service'
import { patchWorkflowData, readWorkflowData } from '@/lib/storage/workflow-service'
import { readWorkflowTasks } from '@/lib/storage/workflow-service'
import { resumeCanvasVideoFromNode } from '@/lib/canvas/canvas-video-resume-service'
import { listResumableCanvasVideoEntries } from '@/lib/canvas/canvas-video-task-service'
import { hasCanvasInflightRun, registerCanvasInflightRun } from '@/lib/canvas/canvas-inflight-run-service'
import { VIDEO_BATCH_CONCURRENCY } from '@/constants/batch-concurrency'
import {
  countInflightVideoGenerations,
  finishVideoGenerationTask,
  isInflightVideoTask,
  registerInflightVideoGeneration,
  updateVideoGenerationTask,
  bindWorkflowVideoGenerationAbort,
  unbindWorkflowVideoGenerationAbort,
  isWorkflowVideoGenerationCancelled,
  clearWorkflowVideoGenerationCancelled,
} from '@/lib/workflow/video-task-service'
import {
  isWorkflowVideoTaskResumable,
  resumeWorkflowVideoFromTask,
} from '@/lib/workflow/workflow-video-resume-service'
import { formatShotVideoGeneratedToast, formatShotVideoFailedToast } from '@/lib/workflow/shot-utils'
import { appendShotGeneratedVideo } from '@/lib/workflow/shot-video-utils'
import { isVideoGenerationAbortError } from '@/lib/video/video-generation-abort'
import { useTaskStore } from '@/stores/task-store'
import {
  hasVideoResumeLock,
  releaseVideoResumeLock,
  tryAcquireVideoResumeLock,
} from '@/lib/video/video-resume-session-lock'

const RESUME_POLL_MS = 5000
const inflightResumeKeys = new Set<string>()

function resumeKey(source: 'workflow' | 'canvas', projectId: string, taskId: string): string {
  return `${source}:${projectId}:${taskId}`
}

function isResumeInflight(source: 'workflow' | 'canvas', projectId: string, taskId: string): boolean {
  return inflightResumeKeys.has(resumeKey(source, projectId, taskId))
}

function markResumeInflight(source: 'workflow' | 'canvas', projectId: string, taskId: string): void {
  inflightResumeKeys.add(resumeKey(source, projectId, taskId))
}

function clearResumeInflight(source: 'workflow' | 'canvas', projectId: string, taskId: string): void {
  inflightResumeKeys.delete(resumeKey(source, projectId, taskId))
}

async function resumeWorkflowVideoTask(
  projectId: string,
  taskId: string,
  shot: WorkflowShot,
  createdAt: number,
): Promise<void> {
  if (isResumeInflight('workflow', projectId, taskId) || isInflightVideoTask(projectId, taskId)) {
    return
  }
  if (!tryAcquireVideoResumeLock('workflow', projectId, taskId)) {
    return
  }

  const tasks = await readWorkflowTasks(projectId)
  const task = tasks.find((item) => item.id === taskId)
  if (!task || !isWorkflowVideoTaskResumable(task)) {
    releaseVideoResumeLock('workflow', projectId, taskId)
    return
  }

  markResumeInflight('workflow', projectId, taskId)
  const settingsRes = await readSettings()
  const settings = settingsRes.data
  const appDataDir = settingsRes.appDataDir
  if (!settings) {
    clearResumeInflight('workflow', projectId, taskId)
    releaseVideoResumeLock('workflow', projectId, taskId)
    return
  }

  if (countInflightVideoGenerations(projectId, { singleShotOnly: true }) >= VIDEO_BATCH_CONCURRENCY) {
    clearResumeInflight('workflow', projectId, taskId)
    releaseVideoResumeLock('workflow', projectId, taskId)
    return
  }

  const execute = async () => {
    const controller = new AbortController()
    bindWorkflowVideoGenerationAbort(shot.id, controller)
    try {
      const videoPath = await resumeWorkflowVideoFromTask({
        projectId,
        task,
        shot,
        settings,
        appDataDir,
        abortSignal: controller.signal,
        onProgress: (update) => {
          void updateVideoGenerationTask(
            projectId,
            taskId,
            `镜号 ${shot.shotNumber}：${update.message}`,
            createdAt,
            task.episodeId
              ? {
                  id: task.episodeId,
                  episodeIndex: task.episodeIndex ?? 0,
                  title: task.episodeTitle ?? '',
                  script: '',
                  characters: [],
                  scenes: [],
                  items: [],
                }
              : null,
          )
        },
      })

      await patchWorkflowData(projectId, (current) => ({
        ...current,
        shots: current.shots.map((item) =>
          item.id === shot.id
            ? { ...item, ...appendShotGeneratedVideo(item, videoPath) }
            : item,
        ),
      }))

      await finishVideoGenerationTask(
        projectId,
        taskId,
        {
          status: 'completed',
          progressMessage: formatShotVideoGeneratedToast(shot),
        },
        createdAt,
        task.episodeId
          ? {
              id: task.episodeId,
              episodeIndex: task.episodeIndex ?? 0,
              title: task.episodeTitle ?? '',
              script: '',
              characters: [],
              scenes: [],
              items: [],
            }
          : null,
      )
    } catch (error: unknown) {
      if (isWorkflowVideoGenerationCancelled(shot.id) || isVideoGenerationAbortError(error)) {
        return
      }
      const err = error as Error
      await finishVideoGenerationTask(
        projectId,
        taskId,
        {
          status: 'failed',
          progressMessage: formatShotVideoFailedToast(shot, err.message || '视频恢复失败'),
          errorMessage: err.message || '视频恢复失败',
        },
        createdAt,
        task.episodeId
          ? {
              id: task.episodeId,
              episodeIndex: task.episodeIndex ?? 0,
              title: task.episodeTitle ?? '',
              script: '',
              characters: [],
              scenes: [],
              items: [],
            }
          : null,
      )
    } finally {
      unbindWorkflowVideoGenerationAbort(shot.id, controller)
      clearWorkflowVideoGenerationCancelled(shot.id)
      clearResumeInflight('workflow', projectId, taskId)
      releaseVideoResumeLock('workflow', projectId, taskId)
      void useTaskStore.getState().refresh()
    }
  }

  const promise = execute()
  registerInflightVideoGeneration(projectId, taskId, promise, {
    isBatch: false,
    generatingShotId: shot.id,
  })
  await promise
}

async function resumeCanvasVideoTask(projectId: string, nodeId: string): Promise<void> {
  if (hasCanvasInflightRun(projectId, nodeId) || isResumeInflight('canvas', projectId, nodeId)) {
    return
  }
  if (!tryAcquireVideoResumeLock('canvas', projectId, nodeId)) {
    return
  }

  markResumeInflight('canvas', projectId, nodeId)
  const promise = resumeCanvasVideoFromNode({ projectId, nodeId }).finally(() => {
    clearResumeInflight('canvas', projectId, nodeId)
    releaseVideoResumeLock('canvas', projectId, nodeId)
    void useTaskStore.getState().refresh()
  })
  registerCanvasInflightRun({ projectId, nodeId, promise })
  await promise
}

export async function scanAndResumePendingVideoJobs(): Promise<void> {
  try {
    const { listWorkflowProjects } = await import('@/lib/storage/workflow-service')
    const projects = await listWorkflowProjects()
    for (const project of projects) {
      const tasks = await readWorkflowTasks(project.id)
      const resumable = tasks.filter((task) => isWorkflowVideoTaskResumable(task))
      if (!resumable.length) continue

      const settingsRes = await readSettings()
      const maxConcurrency = VIDEO_BATCH_CONCURRENCY
      let data: Awaited<ReturnType<typeof readWorkflowData>> | null = null
      for (const task of resumable) {
        if (!task.shotId?.trim()) continue
        if (
          isResumeInflight('workflow', project.id, task.id) ||
          isInflightVideoTask(project.id, task.id)
        ) {
          continue
        }
        if (countInflightVideoGenerations(project.id, { singleShotOnly: true }) >= maxConcurrency) {
          continue
        }
        data = data ?? (await readWorkflowData(project.id))
        const shot = data.shots.find((item) => item.id === task.shotId)
        if (!shot) continue
        void resumeWorkflowVideoTask(project.id, task.id, shot, task.createdAt)
      }
    }

    const canvasEntries = await listResumableCanvasVideoEntries()
    for (const entry of canvasEntries) {
      void resumeCanvasVideoTask(entry.projectId, entry.nodeId)
    }
  } catch {
    /* 后台恢复失败不阻断应用 */
  }
}

let resumeTimer: number | null = null

export function startVideoBackgroundResumeLoop(): void {
  if (resumeTimer != null) return
  void scanAndResumePendingVideoJobs()
  resumeTimer = window.setInterval(() => {
    void scanAndResumePendingVideoJobs()
  }, RESUME_POLL_MS)
}

export function stopVideoBackgroundResumeLoop(): void {
  if (resumeTimer != null) {
    window.clearInterval(resumeTimer)
    resumeTimer = null
  }
}

export async function resumeCanvasVideoIfNeeded(projectId: string, nodeId: string): Promise<void> {
  await resumeCanvasVideoTask(projectId, nodeId)
}

export async function resumeWorkflowVideoIfNeeded(projectId: string, taskId: string): Promise<void> {
  const tasks = await readWorkflowTasks(projectId)
  const task = tasks.find((item) => item.id === taskId)
  if (!task || !isWorkflowVideoTaskResumable(task) || !task.shotId) return
  const data = await readWorkflowData(projectId)
  const shot = data.shots.find((item) => item.id === task.shotId)
  if (!shot) return
  await resumeWorkflowVideoTask(projectId, taskId, shot, task.createdAt)
}
