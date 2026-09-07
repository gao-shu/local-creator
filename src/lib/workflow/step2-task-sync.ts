import type { WorkflowTask } from '@/types/workflow'
import { getActiveEpisodeSplitTask } from '@/lib/workflow/episode-split-service'
import { getActiveExtractTask } from '@/lib/workflow/extract-task-service'

export interface Step2TaskFlags {
  extractWasActive: boolean
  splitWasActive: boolean
}

export interface Step2TaskUiState {
  extracting: boolean
  splitting: boolean
  taskMessage: string
  extractWasActive: boolean
  splitWasActive: boolean
  extractJustFinished: boolean
  splitJustFinished: boolean
}

/** 根据 tasks.json + session 推导分集页按钮状态（无 session 的 running 视为无效） */
export function resolveStep2TaskUiState(
  tasks: WorkflowTask[],
  prev: Step2TaskFlags,
  projectId?: string,
): Step2TaskUiState {
  const activeExtract = getActiveExtractTask(tasks, projectId)
  const activeSplit = getActiveEpisodeSplitTask(tasks, projectId)

  const extracting = Boolean(activeExtract)
  const splitting = Boolean(activeSplit)

  let taskMessage = ''
  if (extracting && splitting) {
    taskMessage = '提取资产与智能分集并行进行中…'
  } else if (extracting) {
    taskMessage = activeExtract?.progressMessage || '正在从全文剧本提取资产…'
  } else if (splitting) {
    taskMessage = activeSplit?.progressMessage || '分集进行中…'
  }

  return {
    extracting,
    splitting,
    taskMessage,
    extractWasActive: extracting,
    splitWasActive: splitting,
    extractJustFinished: prev.extractWasActive && !extracting,
    splitJustFinished: prev.splitWasActive && !splitting,
  }
}
