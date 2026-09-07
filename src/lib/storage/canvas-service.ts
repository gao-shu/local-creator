// Copyright (c) Haode AI. All rights reserved.

import type {
  CanvasCreateResult,
  CanvasDeleteResult,
  CanvasListResult,
  CanvasProjectData,
  CanvasProjectMeta,
  CanvasReadDataResult,
  CanvasUpdateProjectResult,
  CanvasWriteDataResult,
} from '@/types/canvas'
import type { WorkflowTask, WorkflowTasksResult, WorkflowWriteTasksResult } from '@/types/workflow'
import { createEmptyCanvasData } from '@/types/canvas'
import { mergeCanvasProjectDataForPersist, normalizeCanvasProjectDataFromDisk } from '@/lib/canvas/canvas-data-persist'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'

const devMetaStore = new Map<string, CanvasProjectMeta>()
const devDataStore = new Map<string, CanvasProjectData>()
const devTaskStore = new Map<string, WorkflowTask[]>()

/** 浏览器 dev（无 Electron canvasAPI）时 sessionStorage 镜像，便于 F5 / E1 验收 */
export const DEV_CANVAS_DATA_STORAGE_PREFIX = 'haode:dev:canvas:data:'

function readDevCanvasDataFromSession(projectId: string): CanvasProjectData | null {
  if (typeof window === 'undefined' || window.canvasAPI) return null
  try {
    const raw = sessionStorage.getItem(`${DEV_CANVAS_DATA_STORAGE_PREFIX}${projectId}`)
    if (!raw) return null
    return JSON.parse(raw) as CanvasProjectData
  } catch {
    return null
  }
}

function writeDevCanvasDataToSession(projectId: string, data: CanvasProjectData): void {
  if (typeof window === 'undefined' || window.canvasAPI) return
  try {
    sessionStorage.setItem(`${DEV_CANVAS_DATA_STORAGE_PREFIX}${projectId}`, JSON.stringify(data))
  } catch {
    /* ignore quota */
  }
}

export interface CanvasAPI {
  listProjects: () => Promise<CanvasListResult>
  createProject: (payload: {
    title?: string
    description?: string
  }) => Promise<CanvasCreateResult>
  deleteProject: (projectId: string) => Promise<CanvasDeleteResult>
  listDeletedProjects: () => Promise<CanvasListResult>
  restoreProject: (projectId: string) => Promise<CanvasUpdateProjectResult>
  purgeProject: (projectId: string) => Promise<CanvasDeleteResult>
  getProject: (projectId: string) => Promise<CanvasUpdateProjectResult>
  readData: (projectId: string) => Promise<CanvasReadDataResult>
  writeData: (projectId: string, data: CanvasProjectData) => Promise<CanvasWriteDataResult>
  backupData: (
    projectId: string,
    label?: string,
  ) => Promise<{ success: boolean; backupPath?: string; error?: string }>
  updateProject: (
    projectId: string,
    patch: Partial<CanvasProjectMeta>,
  ) => Promise<CanvasUpdateProjectResult>
  readTasks: (projectId: string) => Promise<WorkflowTasksResult>
  writeTasks: (projectId: string, tasks: WorkflowTask[]) => Promise<WorkflowWriteTasksResult>
}

function isMissingDataRootError(message?: string): boolean {
  return Boolean(message?.includes('数据根目录'))
}

export async function listCanvasProjects(): Promise<CanvasProjectMeta[]> {
  if (!window.canvasAPI) {
    return Array.from(devMetaStore.values())
      .filter((item) => !(typeof item.deletedAt === 'number' && item.deletedAt > 0))
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }
  const res = await window.canvasAPI.listProjects()
  if (!res.success) {
    if (isMissingDataRootError(res.error)) return []
    throw new Error(res.error || '加载画布项目失败')
  }
  return res.projects
}

export async function getCanvasProject(projectId: string): Promise<CanvasProjectMeta> {
  if (!window.canvasAPI) {
    const meta = devMetaStore.get(projectId)
    if (!meta) throw new Error('项目不存在')
    return meta
  }
  const res = await window.canvasAPI.getProject(projectId)
  if (!res.success || !res.project) throw new Error(res.error || '项目不存在')
  return res.project
}

