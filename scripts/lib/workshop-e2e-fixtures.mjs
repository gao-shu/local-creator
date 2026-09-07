/**
 * 创作工坊 Electron E2E · 隔离数据目录与预置项目
 */
import fs from 'node:fs/promises'
import { createE2eWorkspace, createEmptyLauncherWorkspace, joinRoot } from './e2e-workspace.mjs'

export const E2E_PROJECT_ID = 'wf_e2e_test'
export const E2E_PROJECT_TITLE = 'E2E全流程测试'
export const E2E_SCRIPT_SNIPPET = 'E2E测试剧本开头'
export const E2E_EPISODE_ID = 'ep_e2e_1'
export const E2E_EPISODE_ID_2 = 'ep_e2e_2'
export const E2E_EPISODE_1_SNIPPET = '第一集专属内容 Alpha'
export const E2E_EPISODE_2_SNIPPET = '第二集专属内容 Beta'
export const E2E_EPISODE_EDIT_MARKER = 'E2E单集编辑保留标记'
export const E2E_SHOT_IDS = ['shot_e2e_1', 'shot_e2e_2', 'shot_e2e_3']

export const E2E_LIST_ALPHA_ID = 'wf_e2e_list_alpha'
export const E2E_LIST_BETA_ID = 'wf_e2e_list_beta'
export const E2E_LIST_ALPHA_TITLE = 'E2E搜索Alpha项目'
export const E2E_LIST_BETA_TITLE = 'E2E搜索Beta项目'
export const E2E_LIST_BETA_DESC = 'Beta描述专用标记'
export const E2E_LIST_PROJECT_COUNT = 17
export const E2E_LIST_DEFAULT_PAGE_SIZE = 12

export const E2E_CANVAS_CAPCUT_ID = 'cv_e2e_capcut'
export const E2E_CANVAS_CAPCUT_TITLE = 'E2E画布剪映导出'

export const E2E_CANVAS_LIST_SMOKE_ID = 'cv_e2e_list_smoke'
export const E2E_CANVAS_LIST_SMOKE_TITLE = 'E2E画布列表测试'
export const E2E_CANVAS_LIST_SMOKE_DESC = 'E2E画布列表描述标记'

export const E2E_CAPCUT_DRAFTS_DIR_NAME = 'e2e-capcut-drafts'
export const E2E_CAPCUT_MARKER_FILE = 'e2e-capcut-marker.json'

const PROJECT_LAYOUT_FOLDERS = ['Roles', 'Scenes', 'Items', 'pictures', 'videos', 'voices']

function buildProjectData(now) {
  const episode = {
    id: E2E_EPISODE_ID,
    episodeIndex: 1,
    title: '第 1 集',
    summary: 'E2E 测试分集',
    content: '主角走在霓虹闪烁的街道上，准备开始一段冒险。',
    characters: [{ name: '主角', description: '青年，现代都市装扮' }],
    scenes: [{ name: '城市街道', description: '夜晚霓虹灯下的主干道' }],
    items: [{ name: '旧照片', description: '泛黄的相片' }],
  }

  const shots = [1, 2, 3].map((shotNumber) => ({
    id: `shot_e2e_${shotNumber}`,
    episodeId: E2E_EPISODE_ID,
    episodeIndex: 1,
    shotNumber,
    dialogue: `镜头 ${shotNumber}`,
    prompt: `E2E测试镜头${shotNumber}：主角站在城市街道上，电影感构图`,
    status: 'draft',
    updatedAt: now,
  }))

  return {
    script: `${E2E_SCRIPT_SNIPPET}。主角在都市中经历奇遇，展开一段冒险旅程。`,
    currentStep: 1,
    projectStylePresetKey: 'style_realistic',
    episodes: [episode],
    characters: [
      {
        id: 'char_e2e_1',
        kind: 'character',
        name: '主角',
        description: 'E2E测试角色，青年男性，现代装扮',
        prompt: '',
        status: 'draft',
        episodeIndexes: [1],
      },
    ],
    scenes: [
      {
        id: 'scene_e2e_1',
        kind: 'scene',
        name: '城市街道',
        description: 'E2E测试场景，夜晚霓虹街道',
        prompt: '',
        status: 'draft',
        episodeIndexes: [1],
      },
    ],
    props: [],
    shots,
  }
}

