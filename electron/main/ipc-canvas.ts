// Copyright (c) local-creator contributors. All rights reserved.

import path from 'node:path'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import type { CanvasProjectData, CanvasProjectMeta } from '../../src/types/canvas'
import { createEmptyCanvasData } from '../../src/types/canvas'
import { normalizeCanvasProjectDataFromDisk, mergeCanvasProjectDataForPersist } from '../../src/lib/canvas/canvas-data-persist'
import {
  isCanvasProjectDirName,
  resolveCanvasStorageDir,
  resolveSafeCanvasProjectDir,
} from '../../src/lib/storage/storage-path-utils'
import { readSettingsMerged } from './ipc-settings'
import { readModifyWriteJsonAtomic, writeJsonAtomic } from './atomic-write'
import {
  filterActiveProjects,
  filterSoftDeletedProjects,
  isProjectSoftDeleted,
  sortRecycleBinProjectsByDeletedAtDesc,
  stripProjectDeletedAt,
} from '../../src/lib/storage/project-soft-delete'

export async function resolveCanvasRoot(): Promise<string> {
  const { data, ctx } = await readSettingsMerged()
  const root = data.dataRootPath || ctx.dataRoot
  if (!root) {
    throw new Error('请先在系统设置中选择数据根目录')
  }
  return resolveCanvasStorageDir(data, root)
}

function projectsIndexPath(root: string) {
  return path.join(root, 'projects.json')
}

function projectDir(root: string, projectId: string) {
  return path.join(root, projectId)
}

function assertCanvasProjectId(projectId: string): string {
  const id = String(projectId || '').trim()
  if (!isCanvasProjectDirName(id)) {
    throw new Error('无效的画布项目 ID')
  }
  return id
}

async function backupCanvasDataFile(dir: string, label: string): Promise<string | null> {
  const src = path.join(dir, 'data.json')
  try {
    await fs.access(src)
  } catch {
    return null
  }
  const backupDir = path.join(dir, 'backup')
  await fs.mkdir(backupDir, { recursive: true })
  const safeLabel = label.replace(/[^\w\u4e00-\u9fa5.-]+/g, '_').slice(0, 80) || String(Date.now())
  const dest = path.join(backupDir, `data-before-export-${safeLabel}.json`)
  await fs.copyFile(src, dest)
  return dest
}

function dataFilePath(root: string, projectId: string) {
  const dir = resolveSafeCanvasProjectDir(root, assertCanvasProjectId(projectId))
  return path.join(dir, 'data.json')
}

function tasksFilePath(root: string, projectId: string) {
  const dir = resolveSafeCanvasProjectDir(root, assertCanvasProjectId(projectId))
  return path.join(dir, 'tasks.json')
}

async function readProjectTasks(root: string, projectId: string) {
  try {
    const raw = await fs.readFile(tasksFilePath(root, projectId), 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return []
    throw error
  }
}

async function ensureProjectLayoutDirs(root: string, projectId: string) {
  const dir = resolveSafeCanvasProjectDir(root, assertCanvasProjectId(projectId))
  await fs.mkdir(dir, { recursive: true })
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true })
}

async function readProjectsIndex(root: string): Promise<CanvasProjectMeta[]> {
  try {
    const raw = await fs.readFile(projectsIndexPath(root), 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeCanvasMeta)
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return []
    throw error
  }
}

/** 读取 projects.json 全量条目（含软删除，供素材/音色库过滤等内部使用） */
export const readCanvasProjectsIndex = readProjectsIndex

function normalizeCanvasMeta(
  item: Partial<CanvasProjectMeta> & { name?: string },
): CanvasProjectMeta {
  const now = Date.now()
  return {
    id: String(item?.id || ''),
    title: String(item?.title || item?.name || '未命名画布'),
    description: String(item?.description || ''),
    coverImagePath: item?.coverImagePath,
    coverManual: Boolean(item?.coverManual),
    createdAt: Number(item?.createdAt) || now,
    updatedAt: Number(item?.updatedAt) || now,
    recovered: item?.recovered,
    deletedAt:
      typeof item?.deletedAt === 'number' && item.deletedAt > 0 ? item.deletedAt : undefined,
  }
}

