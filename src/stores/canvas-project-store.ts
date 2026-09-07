// Copyright (c) local-creator contributors. All rights reserved.

import { create } from 'zustand'
import { toast } from 'sonner'
import type { CanvasProjectMeta } from '@/types/canvas'
import {
  createCanvasProject,
  deleteCanvasProject,
  listCanvasProjects,
  updateCanvasProject,
} from '@/lib/storage/canvas-service'
import { hasConfiguredDataRoot, readSettings } from '@/lib/storage/settings-service'

export const CANVAS_PAGE_SIZE_OPTIONS = [8, 12, 16, 24] as const
export const DEFAULT_CANVAS_PAGE_SIZE = 12

interface CanvasProjectStore {
  projects: CanvasProjectMeta[]
  loading: boolean
  missingDataRoot: boolean
  page: number
  pageSize: number
  search: string
  /** 当前打开的画布编辑器项目（供侧栏展示标题） */
  activeEditorMeta: CanvasProjectMeta | null
  setActiveEditorMeta: (meta: CanvasProjectMeta | null) => void
  load: () => Promise<void>
  setSearch: (value: string) => void
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  create: (
    title: string,
    description?: string,
  ) => Promise<CanvasProjectMeta | null>
  update: (
    id: string,
    patch: Partial<Pick<CanvasProjectMeta, 'title' | 'description' | 'coverImagePath' | 'coverManual'>>,
  ) => Promise<CanvasProjectMeta | null>
  remove: (id: string) => Promise<void>
  filteredProjects: () => CanvasProjectMeta[]
  pageProjects: () => CanvasProjectMeta[]
  totalPages: () => number
}

export const useCanvasProjectStore = create<CanvasProjectStore>((set, get) => ({
  projects: [],
  loading: false,
  missingDataRoot: false,
  page: 1,
  pageSize: DEFAULT_CANVAS_PAGE_SIZE,
  search: '',

  activeEditorMeta: null,

  setActiveEditorMeta: (meta) => set({ activeEditorMeta: meta }),

  load: async () => {
    set({ loading: true })
    try {
      const settingsRes = await readSettings()
      if (!hasConfiguredDataRoot(settingsRes)) {
        set({ projects: [], page: 1, missingDataRoot: true })
        return
      }
      set({ missingDataRoot: false })
      const projects = await listCanvasProjects()
      set({ projects, page: 1 })
    } catch (error: unknown) {
      const err = error as Error
      toast.error(err.message || '加载画布项目失败')
    } finally {
      set({ loading: false })
    }
  },

  setSearch: (value) => set({ search: value, page: 1 }),

  setPage: (page) => set({ page }),

  setPageSize: (size) => {
    const next = CANVAS_PAGE_SIZE_OPTIONS.includes(size as (typeof CANVAS_PAGE_SIZE_OPTIONS)[number])
      ? size
      : DEFAULT_CANVAS_PAGE_SIZE
    set({ pageSize: next, page: 1 })
  },

  create: async (title, description) => {
    try {
      const project = await createCanvasProject({
        title,
        description,
      })
      await get().load()
      return project
    } catch (error: unknown) {
      const err = error as Error
      toast.error(err.message || '创建失败')
      return null
    }
  },

  update: async (id, patch) => {
    try {
      const project = await updateCanvasProject(id, patch)
      set((state) => ({
        projects: state.projects.map((item) => (item.id === id ? project : item)),
      }))
      toast.success('项目已更新')
      return project
    } catch (error: unknown) {
      const err = error as Error
      toast.error(err.message || '更新失败')
      return null
    }
  },

  remove: async (id) => {
    try {
      await deleteCanvasProject(id)
      await get().load()
      toast.success('项目已移入回收站')
    } catch (error: unknown) {
      const err = error as Error
      toast.error(err.message || '删除失败')
    }
  },

  filteredProjects: () => {
    const { projects, search } = get()
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q),
    )
  },

  pageProjects: () => {
    const filtered = get().filteredProjects()
    const { page, pageSize } = get()
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  },

  totalPages: () => {
    const total = get().filteredProjects().length
    const { pageSize } = get()
    return Math.max(1, Math.ceil(total / pageSize))
  },
}))