async function ensureProjectLayout(projectDir) {
  for (const folder of PROJECT_LAYOUT_FOLDERS) {
    await fs.mkdir(joinRoot(projectDir, folder), { recursive: true })
  }
}

/** 空项目列表 · 用于 smoke 套件（仅验证壳层路由） */
export async function prepareMinimalE2eWorkspace() {
  return createE2eWorkspace({ prefix: 'haode-e2e-smoke-' })
}

/** 未绑定数据根 · 用于 Phase 5-B 空目录守卫 */
export async function prepareWorkshopMissingDataRootWorkspace() {
  return createEmptyLauncherWorkspace({ prefix: 'haode-workshop-no-root-' })
}

/** Step1 空剧本 · 用于导入文件 E2E */
export async function prepareWorkshopEmptyScriptWorkspace() {
  const now = Date.now()
  const meta = {
    id: E2E_PROJECT_ID,
    title: E2E_PROJECT_TITLE,
    description: 'Electron E2E 空剧本项目',
    currentStep: 1,
    createdAt: now,
    updatedAt: now,
  }

  const workspace = await createE2eWorkspace({
    prefix: 'haode-workshop-import-',
    projects: [meta],
    seedProject: {
      id: E2E_PROJECT_ID,
      meta,
      data: {
        script: '',
        currentStep: 1,
        projectStylePresetKey: 'style_realistic',
        episodes: [],
        characters: [],
        scenes: [],
        props: [],
        shots: [],
      },
    },
  })

  if (workspace.projectDir) {
    await ensureProjectLayout(workspace.projectDir)
  }

  return workspace
}

function buildScriptOnlyProjectData(now) {
  return {
    script: `${E2E_SCRIPT_SNIPPET}。主角在霓虹都市的街头徘徊，意外捡到一张旧照片，由此踏上寻找真相的旅程。`,
    currentStep: 1,
    projectStylePresetKey: 'style_realistic',
    episodes: [],
    characters: [],
    scenes: [],
    props: [],
    shots: [],
  }
}

/** 仅剧本 · 用于从零 AI 流水线（分集 → 资产 → 分镜） */
export async function prepareWorkshopScriptOnlyWorkspace() {
  const now = Date.now()
  const meta = {
    id: E2E_PROJECT_ID,
    title: E2E_PROJECT_TITLE,
    description: 'Electron E2E 剧本起点项目',
    currentStep: 1,
    createdAt: now,
    updatedAt: now,
  }

  const workspace = await createE2eWorkspace({
    prefix: 'haode-workshop-scratch-',
    projects: [meta],
    seedProject: {
      id: E2E_PROJECT_ID,
      meta,
      data: buildScriptOnlyProjectData(now),
    },
  })

  if (workspace.projectDir) {
    await ensureProjectLayout(workspace.projectDir)
  }

  return workspace
}

/** 预置完整工坊项目 · 用于 workshop-flow 套件 */
export async function prepareWorkshopE2eWorkspace() {
  const now = Date.now()
  const meta = {
    id: E2E_PROJECT_ID,
    title: E2E_PROJECT_TITLE,
    description: 'Electron E2E 预置项目',
    currentStep: 1,
    createdAt: now,
    updatedAt: now,
  }

  const workspace = await createE2eWorkspace({
    prefix: 'haode-workshop-e2e-',
    projects: [meta],
    seedProject: {
      id: E2E_PROJECT_ID,
      meta,
      data: buildProjectData(now),
    },
  })

  if (workspace.projectDir) {
    await ensureProjectLayout(workspace.projectDir)
  }

  return workspace
}

