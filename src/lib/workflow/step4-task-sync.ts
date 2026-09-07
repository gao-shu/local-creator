import type { WorkflowEpisode, WorkflowTask } from '@/types/workflow'
import { isActiveTaskStatus } from '@/lib/workflow/task-service'
import {
  getActiveStoryboardTask,
  isStoryboardInferenceInflight,
} from '@/lib/workflow/storyboard-task-service'

export interface Step4TaskFlags {
  storyboardWasActive: boolean
}

export interface Step4TaskUiState {
  inferring: boolean
  taskMessage: string
  storyboardWasActive: boolean
  storyboardJustFinished: boolean
}

/** 根据 tasks.json + 内存中的推理 Promise 推导分镜页状态 */
export function resolveStep4TaskUiState(
  tasks: WorkflowTask[],
  prev: Step4TaskFlags,
  projectId?: string,
  episodeId?: string,
): Step4TaskUiState {
  const activeStoryboard = getActiveStoryboardTask(tasks, projectId)
  const inferring =
    Boolean(activeStoryboard) ||
    Boolean(projectId && episodeId && isStoryboardInferenceInflight(projectId, episodeId))

  let taskMessage = ''
  if (inferring) {
    taskMessage = activeStoryboard?.progressMessage || '分镜推理进行中…'
  }

  return {
    inferring,
    taskMessage,
    storyboardWasActive: inferring,
    storyboardJustFinished: prev.storyboardWasActive && !inferring,
  }
}

const LOCAL_STORYBOARD_TASK_ID = '__local_storyboard__'
export const LOCAL_VIDEO_TASK_ID = '__local_video__'

export function isLocalPlaceholderTaskId(taskId: string) {
  return taskId === LOCAL_STORYBOARD_TASK_ID || taskId === LOCAL_VIDEO_TASK_ID
}

/** 推理/生视频进行中但 tasks.json 尚未同步时，补一条本地占位任务 */
export function buildProjectTaskList(
  tasks: WorkflowTask[],
  options?: {
    inferring?: boolean
    videoGenerating?: boolean
    videoProgressMessage?: string
    episode?: WorkflowEpisode | null
  },
): WorkflowTask[] {
  let list = tasks

  if (options?.inferring) {
    const hasActiveStoryboard = list.some(
      (t) => t.type === 'storyboard' && isActiveTaskStatus(t.status),
    )
    if (!hasActiveStoryboard) {
      const episode = options.episode
      const now = Date.now()
      const progressMessage = episode?.title?.trim()
        ? `正在推理「${episode.title.trim()}」分镜…`
        : '分镜推理进行中…'

      list = [
        {
          id: LOCAL_STORYBOARD_TASK_ID,
          type: 'storyboard',
          status: 'running',
          progressMessage,
          episodeId: episode?.id,
          episodeIndex: episode?.episodeIndex,
          episodeTitle: episode?.title,
          createdAt: now,
          updatedAt: now,
        },
        ...list,
      ]
    }
  }

  if (options?.videoGenerating) {
    const hasActiveVideo = list.some(
      (t) => t.type === 'video' && isActiveTaskStatus(t.status),
    )
    if (!hasActiveVideo) {
      const episode = options.episode
      const now = Date.now()
      list = [
        {
          id: LOCAL_VIDEO_TASK_ID,
          type: 'video',
          status: 'running',
          progressMessage: options.videoProgressMessage ?? '正在生视频…',
          episodeId: episode?.id,
          episodeIndex: episode?.episodeIndex,
          episodeTitle: episode?.title,
          createdAt: now,
          updatedAt: now,
        },
        ...list,
      ]
    }
  }

  return list
}
