import { create } from 'zustand'
import { toast } from 'sonner'
import { normalizeWorkflowStep, resolveResumeStep } from '@/lib/workflow/step-utils'
import type { WorkflowProjectData, WorkflowProjectMeta } from '@/types/workflow'
import {
  getWorkflowProject,
  isWorkflowApiAvailable,
  readWorkflowData,
  seedDevPreviewData,
  updateWorkflowProject,
  writeWorkflowData,
} from '@/lib/storage/workflow-service'

interface WorkflowSessionStore {
  projectId: string | null
  meta: WorkflowProjectMeta | null
  data: WorkflowProjectData | null
  loading: boolean
  saving: boolean
  dirty: boolean
  lastSaveError: string | null
  load: (projectId: string) => Promise<boolean>
  reload: () => Promise<boolean>
  reset: () => void
  patchData: (patch: Partial<WorkflowProjectData>) => void
  save: (options?: { silent?: boolean }) => Promise<boolean>
  renameTitle: (title: string) => Promise<boolean>
}

/** 串行化 save，避免并行写入互相覆盖或 saving 状态错乱 */
let saveChain: Promise<boolean> = Promise.resolve(true)
/** 忽略过期的 load 结果，避免 Strict Mode / 快速切换项目时后到的响应覆盖新会话 */
let loadGeneration = 0

export const useWorkflowSessionStore = create<WorkflowSessionStore>((set, get) => ({
  projectId: null,
  meta: null,
  data: null,
  loading: false,
  saving: false,
  dirty: false,
  lastSaveError: null,

  load: async (projectId) => {
    const generation = ++loadGeneration
    set({ loading: true, projectId })
    try {
      if (!isWorkflowApiAvailable()) {
        const preview = seedDevPreviewData(projectId)
        if (generation !== loadGeneration) return false
        set({
          meta: preview.meta,
          data: preview.data,
          dirty: false,
        })
        return true
      }

      const [meta, data] = await Promise.all([
        getWorkflowProject(projectId),
        readWorkflowData(projectId),
      ])

      if (generation !== loadGeneration) return false

      const resumeStep = resolveResumeStep(meta, data)
      const metaStep = normalizeWorkflowStep(meta.currentStep)
      const dataStep = normalizeWorkflowStep(data.currentStep)
      const needsStepSync = metaStep !== resumeStep || dataStep !== resumeStep

      let nextMeta = meta
      let nextData = data
      if (needsStepSync) {
        nextMeta = { ...meta, currentStep: resumeStep }
        nextData = { ...data, currentStep: resumeStep }
      }

      set({ meta: nextMeta, data: nextData, dirty: false })

      if (needsStepSync) {
        try {
          await writeWorkflowData(projectId, nextData)
          if (generation !== loadGeneration) return false
          set({ meta: { ...nextMeta, updatedAt: Date.now() } })
        } catch {
          /* 推断步骤已写入内存，持久化失败不阻断进入项目 */
        }
      }

      return true
    } catch (error: unknown) {
      if (generation !== loadGeneration) return false
      const err = error as Error
      toast.error(err.message || '加载项目失败')
      set({ meta: null, data: null })
      return false
    } finally {
      if (generation === loadGeneration) {
        set({ loading: false })
      }
    }
  },

  reload: async () => {
    const { projectId } = get()
    if (!projectId) return false
    try {
      const data = await readWorkflowData(projectId)
      set({ data, dirty: false })
      return true
    } catch (error: unknown) {
      const err = error as Error
      toast.error(err.message || '刷新失败')
      return false
    }
  },

  reset: () => {
    loadGeneration += 1
    saveChain = Promise.resolve(true)
    set({
      projectId: null,
      meta: null,
      data: null,
      loading: false,
      saving: false,
      dirty: false,
      lastSaveError: null,
    })
  },

  patchData: (patch) => {
    const { data } = get()
    if (!data) return
    set({ data: { ...data, ...patch }, dirty: true })
  },

  save: (options) => {
    const run = async (): Promise<boolean> => {
      const { projectId, data, meta } = get()
      if (!projectId || !data) {
        if (!options?.silent) toast.error('项目数据未就绪，无法保存')
        return false
      }

      set({ saving: true, lastSaveError: null })
      try {
        await writeWorkflowData(projectId, data)
        if (isWorkflowApiAvailable()) {
          if (meta && meta.currentStep !== data.currentStep) {
            const updated = await updateWorkflowProject(projectId, {
              currentStep: data.currentStep,
            })
            set({ meta: updated })
          } else if (meta) {
            set({ meta: { ...meta, updatedAt: Date.now() } })
          }
        } else if (meta) {
          set({ meta: { ...meta, updatedAt: Date.now() } })
        }
        set({ dirty: false, lastSaveError: null })
        if (!options?.silent) toast.success('保存成功')
        return true
      } catch (error: unknown) {
        const err = error as Error
        const message = err.message || '保存失败'
        set({ lastSaveError: message })
        if (!options?.silent) toast.error(message)
        return false
      } finally {
        set({ saving: false })
      }
    }

    const task = saveChain.then(run, run)
    saveChain = task.catch(() => false)
    return task
  },

  renameTitle: async (title) => {
    const trimmed = title.trim()
    const { projectId, meta } = get()
    if (!projectId || !meta || !trimmed || trimmed === meta.title) {
      if (meta && trimmed) set({ meta: { ...meta, title: trimmed } })
      return true
    }

    try {
      if (isWorkflowApiAvailable()) {
        const updated = await updateWorkflowProject(projectId, { title: trimmed })
        set({ meta: updated })
      } else if (meta) {
        set({ meta: { ...meta, title: trimmed } })
      }
      return true
    } catch (error: unknown) {
      const err = error as Error
      toast.error(err.message || '重命名失败')
      return false
    }
  },
}))
