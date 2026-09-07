import path from 'node:path'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dialog, ipcMain } from 'electron'
import type { AppSettings } from '../../src/types/settings'
import type { WorkflowProjectData, WorkflowProjectMeta, WorkflowTask } from '../../src/types/workflow'
import { DEFAULT_PROJECT_STYLE_PRESET_KEY } from '../../src/lib/workflow/project-visual-style'
import { PROJECT_LAYOUT_FOLDER_NAMES } from '../../src/lib/storage/project-paths'
import { normalizeWorkflowStep } from '../../src/lib/workflow/step-utils'
import { normalizeWorkflowProjectAssets } from '../../src/lib/workflow/asset-utils'
import { createEmptyEpisode, normalizeWorkflowEpisodes } from '../../src/lib/workflow/episode-utils'
import { normalizeShotList } from '../../src/lib/workflow/shot-utils'
import { readSettingsMerged } from './ipc-settings'
import { resolveWorkflowStorageDir } from '../../src/lib/storage/storage-path-utils'
import {
  projectDataHasLegacyAbsoluteMediaPaths,
  remapProjectDataMediaPathsForRead,
  remapProjectDataMediaPathsForWrite,
  repairProjectDataMediaPaths,
} from '../../src/lib/workflow/project-media-paths'
import { migrateRemoteMediaInProjectData } from './project-media-migration'
import { readModifyWriteJsonAtomic, writeJsonAtomic } from './atomic-write'
import { migrateFlatWorkflowLayoutToSubdir } from './workflow-layout-migration'
import {
  filterActiveProjects,
  filterSoftDeletedProjects,
  isProjectSoftDeleted,
  sortRecycleBinProjectsByDeletedAtDesc,
  stripProjectDeletedAt,
} from '../../src/lib/storage/project-soft-delete'

async function readSettingsRaw(): Promise<AppSettings> {
  const { data } = await readSettingsMerged()
  return data
}

export async function resolveWorkflowRoot(): Promise<string> {
  const { data, ctx } = await readSettingsMerged()
  const root = data.dataRootPath || ctx.dataRoot
  if (!root) {
    throw new Error('请先在系统设置中选择数据根目录')
  }
  const workflowDir = resolveWorkflowStorageDir(data, root)
  await migrateFlatWorkflowLayoutToSubdir(root, workflowDir)
  return workflowDir
}

function projectsIndexPath(root: string) {
  return path.join(root, 'projects.json')
}

export function projectDir(root: string, projectId: string) {
  return path.join(root, projectId)
}

async function ensureProjectLayoutDirs(root: string, projectId: string) {
  const dir = projectDir(root, projectId)
  await fs.mkdir(dir, { recursive: true })
  for (const name of PROJECT_LAYOUT_FOLDER_NAMES) {
    await fs.mkdir(path.join(dir, name), { recursive: true })
  }
}

function createEmptyProjectData(_settings?: AppSettings): WorkflowProjectData {
  return {
    script: '',
    projectStylePresetKey: DEFAULT_PROJECT_STYLE_PRESET_KEY,
    episodePlan: 'bootstrap',
    currentStep: 1,
    episodes: [createEmptyEpisode(1)],
    characters: [],
    scenes: [],
    props: [],
    shots: [],
  }
}

function stripLegacyWorkflowModelFields(data: WorkflowProjectData): WorkflowProjectData {
  const record = data as WorkflowProjectData & {
    llmModelId?: string
    storyboardLlmModelId?: string
  }
  const { llmModelId: _llm, storyboardLlmModelId: _storyboard, ...rest } = record
  return rest
}

async function readProjectsIndex(root: string): Promise<WorkflowProjectMeta[]> {
  try {
    const raw = await fs.readFile(projectsIndexPath(root), 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => ({
      ...item,
      currentStep: normalizeWorkflowStep(item?.currentStep),
    }))
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return []
    throw error
  }
}

/** 读取 projects.json 全量条目（含软删除，供素材/音色库过滤等内部使用） */
export const readWorkflowProjectsIndex = readProjectsIndex

