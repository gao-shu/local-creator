// Copyright (c) Haode AI. All rights reserved.

import { listAllCanvasInflightRuns } from '@/lib/canvas/canvas-inflight-run-service'
import {
  isActiveTaskStatus,
  listAllUnifiedTasks,
  TASK_TYPE_LABEL,
  type UnifiedTaskEntry,
} from '@/lib/workflow/task-service'
import { listAllInflightVideoGenerations } from '@/lib/workflow/video-task-service'
import type { WorkflowTaskType } from '@/types/workflow'

export interface ActiveGenerationWarning {
  id: string
  source: UnifiedTaskEntry['source'] | 'memory'
  projectTitle: string
  title: string
  detail?: string
}

function resolveUnifiedTaskTitle(entry: UnifiedTaskEntry): string {
  if (entry.source === 'canvas') {
    return entry.task.label?.trim() ? `生视频 · ${entry.task.label}` : '画布生视频'
  }
  const type = entry.task.type as WorkflowTaskType
  return TASK_TYPE_LABEL[type] ?? entry.task.type
}

function toWarning(entry: UnifiedTaskEntry): ActiveGenerationWarning {
  const title = resolveUnifiedTaskTitle(entry)
  const detail =
    entry.task.progressMessage?.trim() ||
    (entry.source === 'canvas' ? '画布' : '工坊')
  return {
    id: `${entry.source}:${entry.projectId}:${entry.task.id}`,
    source: entry.source,
    projectTitle: entry.projectTitle,
    title,
    detail,
  }
}

/** 关闭应用前汇总仍在进行中的生成类任务 */
export async function listActiveGenerationWarnings(): Promise<ActiveGenerationWarning[]> {
  const entries = await listAllUnifiedTasks()
  const warnings: ActiveGenerationWarning[] = entries
    .filter((entry) => isActiveTaskStatus(entry.task.status))
    .map(toWarning)

  for (const { projectId } of listAllInflightVideoGenerations()) {
    const matched = warnings.some(
      (item) => item.source !== 'canvas' && item.id.includes(projectId) && item.title.includes('生视频'),
    )
    if (matched) continue
    const entry = entries.find(
      (item) => item.projectId === projectId && item.task.type === 'video' && isActiveTaskStatus(item.task.status),
    )
    if (entry) continue
    warnings.push({
      id: `memory:video:${projectId}`,
      source: 'memory',
      projectTitle: entries.find((item) => item.projectId === projectId)?.projectTitle ?? '未知项目',
      title: '生视频',
      detail: '视频生成进行中',
    })
  }

  for (const run of listAllCanvasInflightRuns()) {
    const matched = warnings.some(
      (item) => item.source === 'canvas' && item.id.includes(run.projectId),
    )
    if (matched) continue
    warnings.push({
      id: `memory:canvas:${run.projectId}:${run.nodeId}`,
      source: 'canvas',
      projectTitle:
        entries.find((item) => item.projectId === run.projectId)?.projectTitle ?? '画布项目',
      title: '画布节点生成中',
      detail: '图片或视频生成进行中',
    })
  }

  return warnings
}
