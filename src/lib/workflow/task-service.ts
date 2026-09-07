import type { WorkflowTask, WorkflowTaskStatus, WorkflowTaskType } from '@/types/workflow'
import {
  listCanvasVideoTaskEntries,
  toUnifiedCanvasTaskEntry,
} from '@/lib/canvas/canvas-video-task-service'
import {
  listCanvasPromptAiTaskEntries,
  toUnifiedCanvasPromptAiTaskEntry,
} from '@/lib/canvas/canvas-prompt-ai-task-service'
import {
  listWorkflowProjects,
  readWorkflowTasks,
  writeWorkflowTasks,
} from '@/lib/storage/workflow-service'
import { useTaskStore } from '@/stores/task-store'

export const TASK_TYPE_LABEL: Record<WorkflowTaskType, string> = {
  episode_split: 'AI 分集并提取资产',
  extract: 'AI 提取资产',
  storyboard: '推理分镜',
  image: '生图',
  video: '生视频',
}

export const TASK_STATUS_LABEL: Record<WorkflowTaskStatus, string> = {
  pending: '等待中',
  running: '进行中',
  completed: '已完成',
  failed: '失败',
}

export interface WorkflowTaskEntry {
  projectId: string
  projectTitle: string
  task: WorkflowTask
}

export type UnifiedTaskSource = 'workflow' | 'canvas'

export interface UnifiedTaskEntry {
  source: UnifiedTaskSource
  projectId: string
  projectTitle: string
  task: {
    id: string
    type: WorkflowTaskType | 'video'
    status: WorkflowTaskStatus
    progressMessage?: string
    errorMessage?: string
    label?: string
    shotId?: string
    assetId?: string
    createdAt: number
    updatedAt: number
  }
}

export function toUnifiedWorkflowTaskEntry(entry: WorkflowTaskEntry): UnifiedTaskEntry {
  return {
    source: 'workflow',
    projectId: entry.projectId,
    projectTitle: entry.projectTitle,
    task: {
      id: entry.task.id,
      type: entry.task.type,
      status: entry.task.status,
      progressMessage: entry.task.progressMessage,
      errorMessage: entry.task.errorMessage,
      shotId: entry.task.shotId,
      assetId: entry.task.assetId,
      createdAt: entry.task.createdAt,
      updatedAt: entry.task.updatedAt ?? entry.task.createdAt,
    },
  }
}

export async function upsertWorkflowTask(projectId: string, task: WorkflowTask) {
  const tasks = await readWorkflowTasks(projectId)
  const index = tasks.findIndex((t) => t.id === task.id)
  if (index >= 0) tasks[index] = task
  else tasks.unshift(task)
  await writeWorkflowTasks(projectId, tasks)
}

/** 将进行中的任务标记为失败（用户手动终止或僵尸任务清理） */
export async function cancelWorkflowTask(
  projectId: string,
  taskId: string,
  options?: { errorMessage?: string; progressMessage?: string },
): Promise<WorkflowTask | null> {
  const tasks = await readWorkflowTasks(projectId)
  const task = tasks.find((t) => t.id === taskId)
  if (!task || !isActiveTaskStatus(task.status)) return null
  const now = Date.now()
  const updated: WorkflowTask = {
    ...task,
    status: 'failed',
    errorMessage: options?.errorMessage ?? '任务已手动终止',
    progressMessage: options?.progressMessage ?? '已终止',
    updatedAt: now,
    ...(task.type === 'video' ? { remoteJob: undefined } : {}),
  }
  await upsertWorkflowTask(projectId, updated)
  return updated
}

/** 从任务历史中移除一条记录（不自动终止进行中的任务） */
export async function removeWorkflowTask(projectId: string, taskId: string): Promise<boolean> {
  const tasks = await readWorkflowTasks(projectId)
  const next = tasks.filter((task) => task.id !== taskId)
  if (next.length === tasks.length) return false
  await writeWorkflowTasks(projectId, next)
  void useTaskStore.getState().refresh()
  return true
}

export async function listAllWorkflowTasks(): Promise<WorkflowTaskEntry[]> {
  const projects = await listWorkflowProjects()
  const groups = await Promise.all(
    projects.map(async (project) => {
      const tasks = await readWorkflowTasks(project.id)
      return tasks.map((task) => ({
        projectId: project.id,
        projectTitle: project.title,
        task,
      }))
    }),
  )
  return groups
    .flat()
    .sort((a, b) => (b.task.updatedAt ?? b.task.createdAt) - (a.task.updatedAt ?? a.task.createdAt))
}

export async function listAllUnifiedTasks(): Promise<UnifiedTaskEntry[]> {
  const [workflowEntries, canvasVideoEntries, canvasPromptAiEntries] = await Promise.all([
    listAllWorkflowTasks(),
    listCanvasVideoTaskEntries(),
    listCanvasPromptAiTaskEntries(),
  ])
  return [
    ...workflowEntries.map(toUnifiedWorkflowTaskEntry),
    ...canvasVideoEntries.map(toUnifiedCanvasTaskEntry),
    ...canvasPromptAiEntries.map(toUnifiedCanvasPromptAiTaskEntry),
  ].sort((a, b) => b.task.updatedAt - a.task.updatedAt)
}

export function isActiveTaskStatus(status: WorkflowTaskStatus) {
  return status === 'pending' || status === 'running'
}

export function countActiveTasks(entries: WorkflowTaskEntry[]) {
  return entries.filter((entry) => isActiveTaskStatus(entry.task.status)).length
}

export function formatTaskTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatTaskEpisodeLabel(task: WorkflowTask): string | null {
  const title = task.episodeTitle?.trim()
  if (title) return title
  if (task.episodeIndex) return `第 ${task.episodeIndex} 集`
  return null
}