/** 预置单个画布项目 · 用于 Phase 6-B 列表 smoke */
export async function prepareCanvasListSmokeWorkspace() {
  const workspace = await prepareMinimalE2eWorkspace()
  const now = Date.now()
  const canvasRoot = joinRoot(workspace.dataRoot, 'canvas')
  const canvasProjectDir = joinRoot(canvasRoot, E2E_CANVAS_LIST_SMOKE_ID)
  await fs.mkdir(canvasProjectDir, { recursive: true })

  const canvasMeta = {
    id: E2E_CANVAS_LIST_SMOKE_ID,
    title: E2E_CANVAS_LIST_SMOKE_TITLE,
    description: E2E_CANVAS_LIST_SMOKE_DESC,
    createdAt: now,
    updatedAt: now,
  }
  await fs.writeFile(joinRoot(canvasRoot, 'projects.json'), JSON.stringify([canvasMeta], null, 2), 'utf-8')
  await fs.writeFile(
    joinRoot(canvasProjectDir, 'data.json'),
    JSON.stringify(
      {
        version: 1,
        nodes: [
          {
            id: 'prompt_list_smoke',
            type: 'prompt',
            position: { x: 0, y: 0 },
            data: { label: 'E2E 列表 smoke' },
          },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 0.75 },
      },
      null,
      2,
    ),
    'utf-8',
  )
  await fs.writeFile(joinRoot(canvasProjectDir, 'tasks.json'), '[]', 'utf-8')

  return workspace
}

/** 预置分镜成片视频 · 用于 Phase 6-A 剪映导出 */
export async function prepareWorkshopCapcutExportWorkspace() {
  const workspace = await prepareWorkshopE2eWorkspace()
  const dataPath = joinRoot(workspace.projectDir, 'data.json')
  const data = JSON.parse(await fs.readFile(dataPath, 'utf-8'))
  const shots = data.shots ?? []

  for (const shot of shots) {
    const rel = `videos/e2e_capcut_shot_${shot.shotNumber}.mp4`
    const abs = joinRoot(workspace.projectDir, rel)
    await fs.writeFile(abs, `e2e-mock-mp4-shot-${shot.shotNumber}`, 'utf-8')
    shot.generatedVideoPath = rel
    shot.generatedVideoPaths = [rel]
    shot.primaryGeneratedVideoIndex = 0
  }

  await fs.writeFile(dataPath, JSON.stringify({ ...data, shots }, null, 2), 'utf-8')
  return workspace
}

/** 预置画布成片视频 · 用于 Phase 6-A-b 画布侧剪映导出 */
export async function prepareCanvasCapcutExportWorkspace() {
  const workspace = await prepareMinimalE2eWorkspace()
  const now = Date.now()
  const canvasRoot = joinRoot(workspace.dataRoot, 'canvas')
  const canvasProjectDir = joinRoot(canvasRoot, E2E_CANVAS_CAPCUT_ID)
  await fs.mkdir(joinRoot(canvasProjectDir, 'assets/videos'), { recursive: true })

  const videoNodes = [1, 2].map((shotNumber) => {
    const rel = `assets/videos/e2e_canvas_capcut_${shotNumber}.mp4`
    return {
      id: `video_capcut_${shotNumber}`,
      type: 'storyVideo',
      position: { x: 400 * (shotNumber - 1), y: 200 },
      data: {
        label: `镜${shotNumber} 视频`,
        status: 'success',
        outputPath: rel,
        outputOwnerKind: 'canvas',
        outputOwnerProjectId: E2E_CANVAS_CAPCUT_ID,
        importShotId: E2E_SHOT_IDS[shotNumber - 1],
        importShotNumber: shotNumber,
        videoName: `镜${shotNumber} 视频`,
      },
    }
  })

  for (const node of videoNodes) {
    const rel = node.data.outputPath
    await fs.writeFile(joinRoot(canvasProjectDir, rel), `e2e-canvas-mock-mp4-${node.data.importShotNumber}`, 'utf-8')
  }

  const canvasMeta = {
    id: E2E_CANVAS_CAPCUT_ID,
    title: E2E_CANVAS_CAPCUT_TITLE,
    description: 'E2E 画布剪映导出',
    createdAt: now,
    updatedAt: now,
  }
  await fs.writeFile(joinRoot(canvasRoot, 'projects.json'), JSON.stringify([canvasMeta], null, 2), 'utf-8')
  await fs.writeFile(
    joinRoot(canvasProjectDir, 'data.json'),
    JSON.stringify(
      {
        version: 1,
        nodes: videoNodes,
        edges: [],
        viewport: { x: 0, y: 0, zoom: 0.75 },
      },
      null,
      2,
    ),
    'utf-8',
  )
  await fs.writeFile(joinRoot(canvasProjectDir, 'tasks.json'), '[]', 'utf-8')

  return workspace
}

