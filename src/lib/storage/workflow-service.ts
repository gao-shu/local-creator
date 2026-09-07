import type {
  WorkflowCreateResult,
  WorkflowDeleteResult,
  WorkflowListResult,
  WorkflowProjectData,
  WorkflowProjectMeta,
  WorkflowReadDataResult,
  WorkflowTasksResult,
  WorkflowTask,
  WorkflowUpdateProjectResult,
  WorkflowWriteDataResult,
  WorkflowWriteTasksResult,
} from '@/types/workflow'
import { normalizeWorkflowProjectAssets } from '@/lib/workflow/asset-utils'
import { normalizeWorkflowEpisodes } from '@/lib/workflow/episode-utils'
import { DEFAULT_PROJECT_STYLE_PRESET_KEY } from '@/lib/workflow/project-visual-style'
import { readSettings } from '@/lib/storage/settings-service'
import { sanitizeWorkflowDataMediaForWrite } from '@/lib/workflow/project-media-save'

const devTaskStore = new Map<string, WorkflowTask[]>()
const devDataStore = new Map<string, WorkflowProjectData>()

export interface WorkflowAPI {
  listProjects: () => Promise<WorkflowListResult>
  createProject: (payload: {
    title?: string
    description?: string
  }) => Promise<WorkflowCreateResult>
  deleteProject: (projectId: string) => Promise<WorkflowDeleteResult>
  listDeletedProjects: () => Promise<WorkflowListResult>
  restoreProject: (projectId: string) => Promise<WorkflowUpdateProjectResult>
  purgeProject: (projectId: string) => Promise<WorkflowDeleteResult>
  getProject: (projectId: string) => Promise<WorkflowUpdateProjectResult>
  readData: (projectId: string) => Promise<WorkflowReadDataResult>
  writeData: (projectId: string, data: WorkflowProjectData) => Promise<WorkflowWriteDataResult>
  updateProject: (
    projectId: string,
    patch: Partial<WorkflowProjectMeta>,
  ) => Promise<WorkflowUpdateProjectResult>
  readTasks: (projectId: string) => Promise<WorkflowTasksResult>
  writeTasks: (projectId: string, tasks: WorkflowTask[]) => Promise<WorkflowWriteTasksResult>
  exportProject: (projectId: string) => Promise<{
    success: boolean
    canceled?: boolean
    targetDir?: string
    error?: string
  }>
  importProject: () => Promise<{
    success: boolean
    canceled?: boolean
    projectId?: string
    targetDir?: string
    error?: string
  }>
}

function isMissingDataRootError(message?: string): boolean {
  return Boolean(message?.includes('数据根目录'))
}

export async function listWorkflowProjects(): Promise<WorkflowProjectMeta[]> {
  if (!window.workflowAPI) return []
  const res = await window.workflowAPI.listProjects()
  if (!res.success) {
    if (isMissingDataRootError(res.error)) return []
    throw new Error(res.error || '加载项目失败')
  }
  return res.projects
}

export async function getWorkflowProject(projectId: string): Promise<WorkflowProjectMeta> {
  if (!window.workflowAPI) {
    throw new Error('workflowAPI 不可用')
  }
  const res = await window.workflowAPI.getProject(projectId)
  if (!res.success || !res.project) throw new Error(res.error || '项目不存在')
  return res.project
}

function normalizeLoadedProjectData(data: WorkflowProjectData): WorkflowProjectData {
  return normalizeWorkflowEpisodes({
    ...data,
    ...normalizeWorkflowProjectAssets(data),
  })
}

export async function readWorkflowData(projectId: string): Promise<WorkflowProjectData> {
  if (!window.workflowAPI) {
    const raw = devDataStore.get(projectId) ?? createDevPreviewProject(projectId).data
    return normalizeLoadedProjectData(raw)
  }
  const res = await window.workflowAPI.readData(projectId)
  if (!res.success || !res.data) throw new Error(res.error || '读取项目数据失败')
  return normalizeLoadedProjectData(res.data)
}

export async function writeWorkflowData(
  projectId: string,
  data: WorkflowProjectData,
): Promise<void> {
  let payload = normalizeLoadedProjectData(data)
  if (!window.workflowAPI) {
    devDataStore.set(projectId, payload)
    return
  }

  const settingsRes = await readSettings()
  payload = await sanitizeWorkflowDataMediaForWrite(payload, {
    settings: settingsRes.data,
    appDataDir: settingsRes.appDataDir,
    projectId,
  })

  const res = await window.workflowAPI.writeData(projectId, payload)
  if (!res.success) throw new Error(res.error || '保存失败')
}

const workflowDataWriteLocks = new Map<string, Promise<unknown>>()