async function updateProjectInIndex(
  root: string,
  projectId: string,
  patch: Partial<WorkflowProjectMeta>,
): Promise<WorkflowProjectMeta | null> {
  let updated: WorkflowProjectMeta | null = null

  await readModifyWriteJsonAtomic<WorkflowProjectMeta[]>(
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

function dataFilePath(root: string, projectId: string) {
  return path.join(projectDir(root, projectId), 'data.json')
}

function tasksFilePath(root: string, projectId: string) {
  return path.join(projectDir(root, projectId), 'tasks.json')
}

function normalizeProjectDataForStorage(data: WorkflowProjectData): WorkflowProjectData {
  return stripLegacyWorkflowModelFields(
    normalizeWorkflowEpisodes({
      ...data,
      currentStep: normalizeWorkflowStep(data.currentStep),
      episodes: Array.isArray(data.episodes) ? data.episodes : [],
      ...normalizeWorkflowProjectAssets(data),
      shots: normalizeShotList(data.shots),
    }),
  )
}

async function readProjectData(root: string, projectId: string): Promise<WorkflowProjectData> {
  try {
    const raw = await fs.readFile(dataFilePath(root, projectId), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<WorkflowProjectData>
    const data = normalizeProjectDataForStorage({
      ...createEmptyProjectData(),
      ...parsed,
    })
    const projectRoot = projectDir(root, projectId)
    const repaired = repairProjectDataMediaPaths(data)
    const remapped = remapProjectDataMediaPathsForRead(repaired.data, projectRoot)

    const migrated = await migrateRemoteMediaInProjectData(remapped, projectRoot)
    const result = remapProjectDataMediaPathsForRead(migrated.data, projectRoot)

    if (projectDataHasLegacyAbsoluteMediaPaths(data) || migrated.changed || repaired.changed) {
      const portable = remapProjectDataMediaPathsForWrite(result, projectRoot)
      void writeJsonAtomic(dataFilePath(root, projectId), portable).catch(() => {
        /* 静默迁移失败不影响读取 */
      })
    }

    return result
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return createEmptyProjectData()
    throw error
  }
}

async function readProjectTasks(root: string, projectId: string): Promise<WorkflowTask[]> {
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

export function registerWorkflowIpc() {
  ipcMain.handle('workflow:list-projects', async () => {
    try {
      const root = await resolveWorkflowRoot()
      await fs.mkdir(root, { recursive: true })
      const projects = filterActiveProjects(await readProjectsIndex(root))
      projects.sort((a, b) => b.updatedAt - a.updatedAt)
      return { success: true, projects }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, projects: [], error: err.message }
    }
  })

  ipcMain.handle(
    'workflow:create-project',
    async (
      _event,
      payload: {
        title?: string
        description?: string
      },
    ) => {
      try {
        const root = await resolveWorkflowRoot()
        await fs.mkdir(root, { recursive: true })

        const id = `wf_${randomUUID()}`
        const now = Date.now()
        const project: WorkflowProjectMeta = {
          id,
          title: payload.title?.trim() || `新项目 ${new Date().toLocaleDateString('zh-CN')}`,
          description: payload.description?.trim() || '',
          currentStep: 1,
          createdAt: now,
          updatedAt: now,
        }

        const dir = projectDir(root, id)
        await ensureProjectLayoutDirs(root, id)
        const settings = await readSettingsRaw()
        await writeJsonAtomic(path.join(dir, 'data.json'), createEmptyProjectData(settings))

        await readModifyWriteJsonAtomic<WorkflowProjectMeta[]>(
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

  ipcMain.handle('workflow:delete-project', async (_event, projectId: string) => {
    try {
      const root = await resolveWorkflowRoot()
      const now = Date.now()
      await readModifyWriteJsonAtomic<WorkflowProjectMeta[]>(
        projectsIndexPath(root),
        [],
        async (projects) => {
          const index = projects.findIndex((p) => p.id === projectId)
          if (index < 0) return projects
          projects[index] = {
            ...projects[index],
            deletedAt: now,
            updatedAt: now,
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

  ipcMain.handle('workflow:list-deleted-projects', async () => {
    try {
      const root = await resolveWorkflowRoot()
      await fs.mkdir(root, { recursive: true })
      const projects = sortRecycleBinProjectsByDeletedAtDesc(
        filterSoftDeletedProjects(await readProjectsIndex(root)),
      )
      return { success: true, projects }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, projects: [], error: err.message }
    }
  })

  ipcMain.handle('workflow:restore-project', async (_event, projectId: string) => {
    try {
      const root = await resolveWorkflowRoot()
      const now = Date.now()
      let restored: WorkflowProjectMeta | null = null
      await readModifyWriteJsonAtomic<WorkflowProjectMeta[]>(
        projectsIndexPath(root),
        [],
        async (projects) => {
          const index = projects.findIndex((p) => p.id === projectId)
          if (index < 0) return projects
          const next = {
            ...stripProjectDeletedAt(projects[index]),
            updatedAt: now,
          }
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

  ipcMain.handle('workflow:purge-project', async (_event, projectId: string) => {
    try {
      const root = await resolveWorkflowRoot()
      const id = String(projectId || '').trim()
      if (!id) return { success: false, error: '项目 ID 无效' }

      const indexed = (await readProjectsIndex(root)).find((p) => p.id === id)
      if (!indexed) {
        const dirMissing = projectDir(root, id)
        await fs.rm(dirMissing, { recursive: true, force: true })
        return { success: true }
      }
      if (!isProjectSoftDeleted(indexed)) {
        return { success: false, error: '仅可彻底删除回收站中的项目，请先移入回收站' }
      }

      await readModifyWriteJsonAtomic<WorkflowProjectMeta[]>(
        projectsIndexPath(root),
        [],
        async (projects) => projects.filter((p) => p.id !== id),
      )

      const dir = projectDir(root, id)
      await fs.rm(dir, { recursive: true, force: true })
      return { success: true }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('workflow:read-data', async (_event, projectId: string) => {
    try {
      const root = await resolveWorkflowRoot()
      await ensureProjectLayoutDirs(root, projectId)
      const data = await readProjectData(root, projectId)
      return { success: true, data }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle(
    'workflow:write-data',
    async (_event, projectId: string, data: WorkflowProjectData) => {
      try {
        const root = await resolveWorkflowRoot()
        const dir = projectDir(root, projectId)
        await fs.mkdir(dir, { recursive: true })
        const normalized = normalizeProjectDataForStorage(data)
        const migrated = await migrateRemoteMediaInProjectData(normalized, dir)
        const stored = remapProjectDataMediaPathsForWrite(migrated.data, dir)
        await writeJsonAtomic(dataFilePath(root, projectId), stored)

        await updateProjectInIndex(root, projectId, {
          currentStep: data.currentStep,
        })

        return { success: true }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message }
      }
    },
  )

  ipcMain.handle(
    'workflow:update-project',
    async (_event, projectId: string, patch: Partial<WorkflowProjectMeta>) => {
      try {
        const root = await resolveWorkflowRoot()
        const project = await updateProjectInIndex(root, projectId, patch)
        if (!project) {
          return { success: false, error: '项目不存在' }
        }
        return { success: true, project }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message }
      }
    },
  )

  ipcMain.handle('workflow:get-project', async (_event, projectId: string) => {
    try {
      const root = await resolveWorkflowRoot()
      const projects = await readProjectsIndex(root)
      const project = projects.find((p) => p.id === projectId)
      if (!project) {
        return { success: false, error: '项目不存在' }
      }
      return { success: true, project }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('workflow:read-tasks', async (_event, projectId: string) => {
    try {
      const root = await resolveWorkflowRoot()
      const tasks = await readProjectTasks(root, projectId)
      return { success: true, tasks }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, tasks: [], error: err.message }
    }
  })

  ipcMain.handle(
    'workflow:write-tasks',
    async (_event, projectId: string, tasks: WorkflowTask[]) => {
      try {
        const root = await resolveWorkflowRoot()
        const dir = projectDir(root, projectId)
        await fs.mkdir(dir, { recursive: true })
        await writeJsonAtomic(tasksFilePath(root, projectId), tasks)
        return { success: true }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message }
      }
    },
  )

  ipcMain.handle('workflow:export-project', async (_event, projectId: string) => {
    try {
      const id = String(projectId || '').trim()
      if (!id) return { success: false, error: '项目 ID 无效' }

      const pick = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: '选择导出目标文件夹',
      })
      if (pick.canceled || !pick.filePaths[0]) {
        return { success: true, canceled: true as const }
      }

      const root = await resolveWorkflowRoot()
      const sourceDir = projectDir(root, id)
      await fs.access(path.join(sourceDir, 'data.json'))
      const targetDir = path.join(pick.filePaths[0], id)
      await fs.cp(sourceDir, targetDir, { recursive: true, force: true })

      return { success: true, targetDir }
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        return { success: false, error: '项目不存在或缺少 data.json' }
      }
      const message = error as Error
      return { success: false, error: message.message }
    }
  })

  ipcMain.handle('workflow:import-project', async () => {
    try {
      const pick = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择要导入的项目文件夹（含 data.json）',
      })
      if (pick.canceled || !pick.filePaths[0]) {
        return { success: true, canceled: true as const }
      }

      const sourceDir = path.resolve(pick.filePaths[0])
      await fs.access(path.join(sourceDir, 'data.json'))

      const projectId = path.basename(sourceDir)
      if (!projectId) return { success: false, error: '无法识别项目 ID' }

      const root = await resolveWorkflowRoot()
      const targetDir = projectDir(root, projectId)
      await ensureProjectLayoutDirs(root, projectId)
      await fs.cp(sourceDir, targetDir, { recursive: true, force: true })

      let title = projectId
      try {
        const raw = await fs.readFile(path.join(targetDir, 'data.json'), 'utf-8')
        const parsed = JSON.parse(raw) as { script?: string }
        const scriptPreview = parsed.script?.trim().slice(0, 24)
        if (scriptPreview) title = scriptPreview
      } catch {
        /* ignore */
      }

      const now = Date.now()
      await readModifyWriteJsonAtomic<WorkflowProjectMeta[]>(
        projectsIndexPath(root),
        [],
        async (projects) => {
          const index = projects.findIndex((item) => item.id === projectId)
          if (index >= 0) {
            projects[index] = { ...projects[index], title, updatedAt: now }
          } else {
            projects.unshift({
              id: projectId,
              title,
              description: '',
              currentStep: 1,
              createdAt: now,
              updatedAt: now,
            })
          }
          return projects
        },
      )

      return { success: true, projectId, targetDir }
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        return { success: false, error: '所选文件夹缺少 data.json，无法导入' }
      }
      const message = error as Error
      return { success: false, error: message.message }
    }
  })
}