/** 画布仅 prompt 节点 · 用于 Phase 6-A-d 无成片剪映拦截 */
export async function prepareCanvasCapcutNoClipsWorkspace() {
  const workspace = await prepareMinimalE2eWorkspace()
  const now = Date.now()
  const canvasRoot = joinRoot(workspace.dataRoot, 'canvas')
  const canvasProjectDir = joinRoot(canvasRoot, E2E_CANVAS_CAPCUT_ID)
  await fs.mkdir(canvasProjectDir, { recursive: true })

  const canvasMeta = {
    id: E2E_CANVAS_CAPCUT_ID,
    title: E2E_CANVAS_CAPCUT_TITLE,
    description: 'E2E 画布剪映无成片',
    createdAt: now,
    updatedAt: now,
  }
  await fs.writeFile(joinRoot(canvasRoot, 'projects.json'), JSON.stringify([canvasMeta], null, 2), 'utf-8')
  await fs.writeFile(
    joinRoot(canvasProjectDir, 'data.json'),
    JSON.stringify(
      {
        version: 1,
        nodes: [
          {
            id: 'prompt_capcut_no_clips',
            type: 'storyPrompt',
            position: { x: 0, y: 0 },
            data: { label: 'E2E 无视频分镜', prompt: 'E2E 无成片提示词' },
          },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 0.75 },
      },
      null,
      2,
    ),
    'utf-8',
  )
  await fs.writeFile(joinRoot(canvasProjectDir, 'tasks.json'), '[]', 'utf-8')

  return workspace
}

/** 轮询读取 E2E mock 剪映 marker（导出异步落盘） */
export async function waitForE2eCapcutExportMarker(launcherDir, minClipCount = 1, timeoutMs = 15_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const marker = await readE2eCapcutExportMarker(launcherDir)
    if (marker?.clipCount >= minClipCount) return marker
    await new Promise((r) => setTimeout(r, 100))
  }
  return readE2eCapcutExportMarker(launcherDir)
}

export function getE2eCapcutDraftsDir(launcherDir) {
  return joinRoot(launcherDir, E2E_CAPCUT_DRAFTS_DIR_NAME)
}

/** 读取 E2E mock 剪映导出 marker */
export async function readE2eCapcutExportMarker(launcherDir) {
  const draftsRoot = getE2eCapcutDraftsDir(launcherDir)
  let entries = []
  try {
    entries = await fs.readdir(draftsRoot, { withFileTypes: true })
  } catch {
    return null
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const markerPath = joinRoot(joinRoot(draftsRoot, entry.name), E2E_CAPCUT_MARKER_FILE)
    try {
      const raw = await fs.readFile(markerPath, 'utf-8')
      return JSON.parse(raw)
    } catch {
      /* try next */
    }
  }
  return null
}

export async function prepareWorkshopBatchVideoE2eWorkspace() {
  const workspace = await prepareWorkshopE2eWorkspace()
  const settingsPath = joinRoot(workspace.dataRoot, 'settings.json')
  const settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'))
  settings.lastUsedStoryboardVideoReferenceMode = 'text_to_video'
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
  return workspace
}

