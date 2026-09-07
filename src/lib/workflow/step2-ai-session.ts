// Copyright (c) local-creator contributors. All rights reserved.

import type { WorkflowProjectData } from '@/types/workflow'
import { readWorkflowData } from '@/lib/storage/workflow-service'
import { useWorkflowSessionStore } from '@/stores/workflow-session-store'

/** Step2 AI 任务（分集 / 提取）启动前：将会话脏数据落盘，避免 patchWorkflowData 读到旧磁盘 */
export async function flushWorkflowSessionBeforeAiTask(): Promise<void> {
  const store = useWorkflowSessionStore.getState()
  if (!store.projectId || !store.data) {
    throw new Error('项目未加载')
  }
  if (!store.dirty) return

  const ok = await store.save({ silent: true })
  if (!ok) {
    const message = store.lastSaveError || '保存失败，无法开始 AI 任务'
    throw new Error(message)
  }
}

const EXTRACT_RESULT_FIELDS = [
  'episodes',
  'characters',
  'scenes',
  'props',
  'extractTemplateKey',
] as const satisfies readonly (keyof WorkflowProjectData)[]

/** 提取完成后：从磁盘合并资产/分集字段，避免 reload 覆盖内存中未落盘编辑 */
export async function mergeExtractResultFromDisk(projectId: string): Promise<boolean> {
  const store = useWorkflowSessionStore.getState()
  if (!store.data || store.projectId !== projectId) return false

  const disk = await readWorkflowData(projectId)
  const patch: Partial<WorkflowProjectData> = {}
  for (const key of EXTRACT_RESULT_FIELDS) {
    patch[key] = disk[key]
  }

  useWorkflowSessionStore.setState({
    data: { ...store.data, ...patch },
    dirty: false,
  })
  return true
}

/** AI 分集完成后：整包替换 workflow data（分集会重写 episodes 与资产） */
export async function reloadWorkflowSessionAfterSplit(projectId: string): Promise<boolean> {
  const store = useWorkflowSessionStore.getState()
  if (store.projectId !== projectId) return false
  return store.reload()
}

/** Step2 有未保存修改时启动 AI 任务前的确认文案 */
export const STEP2_DIRTY_AI_SAVE_CONFIRM = {
  title: '先保存再开始',
  description: '当前分集有未保存的修改。继续后将先保存项目，再开始 AI 任务。',
  confirmLabel: '保存并继续',
  cancelLabel: '取消',
} as const

/** 从 Step1 全文手动同步到第 1 集前的确认文案（description 由调用方拼接 diff） */
export const STEP2_SYNC_STEP1_SCRIPT_CONFIRM = {
  title: '同步 Step1 全文到第 1 集？',
  confirmLabel: '同步覆盖',
  cancelLabel: '取消',
} as const
