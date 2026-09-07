// Copyright (c) Haode AI. All rights reserved.

import { dismissCanvasVideoTask } from '@/lib/canvas/canvas-video-task-service'
import {
  cancelCanvasPromptAiTask,
  dismissCanvasPromptAiTask,
} from '@/lib/canvas/canvas-prompt-ai-task-service'
import { cancelImageGenerationTask } from '@/lib/workflow/image-task-service'
import {
  cancelWorkflowTask,
  isActiveTaskStatus,
  removeWorkflowTask,
  type UnifiedTaskEntry,
} from '@/lib/workflow/task-service'
import {
  stopWorkflowAssetImageGeneration,
  stopWorkflowImageGeneration,
  stopWorkflowVideoGeneration,
} from '@/lib/workflow/workflow-generation-stop'
import { cancelVideoGenerationTask } from '@/lib/workflow/video-task-service'
import { readWorkflowTasks } from '@/lib/storage/workflow-service'

export async function cancelUnifiedTask(entry: UnifiedTaskEntry): Promise<boolean> {
  if (entry.source === 'canvas') {
    if (entry.task.type === 'extract' || entry.task.type === 'storyboard') {
      return cancelCanvasPromptAiTask(entry.projectId, entry.task.id)
    }
    return dismissCanvasVideoTask(entry.projectId, entry.task.id)
  }

  const tasks = await readWorkflowTasks(entry.projectId)
  const task = tasks.find((item) => item.id === entry.task.id)
  if (!task || !isActiveTaskStatus(task.status)) return false

  if (task.type === 'video') {
    if (task.shotId) {
      await stopWorkflowVideoGeneration(entry.projectId, {
        taskId: entry.task.id,
        shotId: task.shotId,
      })
      return true
    }
    await cancelVideoGenerationTask(entry.projectId, entry.task.id)
    return true
  }
  if (task.type === 'image') {
    if (task.shotId) {
      await stopWorkflowImageGeneration(entry.projectId, {
        taskId: entry.task.id,
        shotId: task.shotId,
        silent: true,
      })
      return true
    }
    if (task.assetId) {
      await stopWorkflowAssetImageGeneration(entry.projectId, {
        taskId: entry.task.id,
        assetId: task.assetId,
        silent: true,
      })
      return true
    }
    await cancelImageGenerationTask(entry.projectId, entry.task.id)
    return true
  }
  await cancelWorkflowTask(entry.projectId, entry.task.id)
  return true
}

export async function deleteUnifiedTask(entry: UnifiedTaskEntry): Promise<boolean> {
  if (entry.source === 'canvas') {
    if (entry.task.type === 'extract' || entry.task.type === 'storyboard') {
      if (isActiveTaskStatus(entry.task.status)) {
        await cancelCanvasPromptAiTask(entry.projectId, entry.task.id)
      }
      return dismissCanvasPromptAiTask(entry.projectId, entry.task.id)
    }
    return dismissCanvasVideoTask(entry.projectId, entry.task.id)
  }

  if (isActiveTaskStatus(entry.task.status)) {
    await cancelUnifiedTask(entry)
  }
  return removeWorkflowTask(entry.projectId, entry.task.id)
}