function buildMultiEpisodeProjectData(now) {
  const episode1 = {
    id: E2E_EPISODE_ID,
    episodeIndex: 1,
    title: '第 1 集',
    summary: 'E2E 测试分集一',
    content: E2E_EPISODE_1_SNIPPET,
    characters: [{ name: '主角', description: '青年，现代都市装扮' }],
    scenes: [{ name: '城市街道', description: '夜晚霓虹灯下的主干道' }],
    items: [],
  }
  const episode2 = {
    id: E2E_EPISODE_ID_2,
    episodeIndex: 2,
    title: '第 2 集',
    summary: 'E2E 测试分集二',
    content: E2E_EPISODE_2_SNIPPET,
    characters: [{ name: '配角', description: '神秘来客' }],
    scenes: [{ name: '旧仓库', description: '废弃工业区内' }],
    items: [],
  }

  const shots = [
    {
      id: 'shot_e2e_1',
      episodeId: E2E_EPISODE_ID,
      episodeIndex: 1,
      shotNumber: 1,
      dialogue: '镜头1集1',
      prompt: 'E2E测试镜头1集1',
      status: 'draft',
      updatedAt: now,
    },
    {
      id: 'shot_e2e_4',
      episodeId: E2E_EPISODE_ID_2,
      episodeIndex: 2,
      shotNumber: 1,
      dialogue: '镜头1集2',
      prompt: 'E2E测试镜头1集2',
      status: 'draft',
      updatedAt: now,
    },
  ]

  return {
    script: `${E2E_SCRIPT_SNIPPET}。${E2E_EPISODE_1_SNIPPET}。${E2E_EPISODE_2_SNIPPET}`,
    episodePlan: 'manual',
    currentStep: 2,
    projectStylePresetKey: 'style_realistic',
    episodes: [episode1, episode2],
    characters: [
      {
        id: 'char_e2e_1',
        kind: 'character',
        name: '主角',
        description: 'E2E测试角色',
        prompt: '',
        status: 'draft',
        episodeIndexes: [1],
      },
      {
        id: 'char_e2e_2',
        kind: 'character',
        name: '配角',
        description: 'E2E测试配角',
        prompt: '',
        status: 'draft',
        episodeIndexes: [2],
      },
    ],
    scenes: [
      {
        id: 'scene_e2e_1',
        kind: 'scene',
        name: '城市街道',
        description: 'E2E测试场景',
        prompt: '',
        status: 'draft',
        episodeIndexes: [1],
      },
      {
        id: 'scene_e2e_2',
        kind: 'scene',
        name: '旧仓库',
        description: 'E2E测试场景2',
        prompt: '',
        status: 'draft',
        episodeIndexes: [2],
      },
    ],
    props: [],
    shots,
  }
}

/** 双分集项目 · 用于多集 Tab 切换 E2E */
export async function prepareWorkshopMultiEpisodeWorkspace() {
  const now = Date.now()
  const meta = {
    id: E2E_PROJECT_ID,
    title: E2E_PROJECT_TITLE,
    description: 'Electron E2E 多集项目',
    currentStep: 2,
    createdAt: now,
    updatedAt: now,
  }

  const workspace = await createE2eWorkspace({
    prefix: 'haode-workshop-multi-ep-',
    projects: [meta],
    seedProject: {
      id: E2E_PROJECT_ID,
      meta,
      data: buildMultiEpisodeProjectData(now),
    },
  })

  if (workspace.projectDir) {
    await ensureProjectLayout(workspace.projectDir)
  }

  return workspace
}

function buildBootstrapEpisodePlanData(now) {
  const script = `${E2E_SCRIPT_SNIPPET}。Step2占位分集同步全文。`
  return {
    script,
    episodePlan: 'bootstrap',
    currentStep: 2,
    projectStylePresetKey: 'style_realistic',
    episodes: [
      {
        id: E2E_EPISODE_ID,
        episodeIndex: 1,
        title: '第 1 集',
        summary: '',
        content: script,
        characters: [],
        scenes: [],
        items: [],
      },
    ],
    characters: [],
    scenes: [],
    props: [],
    shots: [],
  }
}

/** bootstrap 单集 · Step2 编辑保真 / dirty 保存 E2E */
export async function prepareWorkshopBootstrapEpisodeWorkspace() {
  const now = Date.now()
  const meta = {
    id: E2E_PROJECT_ID,
    title: E2E_PROJECT_TITLE,
    description: 'Electron E2E bootstrap 分集',
    currentStep: 2,
    createdAt: now,
    updatedAt: now,
  }

  const workspace = await createE2eWorkspace({
    prefix: 'haode-workshop-bootstrap-ep-',
    projects: [meta],
    seedProject: {
      id: E2E_PROJECT_ID,
      meta,
      data: buildBootstrapEpisodePlanData(now),
    },
  })

  if (workspace.projectDir) {
    await ensureProjectLayout(workspace.projectDir)
  }

  return workspace
}

function buildListPageProjectData(now) {
  return {
    script: '',
    currentStep: 1,
    projectStylePresetKey: 'style_realistic',
    episodes: [],
    characters: [],
    scenes: [],
    props: [],
    shots: [],
    updatedAt: now,
  }
}

