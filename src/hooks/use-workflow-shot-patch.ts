/**
 * Step4 等分镜页：统一 shots 局部更新与静默落盘，避免页面内重复 patch/save 逻辑
 */
import { useCallback } from 'react'
import { findWorkflowShot, updateShotList } from '@/lib/workflow/shot-utils'
import { useWorkflowSessionStore } from '@/stores/workflow-session-store'
import type { WorkflowShot } from '@/types/workflow'

export function useWorkflowShotPatch() {
  const patchData = useWorkflowSessionStore((s) => s.patchData)
  const save = useWorkflowSessionStore((s) => s.save)

  const patchShots = useCallback(
    (nextShots: WorkflowShot[]) => {
      patchData({ shots: nextShots })
    },
    [patchData],
  )

  /** 始终基于 store 最新 shots 增量更新，避免并发生图互相覆盖 */
  const patchShotById = useCallback(
    (shotId: string, patch: Partial<WorkflowShot>) => {
      const current = useWorkflowSessionStore.getState().data?.shots ?? []
      patchShots(updateShotList(current, shotId, patch))
    },
    [patchShots],
  )

  const getShotById = useCallback((shotId: string): WorkflowShot | undefined => {
    const current = useWorkflowSessionStore.getState().data?.shots ?? []
    return findWorkflowShot(current, shotId)
  }, [])

  const persistSilent = useCallback(async () => {
    await save({ silent: true })
  }, [save])

  return { patchData, save, patchShots, patchShotById, getShotById, persistSilent }
}
