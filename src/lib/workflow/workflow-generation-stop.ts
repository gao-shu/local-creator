// Copyright (c) Haode AI. All rights reserved.

import { readWorkflowTasks } from '@/lib/storage/workflow-service'
import { cancelImageGenerationTask } from '@/lib/workflow/image-task-service'
import { isActiveTaskStatus } from '@/lib/workflow/task-service'
import { stopWorkflowVideoGeneration } from '@/lib/workflow/video-task-service'

export type WorkflowImageStopHandler = (
  shotId: string,
  options?: { taskId?: string | null; silent?: boolean },
) => void | Promise<void>

export type WorkflowAssetImageStopHandler = (
  assetId: string,
  options?: { taskId?: string | null; silent?: boolean },
) => void | Promise<void>

let workflowImageStopHandler: WorkflowImageStopHandler | null = null

/** Step4 挂载时注册，用于全局面板 / 任务 Tab 终止时同步 abort 与 UI */
export function registerWorkflowImageStopHandler(handler: WorkflowImageStopHandler | null): void {
  workflowImageStopHandler = handler
}

/** 工坊单镜生图统一终止：优先走 Step4 注册的 abort，否则仅更新任务记录 */
export async function stopWorkflowImageGeneration(
  projectId: string,
  options?: { shotId?: string | null; taskId?: string | null; silent?: boolean },
): Promise<boolean> {
  const shotIdHint = options?.shotId ?? null
  const silent = options?.silent ?? false

  if (shotIdHint && workflowImageStopHandler) {
    await workflowImageStopHandler(shotIdHint, {
      taskId: options?.taskId ?? null,
      silent,
    })
    return true
  }

  let taskId = options?.taskId ?? null
  if (!taskId && shotIdHint) {
    const tasks = await readWorkflowTasks(projectId)
    const matched = tasks.find(
      (item) =>
        item.type === 'image' &&
        item.shotId === shotIdHint &&
        isActiveTaskStatus(item.status),
    )
    taskId = matched?.id ?? null
  }

  if (!taskId) return false

  await cancelImageGenerationTask(projectId, taskId, {
    progressMessage: '已终止',
    errorMessage: '生图已取消',
  })
  return true
}

let workflowAssetImageStopHandler: WorkflowAssetImageStopHandler | null = null

/** Step3 挂载时注册，用于任务面板终止资产生图 */
export function registerWorkflowAssetImageStopHandler(
  handler: WorkflowAssetImageStopHandler | null,
): void {
  workflowAssetImageStopHandler = handler
}

export async function stopWorkflowAssetImageGeneration(
  projectId: string,
  options?: { assetId?: string | null; taskId?: string | null; silent?: boolean },
): Promise<boolean> {
  const assetIdHint = options?.assetId ?? null
  const silent = options?.silent ?? false

  if (assetIdHint && workflowAssetImageStopHandler) {
    await workflowAssetImageStopHandler(assetIdHint, {
      taskId: options?.taskId ?? null,
      silent,
    })
    return true
  }

  let taskId = options?.taskId ?? null
  if (!taskId && assetIdHint) {
    const tasks = await readWorkflowTasks(projectId)
    const matched = tasks.find(
      (item) =>
        item.type === 'image' &&
        item.assetId === assetIdHint &&
        isActiveTaskStatus(item.status),
    )
    taskId = matched?.id ?? null
  }

  if (!taskId) return false

  await cancelImageGenerationTask(projectId, taskId, {
    progressMessage: '已终止',
    errorMessage: '生图已取消',
  })
  return true
}

export { stopWorkflowVideoGeneration }