/** 串行 read-modify-write，避免并行 AI 任务互相覆盖 data.json */
export async function patchWorkflowData(
  projectId: string,
  mutator: (current: WorkflowProjectData) => WorkflowProjectData | Promise<WorkflowProjectData>,
): Promise<WorkflowProjectData> {
  const prev = workflowDataWriteLocks.get(projectId) ?? Promise.resolve()
  const run = prev.then(async () => {
    const current = await readWorkflowData(projectId)
    const next = await mutator(current)
    await writeWorkflowData(projectId, next)
    return next
  })
  workflowDataWriteLocks.set(
    projectId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  )
  return run
}

export async function updateWorkflowProject(
  projectId: string,
  patch: Partial<WorkflowProjectMeta>,
): Promise<WorkflowProjectMeta> {
  if (!window.workflowAPI) {
    throw new Error('workflowAPI 不可用')
  }
  const res = await window.workflowAPI.updateProject(projectId, patch)
  if (!res.success || !res.project) throw new Error(res.error || '更新失败')
  return res.project
}

export async function createWorkflowProject(payload: {
  title?: string
  description?: string
}): Promise<WorkflowProjectMeta> {
  if (!window.workflowAPI) {
    throw new Error('workflowAPI 不可用')
  }
  const res = await window.workflowAPI.createProject(payload)
  if (!res.success || !res.project) throw new Error(res.error || '创建失败')
  return res.project
}

export async function deleteWorkflowProject(projectId: string): Promise<void> {
  if (!window.workflowAPI) return
  const res = await window.workflowAPI.deleteProject(projectId)
  if (!res.success) throw new Error(res.error || '删除失败')
}

export async function listDeletedWorkflowProjects(): Promise<WorkflowProjectMeta[]> {
  if (!window.workflowAPI?.listDeletedProjects) return []
  const res = await window.workflowAPI.listDeletedProjects()
  if (!res.success) {
    if (isMissingDataRootError(res.error)) return []
    throw new Error(res.error || '加载回收站失败')
  }
  return res.projects
}

export async function restoreWorkflowProject(projectId: string): Promise<WorkflowProjectMeta> {
  if (!window.workflowAPI?.restoreProject) {
    throw new Error('回收站恢复服务未就绪，请完全退出并重新启动桌面客户端')
  }
  const res = await window.workflowAPI.restoreProject(projectId)
  if (!res.success || !res.project) throw new Error(res.error || '恢复失败')
  return res.project
}

export async function purgeWorkflowProject(projectId: string): Promise<void> {
  if (!window.workflowAPI?.purgeProject) {
    throw new Error('彻底删除服务未就绪，请完全退出并重新启动桌面客户端')
  }
  const res = await window.workflowAPI.purgeProject(projectId)
  if (!res.success) throw new Error(res.error || '彻底删除失败')
}

export async function readWorkflowTasks(projectId: string): Promise<WorkflowTask[]> {
  if (!window.workflowAPI) {
    return devTaskStore.get(projectId) ?? []
  }
  const res = await window.workflowAPI.readTasks(projectId)
  if (!res.success) throw new Error(res.error || '读取任务失败')
  return res.tasks
}

export async function writeWorkflowTasks(projectId: string, tasks: WorkflowTask[]): Promise<void> {
  if (!window.workflowAPI) {
    devTaskStore.set(projectId, tasks)
    return
  }
  const res = await window.workflowAPI.writeTasks(projectId, tasks)
  if (!res.success) throw new Error(res.error || '写入任务失败')
}

export function seedDevPreviewData(projectId: string) {
  const preview = createDevPreviewProject(projectId)
  devDataStore.set(projectId, preview.data)
  return preview
}

/** 浏览器冒烟测试用预览数据（无 Electron preload 时） */
export function createDevPreviewProject(projectId: string): {
  meta: WorkflowProjectMeta
  data: WorkflowProjectData
} {
  const now = Date.now()
  return {
    meta: {
      id: projectId,
      title: '预览项目',
      description: '',
      currentStep: 4,
      createdAt: now,
      updatedAt: now,
    },
    data: {
      script: '这是预览剧本。主角在都市中经历奇遇，展开一段冒险旅程。',
      currentStep: 4,
      projectStylePresetKey: DEFAULT_PROJECT_STYLE_PRESET_KEY,
      episodes: [
        {
          id: 'ep_preview_1',
          episodeIndex: 1,
          title: '第 1 集',
          summary: '主角登场，故事拉开序幕。',
          content: '主角走在霓虹闪烁的街道上，手中握着一张旧照片，命运即将改变。',
          characters: [{ name: '主角', description: '青年，现代都市装扮' }],
          scenes: [{ name: '城市街道', description: '夜晚霓虹灯下的主干道' }],
          items: [{ name: '旧照片', description: '泛黄的相片' }],
        },
      ],
      characters: [],
      scenes: [],
      props: [],
      shots: [],
    },
  }
}

export function isWorkflowApiAvailable() {
  return Boolean(window.workflowAPI)
}
