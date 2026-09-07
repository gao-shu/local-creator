import { toast } from 'sonner'
import { writeWorkflowData } from '@/lib/storage/workflow-service'
import { normalizeWorkflowStep } from '@/lib/workflow/step-utils'
import type { WorkflowProjectData, WorkflowStep } from '@/types/workflow'
import { useWorkflowSessionStore } from '@/stores/workflow-session-store'

/** 将指定快照写入磁盘（离开项目 cleanup 时用，避免 store 已被新会话覆盖） */
export async function persistProjectSnapshot(
  projectId: string,
  data: WorkflowProjectData,
  options?: { silent?: boolean },
): Promise<boolean> {
  try {
    await writeWorkflowData(projectId, data)
    return true
  } catch (error: unknown) {
    const err = error as Error
    if (!options?.silent) toast.error(err.message || '保存失败')
    return false
  }
}

/** 将当前工作流会话写入磁盘（切换步骤 / 离开项目前调用） */
export async function persistWorkflowSession(options?: {
  silent?: boolean
}): Promise<boolean> {
  const { projectId, data, save } = useWorkflowSessionStore.getState()
  if (!projectId || !data) return true
  return save(options ?? { silent: true })
}

/** 离开项目前写入当前步骤（同步 data.json 与项目索引） */
export async function flushWorkflowSessionStep(
  step: WorkflowStep,
  options?: { silent?: boolean },
): Promise<boolean> {
  const normalized = normalizeWorkflowStep(step)
  const { projectId, data, patchData, save } = useWorkflowSessionStore.getState()
  if (!projectId || !data) return true

  if (data.currentStep !== normalized) {
    patchData({ currentStep: normalized })
  }

  const latest = useWorkflowSessionStore.getState()
  if (latest.dirty || latest.meta?.currentStep !== normalized) {
    return save(options ?? { silent: true })
  }
  return true
}

/** 读取最近一次保存失败原因（供导航栏等 silent 保存场景展示） */
export function getLastWorkflowSaveError(): string | null {
  return useWorkflowSessionStore.getState().lastSaveError
}
