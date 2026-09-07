/**
 * 画布模块 Electron E2E · 预置项目与读盘工具
 */
import fs from 'node:fs/promises'
import { joinRoot } from './e2e-workspace.mjs'
import {
  E2E_CANVAS_CAPCUT_ID,
  E2E_CANVAS_CAPCUT_TITLE,
  E2E_CANVAS_LIST_SMOKE_DESC,
  E2E_CANVAS_LIST_SMOKE_ID,
  E2E_CANVAS_LIST_SMOKE_TITLE,
  prepareMinimalE2eWorkspace,
  readCanvasProjectData,
  readCanvasProjectsList,
} from './workshop-e2e-fixtures.mjs'

export {
  E2E_CANVAS_CAPCUT_ID,
  E2E_CANVAS_CAPCUT_TITLE,
  E2E_CANVAS_LIST_SMOKE_DESC,
  E2E_CANVAS_LIST_SMOKE_ID,
  E2E_CANVAS_LIST_SMOKE_TITLE,
  readCanvasProjectData,
  readCanvasProjectsList,
}

export const E2E_CANVAS_CREATE_TITLE = 'E2E新建画布测试'

export const E2E_CANVAS_LIFECYCLE_ID = 'cv_e2e_lifecycle'
export const E2E_CANVAS_LIFECYCLE_TITLE = 'E2E画布生命周期'

export const E2E_CANVAS_EDITOR_ID = 'cv_e2e_editor'
export const E2E_CANVAS_EDITOR_TITLE = 'E2E画布编辑器测试'

export const E2E_CANVAS_RESTART_ID = 'cv_e2e_restart'
export const E2E_CANVAS_RESTART_TITLE = 'E2E画布重启持久化'
export const E2E_CANVAS_RESTART_SEED_NODE_ID = 'prompt_restart_seed'

export const E2E_CANVAS_IMAGE_GEN_ID = 'cv_e2e_image_gen'
export const E2E_CANVAS_IMAGE_GEN_TITLE = 'E2E画布生图测试'
export const E2E_CANVAS_IMAGE_NODE_ID = 'image_e2e_gen'

export const E2E_CANVAS_PROMPT_AI_CANCEL_ID = 'cv_e2e_prompt_ai_cancel'
export const E2E_CANVAS_PROMPT_AI_CANCEL_TITLE = 'E2E画布智能分镜取消'
export const E2E_CANVAS_PROMPT_AI_NODE_ID = 'prompt_e2e_storyboard_cancel'

export const E2E_CANVAS_PROMPT_EXTRACT_CANCEL_ID = 'cv_e2e_prompt_extract_cancel'
export const E2E_CANVAS_PROMPT_EXTRACT_CANCEL_TITLE = 'E2E画布提取资产取消'
export const E2E_CANVAS_PROMPT_EXTRACT_NODE_ID = 'prompt_e2e_extract_cancel'

export const E2E_CANVAS_AGENT_ID = 'cv_e2e_agent'
export const E2E_CANVAS_AGENT_TITLE = 'E2E画布助手测试'

export const E2E_CANVAS_VIDEO_GEN_ID = 'cv_e2e_video_gen'
export const E2E_CANVAS_VIDEO_GEN_TITLE = 'E2E画布生视频测试'
export const E2E_CANVAS_VIDEO_NODE_ID = 'video_e2e_gen'

export const E2E_CANVAS_MOCK_FAIL_ID = 'cv_e2e_mock_fail'
export const E2E_CANVAS_MOCK_FAIL_TITLE = 'E2E画布mock失败'

async function writeEmptyCanvasProject(dataRoot, meta) {
  await writeCanvasProjectWithData(dataRoot, meta, {
    version: 1,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 0.75 },
  })
}