async function readCanvasDataFromDisk(dir: string): Promise<CanvasProjectData | null> {
  try {
    const raw = await fs.readFile(path.join(dir, 'data.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    return normalizeCanvasProjectDataFromDisk(parsed)
  } catch {
    return null
  }
}

function normalizeCanvasData(raw: unknown): CanvasProjectData {
  return normalizeCanvasProjectDataFromDisk(raw)
}

async function scanDiskProjects(root: string): Promise<CanvasProjectMeta[]> {
  let entries: string[] = []
  try {
    entries = await fs.readdir(root)
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return []
    throw error
  }

  const found: CanvasProjectMeta[] = []
  for (const name of entries) {
    if (!isCanvasProjectDirName(name)) continue
    const dir = path.join(root, name)
    const stat = await fs.stat(dir).catch(() => null)
    if (!stat?.isDirectory()) continue

    let meta: CanvasProjectMeta | null = null
    try {
      const metaRaw = await fs.readFile(path.join(dir, 'meta.json'), 'utf-8')
      meta = normalizeCanvasMeta({ ...JSON.parse(metaRaw), id: name })
    } catch {
      /* ignore */
    }

    if (!meta) {
      const data = await readCanvasDataFromDisk(dir)
      const legacyName =
        data && typeof (data as unknown as Record<string, unknown>).name === 'string'
          ? String((data as unknown as Record<string, unknown>).name)
          : ''
      const statTime = stat.mtimeMs
      meta = {
        id: name,
        title: legacyName || `画布 ${name.slice(-8)}`,
        description: '',
        createdAt: statTime,
        updatedAt: statTime,
        recovered: true,
      }
    }

    found.push(meta)
  }
  return found
}

async function mergeProjectsWithDiskScan(root: string): Promise<CanvasProjectMeta[]> {
  const indexed = await readProjectsIndex(root)
  const scanned = await scanDiskProjects(root)
  const byId = new Map<string, CanvasProjectMeta>()

  for (const project of indexed) {
    if (project.id) byId.set(project.id, project)
  }
  for (const project of scanned) {
    if (!byId.has(project.id)) {
      byId.set(project.id, project)
    }
  }

  return Array.from(byId.values()).sort((a, b) => b.updatedAt - a.updatedAt)
}

async function updateProjectInIndex(
  root: string,
  projectId: string,
  patch: Partial<CanvasProjectMeta>,
): Promise<CanvasProjectMeta | null> {
  let updated: CanvasProjectMeta | null = null

  await readModifyWriteJsonAtomic<CanvasProjectMeta[]>(
    projectsIndexPath(root),
    [],
    async (projects) => {
      const index = projects.findIndex((p) => p.id === projectId)
      if (index < 0) return projects

      updated = {
        ...projects[index],
        ...patch,
        updatedAt: Date.now(),
      }
      projects[index] = updated
      return projects
    },
  )

  return updated
}

export function registerCanvasIpc() {
  ipcMain.handle('canvas:list-projects', async () => {
    try {
      const root = await resolveCanvasRoot()
      await fs.mkdir(root, { recursive: true })
      const projects = filterActiveProjects(await mergeProjectsWithDiskScan(root))
      return { success: true, projects }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, projects: [], error: err.message }
    }
  })

  ipcMain.handle(
    'canvas:create-project',
    async (_event, payload: {
      title?: string
      description?: string
    }) => {
      try {
        const root = await resolveCanvasRoot()
        await fs.mkdir(root, { recursive: true })

        const id = `cv_${randomUUID()}`
        const now = Date.now()
        const project: CanvasProjectMeta = {
          id,
          title: payload.title?.trim() || `新画布 ${new Date().toLocaleDateString('zh-CN')}`,
          description: payload.description?.trim() || '',
          createdAt: now,
          updatedAt: now,
        }

        await ensureProjectLayoutDirs(root, id)
        await writeJsonAtomic(dataFilePath(root, id), createEmptyCanvasData())
        await writeJsonAtomic(tasksFilePath(root, id), [])

        await readModifyWriteJsonAtomic<CanvasProjectMeta[]>(
          projectsIndexPath(root),
          [],
          async (projects) => {
            projects.unshift(project)
            return projects
          },
        )

        return { success: true, project }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message }
      }
    },
  )

  ipcMain.handle('canvas:delete-project', async (_event, projectId: string) => {
    try {
      const root = await resolveCanvasRoot()
      const id = assertCanvasProjectId(projectId)
      const now = Date.now()

      await readModifyWriteJsonAtomic<CanvasProjectMeta[]>(
        projectsIndexPath(root),
        [],
        async (projects) => {
          const index = projects.findIndex((p) => p.id === id)
          if (index >= 0) {
            projects[index] = {
              ...normalizeCanvasMeta(projects[index]),
              deletedAt: now,
              updatedAt: now,
            }
            return projects
          }

          const scanned = await scanDiskProjects(root)
          const meta = scanned.find((p) => p.id === id)
          if (meta) {
            projects.push({ ...meta, deletedAt: now, updatedAt: now })
          }
          return projects
        },
      )

      return { success: true }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('canvas:list-deleted-projects', async () => {
    try {
      const root = await resolveCanvasRoot()
      await fs.mkdir(root, { recursive: true })
      const projects = sortRecycleBinProjectsByDeletedAtDesc(
        filterSoftDeletedProjects(await mergeProjectsWithDiskScan(root)),
      )
      return { success: true, projects }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, projects: [], error: err.message }
    }
  })

  ipcMain.handle('canvas:restore-project', async (_event, projectId: string) => {
    try {
      const root = await resolveCanvasRoot()
      const id = assertCanvasProjectId(projectId)
      const now = Date.now()
      let restored: CanvasProjectMeta | null = null

      await readModifyWriteJsonAtomic<CanvasProjectMeta[]>(
        projectsIndexPath(root),
        [],
        async (projects) => {
          const index = projects.findIndex((p) => p.id === id)
          if (index < 0) return projects
          const next = {
            ...normalizeCanvasMeta(stripProjectDeletedAt(projects[index])),
            updatedAt: now,
          }
          delete (next as { deletedAt?: number }).deletedAt
          projects[index] = next
          restored = next
          return projects
        },
      )

      if (!restored) return { success: false, error: '回收站中未找到该项目' }
      return { success: true, project: restored }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('canvas:purge-project', async (_event, projectId: string) => {
    try {
      const root = await resolveCanvasRoot()
      const id = assertCanvasProjectId(projectId)

      const indexed = (await mergeProjectsWithDiskScan(root)).find((p) => p.id === id)
      if (indexed && !isProjectSoftDeleted(indexed)) {
        return { success: false, error: '仅可彻底删除回收站中的项目，请先移入回收站' }
      }

      await readModifyWriteJsonAtomic<CanvasProjectMeta[]>(
        projectsIndexPath(root),
        [],
        async (projects) => projects.filter((p) => p.id !== id),
      )

      const dir = resolveSafeCanvasProjectDir(root, id)
      await fs.rm(dir, { recursive: true, force: true })
      return { success: true }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('canvas:backup-data', async (_event, projectId: string, label?: string) => {
    try {
      const root = await resolveCanvasRoot()
      const dir = resolveSafeCanvasProjectDir(root, projectId)
      const backupPath = await backupCanvasDataFile(dir, label || String(Date.now()))
      return { success: true, backupPath: backupPath ?? undefined }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('canvas:read-data', async (_event, projectId: string) => {
    try {
      const root = await resolveCanvasRoot()
      const dir = resolveSafeCanvasProjectDir(root, projectId)
      await ensureProjectLayoutDirs(root, assertCanvasProjectId(projectId))
      const data = await readCanvasDataFromDisk(dir)
      return { success: true, data: data ?? createEmptyCanvasData() }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(
    'canvas:write-data',
    async (_event, projectId: string, data: CanvasProjectData) => {
      try {
        const root = await resolveCanvasRoot()
        const id = assertCanvasProjectId(projectId)
        const dir = resolveSafeCanvasProjectDir(root, id)
        await ensureProjectLayoutDirs(root, id)
        const disk = (await readCanvasDataFromDisk(dir)) ?? createEmptyCanvasData()
        const incoming = normalizeCanvasData(data)
        const merged = mergeCanvasProjectDataForPersist(disk, incoming)
        await writeJsonAtomic(path.join(dir, 'data.json'), merged)

        await updateProjectInIndex(root, id, {})

        return { success: true }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message }
      }
    },
  )

  ipcMain.handle(
    'canvas:update-project',
    async (_event, projectId: string, patch: Partial<CanvasProjectMeta>) => {
      try {
        const root = await resolveCanvasRoot()
        const id = assertCanvasProjectId(projectId)
        let project = await updateProjectInIndex(root, id, patch)

        if (!project) {
          const scanned = await scanDiskProjects(root)
          const existing = scanned.find((p) => p.id === id)
          if (!existing) {
            return { success: false, error: '项目不存在' }
          }
          project = {
            ...existing,
            ...patch,
            updatedAt: Date.now(),
          }
          await readModifyWriteJsonAtomic<CanvasProjectMeta[]>(
            projectsIndexPath(root),
            [],
            async (projects) => {
              projects.unshift(project!)
              return projects
            },
          )
        }

        return { success: true, project }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message }
      }
    },
  )

  ipcMain.handle('canvas:get-project', async (_event, projectId: string) => {
    try {
      const root = await resolveCanvasRoot()
      const id = assertCanvasProjectId(projectId)
      const projects = await mergeProjectsWithDiskScan(root)
      const project = projects.find((p) => p.id === id)
      if (!project) {
        return { success: false, error: '项目不存在' }
      }
      return { success: true, project }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('canvas:read-tasks', async (_event, projectId: string) => {
    try {
      const root = await resolveCanvasRoot()
      const tasks = await readProjectTasks(root, assertCanvasProjectId(projectId))
      return { success: true, tasks }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, tasks: [], error: err.message }
    }
  })

  ipcMain.handle(
    'canvas:write-tasks',
    async (_event, projectId: string, tasks: unknown[]) => {
      try {
        const root = await resolveCanvasRoot()
        const id = assertCanvasProjectId(projectId)
        await writeJsonAtomic(tasksFilePath(root, id), tasks)
        return { success: true }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message }
      }
    },
  )
}
