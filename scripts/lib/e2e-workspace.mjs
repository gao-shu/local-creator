/**
 * Electron E2E · 隔离数据目录基础结构
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const STORAGE_ROOT_POINTER_FILE = 'storage-root.json'
const PORTABLE_SETTINGS_FILE = 'settings.json'

function buildStorageRootPointer(dataRoot) {
  return { dataRootPath: dataRoot }
}

export function joinRoot(base, child) {
  const sep = base.includes('\\') ? '\\' : '/'
  return `${base.replace(/[\\/]+$/, '')}${sep}${child}`
}

export function buildMinimalSettings(dataRoot) {
  return buildE2eSettings(dataRoot)
}

const E2E_LLM_MODEL = {
  id: 'e2e-llm',
  name: 'E2E Mock LLM',
  model: 'mock-llm',
  source: 'custom',
}

const E2E_IMAGE_MODEL = {
  id: 'e2e-image',
  name: 'E2E Mock Image',
  model: 'mock-image',
  source: 'custom',
}

const E2E_VIDEO_MODEL = {
  id: 'e2e-video',
  name: 'E2E Mock Video',
  model: 'mock-video',
  source: 'custom',
  ratios: ['16:9'],
  durations: [5],
  resolutions: ['720p'],
}

/** E2E 专用 settings：预置 LLM/生图/生视频模型，避免 Step2/4 模型校验拦截 */
export function buildE2eSettings(dataRoot) {
  return {
    dataRootPath: dataRoot,
    projectsDataPath: dataRoot,
    workflowDataPath: joinRoot(dataRoot, 'workflow'),
    characterLibraryPath: '',
    sceneLibraryPath: '',
    generatedImagesPath: '',
    videoSavePath: '',
    llmModels: [E2E_LLM_MODEL],
    imageModels: [E2E_IMAGE_MODEL],
    videoModels: [E2E_VIDEO_MODEL],
    lastUsedEpisodeLlmModelId: E2E_LLM_MODEL.id,
    lastUsedStoryboardLlmModelId: E2E_LLM_MODEL.id,
    lastUsedAssetImageModelId: E2E_IMAGE_MODEL.id,
    lastUsedStoryboardImageModelId: E2E_IMAGE_MODEL.id,
    lastUsedStoryboardVideoModelId: E2E_VIDEO_MODEL.id,
    lastUsedStoryboardVideoReferenceMode: 'text_to_video',
    debugEnabled: false,
    /** Phase 4：E2E 固定深度档，便于断言 issues 弹窗 */
    storyboardValidateMode: 'deep',
  }
}

/**
 * 创建 E2E 临时目录（launcher + data + workflow）
 * @param {{ prefix?: string, projects?: unknown[], seedProject?: { id: string, meta: object, data: object } | null }} options
 */
export async function createE2eWorkspace(options = {}) {
  const prefix = options.prefix ?? 'haode-e2e-'
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  const launcherDir = joinRoot(root, 'launcher')
  const dataRoot = joinRoot(root, 'data')
  const workflowDir = joinRoot(dataRoot, 'workflow')

  await fs.mkdir(launcherDir, { recursive: true })
  await fs.mkdir(dataRoot, { recursive: true })
  await fs.mkdir(workflowDir, { recursive: true })

  await fs.writeFile(
    joinRoot(launcherDir, STORAGE_ROOT_POINTER_FILE),
    JSON.stringify(buildStorageRootPointer(dataRoot), null, 2),
    'utf-8',
  )

  await fs.writeFile(
    joinRoot(dataRoot, PORTABLE_SETTINGS_FILE),
    JSON.stringify(options.settings ?? buildE2eSettings(dataRoot), null, 2),
    'utf-8',
  )

  await fs.writeFile(
    joinRoot(workflowDir, 'projects.json'),
    JSON.stringify(options.projects ?? [], null, 2),
    'utf-8',
  )

  let projectDir = null
  if (options.seedProject) {
    const { id, meta, data } = options.seedProject
    projectDir = joinRoot(workflowDir, id)
    await fs.mkdir(projectDir, { recursive: true })
    await fs.writeFile(joinRoot(projectDir, 'data.json'), JSON.stringify(data, null, 2), 'utf-8')
    await fs.writeFile(joinRoot(projectDir, 'tasks.json'), '[]', 'utf-8')
    if (meta) {
      const projects = options.projects ?? []
      if (!projects.some((item) => item?.id === id)) {
        await fs.writeFile(
          joinRoot(workflowDir, 'projects.json'),
          JSON.stringify([...projects, meta], null, 2),
          'utf-8',
        )
      }
    }
  }

  return {
    root,
    launcherDir,
    dataRoot,
    workflowDir,
    projectDir,
    cleanup: async () => {
      await fs.rm(root, { recursive: true, force: true })
    },
  }
}

/**
 * 仅创建 launcher 目录，不写 storage-root.json（模拟未绑定便携数据根）
 */
export async function createEmptyLauncherWorkspace(options = {}) {
  const prefix = options.prefix ?? 'haode-e2e-no-root-'
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  const launcherDir = joinRoot(root, 'launcher')
  await fs.mkdir(launcherDir, { recursive: true })

  return {
    root,
    launcherDir,
    dataRoot: '',
    workflowDir: '',
    projectDir: null,
    cleanup: async () => {
      await fs.rm(root, { recursive: true, force: true })
    },
  }
}