async function writeCanvasProjectWithData(dataRoot, meta, canvasData) {
  const canvasRoot = joinRoot(dataRoot, 'canvas')
  const projectDir = joinRoot(canvasRoot, meta.id)
  await fs.mkdir(projectDir, { recursive: true })

  const projects = await readCanvasProjectsList(dataRoot)
  const nextProjects = projects.filter((item) => item?.id !== meta.id)
  nextProjects.push(meta)
  await fs.writeFile(joinRoot(canvasRoot, 'projects.json'), JSON.stringify(nextProjects, null, 2), 'utf-8')

  await fs.writeFile(joinRoot(projectDir, 'data.json'), JSON.stringify(canvasData, null, 2), 'utf-8')
  await fs.writeFile(joinRoot(projectDir, 'tasks.json'), '[]', 'utf-8')
}

function buildVideoGenerateCanvasData() {
  return {
    version: 1,
    nodes: [
      {
        id: E2E_CANVAS_VIDEO_NODE_ID,
        type: 'storyVideo',
        position: { x: 180, y: 120 },
        data: {
          label: 'E2E生视频节点',
          prompt: 'E2E测试画布生视频：城市夜景车流，电影感镜头',
          referenceMode: 'text_to_video',
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 0.85 },
  }
}

function buildImageGenerateCanvasData() {
  return {
    version: 1,
    nodes: [
      {
        id: E2E_CANVAS_IMAGE_NODE_ID,
        type: 'imageNode',
        position: { x: 160, y: 120 },
        data: {
          label: 'E2E生图节点',
          prompt: 'E2E测试画布生图：主角站在城市街道，电影感构图',
          assetRole: 'character',
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 0.85 },
  }
}

/** 预置单个画布项目 · 生命周期 / 列表 smoke 复用 */
export async function prepareCanvasLifecycleWorkspace() {
  const workspace = await prepareMinimalE2eWorkspace()
  const now = Date.now()
  await writeEmptyCanvasProject(workspace.dataRoot, {
    id: E2E_CANVAS_LIFECYCLE_ID,
    title: E2E_CANVAS_LIFECYCLE_TITLE,
    description: 'E2E画布生命周期描述',
    createdAt: now,
    updatedAt: now,
  })
  return workspace
}

/** 预置空画布项目 · 编辑器添加节点 flow */
export async function prepareCanvasEditorFlowWorkspace() {
  const workspace = await prepareMinimalE2eWorkspace()
  const now = Date.now()
  await writeEmptyCanvasProject(workspace.dataRoot, {
    id: E2E_CANVAS_EDITOR_ID,
    title: E2E_CANVAS_EDITOR_TITLE,
    description: 'E2E画布编辑器 flow',
    createdAt: now,
    updatedAt: now,
  })
  return workspace
}

/** 预置带 seed 节点的画布 · 重启持久化 */
export async function prepareCanvasRestartWorkspace() {
  const workspace = await prepareMinimalE2eWorkspace()
  const now = Date.now()
  const canvasRoot = joinRoot(workspace.dataRoot, 'canvas')
  const projectDir = joinRoot(canvasRoot, E2E_CANVAS_RESTART_ID)
  await fs.mkdir(projectDir, { recursive: true })

  const meta = {
    id: E2E_CANVAS_RESTART_ID,
    title: E2E_CANVAS_RESTART_TITLE,
    description: 'E2E画布重启持久化',
    createdAt: now,
    updatedAt: now,
  }
  await fs.writeFile(joinRoot(canvasRoot, 'projects.json'), JSON.stringify([meta], null, 2), 'utf-8')
  await fs.writeFile(
    joinRoot(projectDir, 'data.json'),
    JSON.stringify(
      {
        version: 1,
        nodes: [
          {
            id: E2E_CANVAS_RESTART_SEED_NODE_ID,
            type: 'shotPrompt',
            position: { x: 120, y: 80 },
            data: { label: '重启种子节点', prompt: 'E2E重启持久化种子' },
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
  await fs.writeFile(joinRoot(projectDir, 'tasks.json'), '[]', 'utf-8')
  return workspace
}

/** 预置图片节点 · mock 生图 */
export async function prepareCanvasImageGenerateWorkspace() {
  const workspace = await prepareMinimalE2eWorkspace()
  const now = Date.now()
  await writeCanvasProjectWithData(
    workspace.dataRoot,
    {
      id: E2E_CANVAS_IMAGE_GEN_ID,
      title: E2E_CANVAS_IMAGE_GEN_TITLE,
      description: 'E2E画布 mock 生图',
      createdAt: now,
      updatedAt: now,
    },
    buildImageGenerateCanvasData(),
  )
  return workspace
}

/** 预置图片节点 · 停止 mock 生图（与 image-generate 共用数据） */
export async function prepareCanvasGenerationStopWorkspace() {
  return prepareCanvasImageGenerateWorkspace()
}

/** 预置文本节点 · 取消 mock 智能分镜（F1） */
export async function prepareCanvasPromptAiCancelWorkspace() {
  const workspace = await prepareMinimalE2eWorkspace()
  const now = Date.now()
  await writeCanvasProjectWithData(
    workspace.dataRoot,
    {
      id: E2E_CANVAS_PROMPT_AI_CANCEL_ID,
      title: E2E_CANVAS_PROMPT_AI_CANCEL_TITLE,
      description: 'E2E画布智能分镜取消',
      createdAt: now,
      updatedAt: now,
    },
    {
      version: 1,
      nodes: [
        {
          id: E2E_CANVAS_PROMPT_AI_NODE_ID,
          type: 'shotPrompt',
          position: { x: 120, y: 80 },
          data: {
            label: 'E2E分镜取消文本',
            prompt:
              '主角走在干旱的村里，迎面遇到老季头。媳妇从屋里走出，二人低声争执。干燥的房间里摆着旧木桌。',
          },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 0.85 },
    },
  )
  return workspace
}

/** 预置文本节点 · 取消 mock 提取资产后再跑智能分镜（F3） */
export async function prepareCanvasPromptExtractCancelWorkspace() {
  const workspace = await prepareMinimalE2eWorkspace()
  const now = Date.now()
  await writeCanvasProjectWithData(
    workspace.dataRoot,
    {
      id: E2E_CANVAS_PROMPT_EXTRACT_CANCEL_ID,
      title: E2E_CANVAS_PROMPT_EXTRACT_CANCEL_TITLE,
      description: 'E2E画布提取资产取消',
      createdAt: now,
      updatedAt: now,
    },
    {
      version: 1,
      nodes: [
        {
          id: E2E_CANVAS_PROMPT_EXTRACT_NODE_ID,
          type: 'shotPrompt',
          position: { x: 120, y: 80 },
          data: {
            label: 'E2E提取取消文本',
            prompt:
              '主角走在干旱的村里，迎面遇到老季头。媳妇从屋里走出，二人低声争执。干燥的房间里摆着旧木桌。',
          },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 0.85 },
    },
  )
  return workspace
}

/** 预置视频节点 · mock 生视频 */
export async function prepareCanvasVideoGenerateWorkspace() {
  const workspace = await prepareMinimalE2eWorkspace()
  const now = Date.now()
  await writeCanvasProjectWithData(
    workspace.dataRoot,
    {
      id: E2E_CANVAS_VIDEO_GEN_ID,
      title: E2E_CANVAS_VIDEO_GEN_TITLE,
      description: 'E2E画布 mock 生视频',
      createdAt: now,
      updatedAt: now,
    },
    buildVideoGenerateCanvasData(),
  )
  return workspace
}

/** 预置图片节点 · mock 生图失败（与 image-generate 共用数据） */
export async function prepareCanvasMockFailureWorkspace() {
  const workspace = await prepareMinimalE2eWorkspace()
  const now = Date.now()
  await writeCanvasProjectWithData(
    workspace.dataRoot,
    {
      id: E2E_CANVAS_MOCK_FAIL_ID,
      title: E2E_CANVAS_MOCK_FAIL_TITLE,
      description: 'E2E画布 mock 生图失败',
      createdAt: now,
      updatedAt: now,
    },
    buildImageGenerateCanvasData(),
  )
  return workspace
}

/** 预置空项目 · Agent 侧栏 smoke / 对话 mock */
export async function prepareCanvasAgentSmokeWorkspace() {
  const workspace = await prepareMinimalE2eWorkspace()
  const now = Date.now()
  await writeCanvasProjectWithData(
    workspace.dataRoot,
    {
      id: E2E_CANVAS_AGENT_ID,
      title: E2E_CANVAS_AGENT_TITLE,
      description: 'E2E画布助手 smoke',
      createdAt: now,
      updatedAt: now,
    },
    buildImageGenerateCanvasData(),
  )
  return workspace
}

/** 等待指定视频节点 success + outputPath */
export async function waitForCanvasVideoNodeSuccess(
  dataRoot,
  projectId,
  nodeId,
  timeoutMs = 45_000,
) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const data = await readCanvasProjectData(dataRoot, projectId)
    const node = (data?.nodes ?? []).find((item) => item?.id === nodeId)
    const outputPath = String(node?.data?.outputPath || '').trim()
    const status = node?.data?.status
    if (
      outputPath &&
      (status === 'success' || outputPath.startsWith('preview:video:'))
    ) {
      return node
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}

/** 等待指定图片节点 success + outputPath */
export async function waitForCanvasImageNodeSuccess(
  dataRoot,
  projectId,
  nodeId,
  timeoutMs = 30_000,
) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const data = await readCanvasProjectData(dataRoot, projectId)
    const node = (data?.nodes ?? []).find((item) => item?.id === nodeId)
    if (node?.data?.status === 'success' && node?.data?.outputPath) {
      return node
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}

/** 等待 data.json 节点数达到 minCount */
export async function waitForCanvasNodeCount(dataRoot, projectId, minCount, timeoutMs = 20_000) {
  const started = Date.now()
  let last = 0
  while (Date.now() - started < timeoutMs) {
    const data = await readCanvasProjectData(dataRoot, projectId)
    last = Array.isArray(data?.nodes) ? data.nodes.length : 0
    if (last >= minCount) return last
    await new Promise((r) => setTimeout(r, 250))
  }
  return last
}

export const E2E_CANVAS_IMAGE_EDIT_ID = 'cv_e2e_image_edit'
export const E2E_CANVAS_IMAGE_EDIT_TITLE = 'E2E画布图片编辑'
export const E2E_CANVAS_IMAGE_EDIT_NODE_ID = 'image_e2e_edit'
export const E2E_CANVAS_IMAGE_EDIT_SEED_PATH = 'assets/images/e2e_seed_edit.png'

const E2E_MINI_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function buildImageEditCanvasData(outputPath) {
  return {
    version: 1,
    nodes: [
      {
        id: E2E_CANVAS_IMAGE_EDIT_NODE_ID,
        type: 'imageNode',
        position: { x: 160, y: 120 },
        data: {
          label: 'E2E编辑图片节点',
          prompt: 'E2E测试画布图片编辑',
          assetRole: 'character',
          status: 'success',
          outputPath,
          outputOwnerKind: 'canvas',
          outputOwnerProjectId: E2E_CANVAS_IMAGE_EDIT_ID,
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 0.85 },
  }
}

/** 预置带 seed 图片的图片节点 · 就地编辑 */
export async function prepareCanvasImageEditWorkspace() {
  const workspace = await prepareMinimalE2eWorkspace()
  const now = Date.now()
  const canvasRoot = joinRoot(workspace.dataRoot, 'canvas')
  const projectDir = joinRoot(canvasRoot, E2E_CANVAS_IMAGE_EDIT_ID)
  const rel = E2E_CANVAS_IMAGE_EDIT_SEED_PATH
  await fs.mkdir(joinRoot(projectDir, 'assets/images'), { recursive: true })
  await fs.writeFile(joinRoot(projectDir, rel), Buffer.from(E2E_MINI_PNG_BASE64, 'base64'))

  await writeCanvasProjectWithData(
    workspace.dataRoot,
    {
      id: E2E_CANVAS_IMAGE_EDIT_ID,
      title: E2E_CANVAS_IMAGE_EDIT_TITLE,
      description: 'E2E画布图片就地编辑',
      createdAt: now,
      updatedAt: now,
    },
    buildImageEditCanvasData(rel),
  )
  return workspace
}

/** 等待图片节点 outputPath 从 seed 更新为 edit_ 前缀 */
export async function waitForCanvasImageEditSaved(
  dataRoot,
  projectId,
  nodeId,
  previousPath,
  timeoutMs = 30_000,
) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const data = await readCanvasProjectData(dataRoot, projectId)
    const node = (data?.nodes ?? []).find((item) => item?.id === nodeId)
    const outputPath = String(node?.data?.outputPath || '').trim()
    if (
      outputPath &&
      outputPath !== previousPath &&
      /edit_[^/]+\.png$/i.test(outputPath.split('/').pop() || '')
    ) {
      return node
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}

export const E2E_CANVAS_MAT_SAVE_ID = 'cv_e2e_mat_save'
export const E2E_CANVAS_MAT_SAVE_TITLE = 'E2E画布素材库保存'
export const E2E_CANVAS_MAT_SAVE_NODE_ID = 'image_e2e_mat_save'
export const E2E_CANVAS_MAT_SAVE_SEED_PATH = 'assets/images/e2e_seed_mat_save.png'
/** 节点 data.imageName（昵称，不含类型前缀） */
export const E2E_CANVAS_MAT_SAVE_IMAGE_NAME = 'E2E画布素材角色'
/** 保存/更新 toast 与 materials.json name（与 resolveCanvasImageDisplayName label 一致） */
export const E2E_CANVAS_MAT_SAVE_SYNC_LABEL = `人物 ${E2E_CANVAS_MAT_SAVE_IMAGE_NAME}`

function buildCanvasImageMaterialSaveData(outputPath) {
  return {
    version: 1,
    nodes: [
      {
        id: E2E_CANVAS_MAT_SAVE_NODE_ID,
        type: 'imageNode',
        position: { x: 160, y: 120 },
        data: {
          label: 'E2E素材库保存节点',
          prompt: 'E2E测试画布保存到素材库',
          assetRole: 'character',
          assetRoleConverted: true,
          imageName: E2E_CANVAS_MAT_SAVE_IMAGE_NAME,
          status: 'success',
          outputPath,
          outputOwnerKind: 'canvas',
          outputOwnerProjectId: E2E_CANVAS_MAT_SAVE_ID,
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 0.85 },
  }
}

/** 预置已标记角色且带图片的图片节点 · 保存/更新到素材库 */
export async function prepareCanvasImageMaterialSaveWorkspace() {
  const workspace = await prepareMinimalE2eWorkspace()
  const now = Date.now()
  const canvasRoot = joinRoot(workspace.dataRoot, 'canvas')
  const projectDir = joinRoot(canvasRoot, E2E_CANVAS_MAT_SAVE_ID)
  const rel = E2E_CANVAS_MAT_SAVE_SEED_PATH
  await fs.mkdir(joinRoot(projectDir, 'assets/images'), { recursive: true })
  await fs.writeFile(joinRoot(projectDir, rel), Buffer.from(E2E_MINI_PNG_BASE64, 'base64'))
  await fs.writeFile(
    joinRoot(workspace.dataRoot, 'materials.json'),
    JSON.stringify({ characters: [], scenes: [], props: [] }, null, 2),
    'utf-8',
  )

  await writeCanvasProjectWithData(
    workspace.dataRoot,
    {
      id: E2E_CANVAS_MAT_SAVE_ID,
      title: E2E_CANVAS_MAT_SAVE_TITLE,
      description: 'E2E画布保存到素材库',
      createdAt: now,
      updatedAt: now,
    },
    buildCanvasImageMaterialSaveData(rel),
  )
  return workspace
}

export async function readMaterialsIndex(dataRoot) {
  try {
    const raw = await fs.readFile(joinRoot(dataRoot, 'materials.json'), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { characters: [], scenes: [], props: [] }
  }
}

export function buildCanvasMaterialSourceAssetId(nodeId) {
  return `canvas_asset_${nodeId}`
}

export async function waitForMaterialsCanvasEntry(
  dataRoot,
  projectId,
  nodeId,
  timeoutMs = 15_000,
) {
  const sourceAssetId = buildCanvasMaterialSourceAssetId(nodeId)
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const index = await readMaterialsIndex(dataRoot)
    const entry = (index.characters ?? []).find(
      (item) => item.sourceProjectId === projectId && item.sourceAssetId === sourceAssetId,
    )
    if (entry) return entry
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}