export async function readCanvasData(projectId: string): Promise<CanvasProjectData> {
  if (!window.canvasAPI) {
    const fromSession = readDevCanvasDataFromSession(projectId)
    if (fromSession) {
      devDataStore.set(projectId, fromSession)
      return normalizeCanvasProjectDataFromDisk(fromSession)
    }
    return devDataStore.get(projectId) ?? createEmptyCanvasData()
  }
  const res = await window.canvasAPI.readData(projectId)
  if (!res.success || !res.data) throw new Error(res.error || '读取画布数据失败')
  return normalizeCanvasProjectDataFromDisk(res.data)
}

export async function writeCanvasData(projectId: string, data: CanvasProjectData): Promise<void> {
  const normalized = normalizeCanvasProjectDataFromDisk(data)
  if (!window.canvasAPI) {
    devDataStore.set(projectId, normalized)
    writeDevCanvasDataToSession(projectId, normalized)
    const meta = devMetaStore.get(projectId)
    if (meta) {
      devMetaStore.set(projectId, { ...meta, updatedAt: Date.now() })
    }
    return
  }
  const res = await window.canvasAPI.writeData(projectId, normalized)
  if (!res.success) throw new Error(res.error || '保存失败')
}

export async function backupCanvasDataBeforeExport(
  projectId: string,
  label?: string,
): Promise<string | undefined> {
  if (!window.canvasAPI?.backupData) return undefined
  const res = await window.canvasAPI.backupData(projectId, label)
  if (!res.success) throw new Error(res.error || '备份画布数据失败')
  return res.backupPath
}

/** 自动保存：合并磁盘运行态后再写入，避免覆盖后台任务进度 */
export async function persistCanvasDataMerged(
  projectId: string,
  memory: CanvasProjectData,
): Promise<void> {
  if (!window.canvasAPI) {
    await writeCanvasData(projectId, memory)
    return
  }
  await patchCanvasData(projectId, (disk) => mergeCanvasProjectDataForPersist(disk, memory))
}

const canvasDataWriteLocks = new Map<string, Promise<unknown>>()

export async function patchCanvasData(
  projectId: string,
  mutator: (current: CanvasProjectData) => CanvasProjectData | Promise<CanvasProjectData>,
): Promise<CanvasProjectData> {
  const prev = canvasDataWriteLocks.get(projectId) ?? Promise.resolve()
  const run = prev.then(async () => {
    const current = await readCanvasData(projectId)
    const next = await mutator(current)
    await writeCanvasData(projectId, next)
    return next
  })
  canvasDataWriteLocks.set(
    projectId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  )
  return run
}

export async function updateCanvasProject(
  projectId: string,
  patch: Partial<CanvasProjectMeta>,
): Promise<CanvasProjectMeta> {
  if (!window.canvasAPI) {
    const meta = devMetaStore.get(projectId)
    if (!meta) throw new Error('项目不存在')
    const next = { ...meta, ...patch, updatedAt: Date.now() }
    devMetaStore.set(projectId, next)
    return next
  }
  const res = await window.canvasAPI.updateProject(projectId, patch)
  if (!res.success || !res.project) throw new Error(res.error || '更新失败')
  return res.project
}

export async function createCanvasProject(payload: {
  title?: string
  description?: string
}): Promise<CanvasProjectMeta> {
  if (!window.canvasAPI) {
    const now = Date.now()
    const id = `cv_dev_${now}`
    const project: CanvasProjectMeta = {
      id,
      title: payload.title?.trim() || '预览画布',
      description: payload.description?.trim() || '',
      createdAt: now,
      updatedAt: now,
    }
    devMetaStore.set(id, project)
    devDataStore.set(id, createEmptyCanvasData())
    devTaskStore.set(id, [])
    return project
  }
  const res = await window.canvasAPI.createProject(payload)
  if (!res.success || !res.project) throw new Error(res.error || '创建失败')
  return res.project
}

export async function deleteCanvasProject(projectId: string): Promise<void> {
  if (!window.canvasAPI) {
    const meta = devMetaStore.get(projectId)
    if (meta) {
      devMetaStore.set(projectId, { ...meta, deletedAt: Date.now(), updatedAt: Date.now() })
    }
    return
  }
  const res = await window.canvasAPI.deleteProject(projectId)
  if (!res.success) throw new Error(res.error || '删除失败')
}

export async function listDeletedCanvasProjects(): Promise<CanvasProjectMeta[]> {
  if (!window.canvasAPI?.listDeletedProjects) {
    return Array.from(devMetaStore.values())
      .filter((item) => typeof item.deletedAt === 'number' && item.deletedAt > 0)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
  }
  const res = await window.canvasAPI.listDeletedProjects()
  if (!res.success) {
    if (isMissingDataRootError(res.error)) return []
    throw new Error(res.error || '加载回收站失败')
  }
  return res.projects
}