function buildListPageProjectMetas(now) {
  const metas = [
    {
      id: E2E_LIST_ALPHA_ID,
      title: E2E_LIST_ALPHA_TITLE,
      description: 'Alpha 列表搜索测试',
      currentStep: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: E2E_LIST_BETA_ID,
      title: E2E_LIST_BETA_TITLE,
      description: E2E_LIST_BETA_DESC,
      currentStep: 1,
      createdAt: now,
      updatedAt: now,
    },
  ]

  const fillerCount = E2E_LIST_PROJECT_COUNT - metas.length
  for (let index = 1; index <= fillerCount; index += 1) {
    const suffix = String(index).padStart(2, '0')
    metas.push({
      id: `wf_e2e_list_page_${suffix}`,
      title: `E2E分页项目${suffix}`,
      description: `分页测试第 ${index} 个项目`,
      currentStep: 1,
      createdAt: now + index,
      updatedAt: now + index,
    })
  }

  return metas
}

/** 预置 17 个项目 · 用于列表搜索 / 分页 E2E */
export async function prepareWorkshopProjectListWorkspace() {
  const now = Date.now()
  const metas = buildListPageProjectMetas(now)
  const workspace = await createE2eWorkspace({
    prefix: 'haode-workshop-list-',
    projects: metas,
  })

  const data = buildListPageProjectData(now)
  for (const meta of metas) {
    const projectDir = joinRoot(workspace.workflowDir, meta.id)
    await fs.mkdir(projectDir, { recursive: true })
    await fs.writeFile(joinRoot(projectDir, 'data.json'), JSON.stringify(data, null, 2), 'utf-8')
    await fs.writeFile(joinRoot(projectDir, 'tasks.json'), '[]', 'utf-8')
    await ensureProjectLayout(projectDir)
  }

  return workspace
}

export async function readProjectsList(workflowDir) {
  try {
    const raw = await fs.readFile(joinRoot(workflowDir, 'projects.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function readProjectTasks(projectDir) {
  try {
    const raw = await fs.readFile(joinRoot(projectDir, 'tasks.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function readProjectData(projectDir) {
  try {
    const raw = await fs.readFile(joinRoot(projectDir, 'data.json'), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function readCanvasProjectsList(dataRoot) {
  try {
    const raw = await fs.readFile(joinRoot(dataRoot, 'canvas/projects.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function readCanvasProjectData(dataRoot, canvasProjectId) {
  try {
    const raw = await fs.readFile(
      joinRoot(dataRoot, `canvas/${canvasProjectId}/data.json`),
      'utf-8',
    )
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** 等待 tasks.json 中满足条件的任务数达到 minCount */
export async function waitForProjectTasks(projectDir, predicate, minCount, timeoutMs = 30_000) {
  const started = Date.now()
  let last = 0
  while (Date.now() - started < timeoutMs) {
    const tasks = await readProjectTasks(projectDir)
    last = tasks.filter(predicate).length
    if (last >= minCount) return last
    await new Promise((r) => setTimeout(r, 200))
  }
  return last
}

/** 等待 tasks.json 中首个满足条件的任务 id */
export async function waitForProjectTaskId(projectDir, predicate, timeoutMs = 30_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const tasks = await readProjectTasks(projectDir)
    const matched = tasks.find(predicate)
    if (matched?.id) return matched.id
    await new Promise((r) => setTimeout(r, 200))
  }
  return null
}

/** 等待新任务 id（排除已知 id，避免复用上一轮 completed 记录） */
export async function waitForNewProjectTaskId(
  projectDir,
  predicate,
  excludeIds = [],
  timeoutMs = 30_000,
) {
  const exclude = new Set(excludeIds.filter(Boolean))
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const tasks = await readProjectTasks(projectDir)
    const matched = tasks.find((task) => predicate(task) && !exclude.has(task.id))
    if (matched?.id) return matched.id
    await new Promise((r) => setTimeout(r, 200))
  }
  return null
}

/** 等待 data.json 中 status=done 的资产数量 */
export async function waitForProjectAssetsDone(projectDir, minCount, timeoutMs = 60_000) {
  const started = Date.now()
  let last = 0
  while (Date.now() - started < timeoutMs) {
    const data = await readProjectData(projectDir)
    const assets = [
      ...(data?.characters ?? []),
      ...(data?.scenes ?? []),
      ...(data?.props ?? []),
    ]
    last = assets.filter((item) => item.status === 'done').length
    if (last >= minCount) return last
    await new Promise((r) => setTimeout(r, 300))
  }
  return last
}