export async function restoreCanvasProject(projectId: string): Promise<CanvasProjectMeta> {
  if (!window.canvasAPI?.restoreProject) {
    const meta = devMetaStore.get(projectId)
    if (!meta) throw new Error('回收站中未找到该项目')
    const { deletedAt: _deletedAt, ...rest } = meta
    const next = { ...rest, updatedAt: Date.now() }
    devMetaStore.set(projectId, next)
    return next
  }
  const res = await window.canvasAPI.restoreProject(projectId)
  if (!res.success || !res.project) throw new Error(res.error || '恢复失败')
  return res.project
}

export async function purgeCanvasProject(projectId: string): Promise<void> {
  if (!window.canvasAPI?.purgeProject) {
    devMetaStore.delete(projectId)
    devDataStore.delete(projectId)
    devTaskStore.delete(projectId)
    return
  }
  const res = await window.canvasAPI.purgeProject(projectId)
  if (!res.success) throw new Error(res.error || '彻底删除失败')
}

export function seedDevCanvasPreview(projectId: string) {
  const now = Date.now()
  const meta: CanvasProjectMeta = {
    id: projectId,
    title: projectId === 'cv_dev_preview' ? '画布预览项目' : '预览项目 · 第 1 集',
    description: projectId === 'cv_dev_preview' ? '开发预览画布' : '',
    createdAt: now,
    updatedAt: now,
  }
  devMetaStore.set(projectId, meta)
  devTaskStore.set(projectId, [])
  const previewData =
    projectId === 'cv_dev_preview'
      ? {
          version: 1 as const,
          nodes: [
            {
              id: 'group_assets_preview',
              type: CANVAS_NODE_TYPES.group,
              position: { x: 80, y: 80 },
              style: { width: 348, height: 384 },
              data: { label: '本集资产 · 只读' },
              zIndex: 0,
            },
            {
              id: 'import_asset_preview_char',
              type: CANVAS_NODE_TYPES.imageNode,
              parentId: 'group_assets_preview',
              extent: 'parent',
              position: { x: 24, y: 60 },
              data: {
                label: '角色 · 小明',
                status: 'success',
                outputPath: 'assets/images/preview_char.png',
                outputOwnerKind: 'canvas',
                outputOwnerProjectId: projectId,
                imageName: '小明',
                entityName: '小明',
                assetRole: 'character',
                assetRoleConverted: true,
                importWorkflowAssetId: 'asset_preview_char',
                importWorkflowProjectId: 'wf_dev_preview',
              },
              zIndex: 1,
            },
            {
              id: 'import_video_preview_1',
              type: CANVAS_NODE_TYPES.storyVideo,
              position: { x: 80, y: 520 },
              data: {
                label: '镜1 视频',
                status: 'success',
                outputPath: 'assets/videos/preview_shot_1.mp4',
                outputOwnerKind: 'canvas',
                outputOwnerProjectId: projectId,
                importShotId: 'shot_preview_1',
                importShotNumber: 1,
                importWorkflowProjectId: 'wf_dev_preview',
                videoName: '镜1 视频',
              },
            },
          ],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 0.75 },
        }
      : createEmptyCanvasData()
  devDataStore.set(projectId, previewData)
  return { meta, data: previewData }
}

export function isCanvasApiAvailable() {
  return Boolean(window.canvasAPI)
}

export async function readCanvasTasks(projectId: string): Promise<WorkflowTask[]> {
  if (!window.canvasAPI) {
    return [...(devTaskStore.get(projectId) ?? [])]
  }
  const res = await window.canvasAPI.readTasks(projectId)
  if (!res.success) throw new Error(res.error || '读取画布任务失败')
  return res.tasks
}

export async function writeCanvasTasks(projectId: string, tasks: WorkflowTask[]): Promise<void> {
  if (!window.canvasAPI) {
    devTaskStore.set(projectId, tasks)
    return
  }
  const res = await window.canvasAPI.writeTasks(projectId, tasks)
  if (!res.success) throw new Error(res.error || '保存画布任务失败')
}

export async function upsertCanvasTask(projectId: string, task: WorkflowTask): Promise<void> {
  const tasks = await readCanvasTasks(projectId)
  const index = tasks.findIndex((item) => item.id === task.id)
  if (index >= 0) tasks[index] = task
  else tasks.unshift(task)
  await writeCanvasTasks(projectId, tasks)
}
