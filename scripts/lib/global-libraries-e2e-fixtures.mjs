/**
 * 全局素材库 / 音色库 E2E 预置数据
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { joinRoot } from './e2e-workspace.mjs'
import { readMaterialsIndex } from './canvas-e2e-fixtures.mjs'
import {
  E2E_PROJECT_ID,
  E2E_SHOT_IDS,
  prepareWorkshopE2eWorkspace,
} from './workshop-e2e-fixtures.mjs'
import { createE2eWorkspace } from './e2e-workspace.mjs'

/** 1x1 PNG */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** 最小合法 WAV（44 字节头 + 静音） */
const TINY_WAV = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
  0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00,
  0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00,
])

export const E2E_GLOBAL_MAT_PROJECT_ID = 'wf_e2e_global_lib'
export const E2E_GLOBAL_MAT_VALID_ID = 'lib_e2e_valid'
export const E2E_GLOBAL_MAT_BROKEN_ID = 'lib_e2e_broken'
export const E2E_GLOBAL_MAT_VALID_IMAGE_REL = 'pictures/e2e_global_valid.png'
export const E2E_GLOBAL_MAT_BROKEN_IMAGE_REL = 'pictures/e2e_global_missing.png'
export const E2E_LEGACY_VOICE_ID = 'voice_e2e_legacy'
export const E2E_LEGACY_VOICE_NAME = 'E2E遗留音色'
export const E2E_LEGACY_VOICE_PROJECT_ID = 'wf_e2e_legacy_voice'

export const E2E_IMPORT_MAT_ENTRY_ID = 'lib_e2e_step3_import'
export const E2E_IMPORT_MAT_NAME = 'E2E可导入角色'
export const E2E_IMPORT_SOURCE_PROJECT_ID = 'wf_e2e_import_source'
export const E2E_IMPORT_SOURCE_IMAGE_REL = 'pictures/e2e_import_source.png'

export const E2E_STEP3_SYNC_CHAR_ID = 'char_e2e_1'
export const E2E_STEP3_SYNC_CHAR_NAME = '主角'
export const E2E_STEP3_SYNC_IMAGE_REL = 'pictures/char_e2e_1_e2e.png'

export const E2E_STEP4_REF_MAT_ENTRY_ID = 'lib_e2e_step4_ref'
export const E2E_STEP4_REF_MAT_NAME = 'E2E参考图素材'
export const E2E_STEP4_REF_SOURCE_PROJECT_ID = 'wf_e2e_ref_source'
export const E2E_STEP4_REF_SOURCE_IMAGE_REL = 'pictures/e2e_ref_source.png'

export const E2E_SOFT_DELETE_MAT_PROJECT_ID = 'wf_e2e_soft_deleted'
export const E2E_SOFT_DELETE_MAT_ENTRY_ID = 'lib_e2e_soft_deleted'

export async function assertMaterialEntryProjectMedia(dataRoot, entry, assert) {
  const rel = String(entry?.generatedImagePath || '').replace(/\\/g, '/')
  assert(Boolean(rel), '素材库条目缺少 generatedImagePath')
  assert(!/^[a-z]:/i.test(rel), `应为项目相对路径，实际: ${rel}`)
  assert(!/^assets\/lib_/i.test(rel), `不应使用全局副本路径: ${rel}`)

  const sourceProjectId = String(entry?.sourceProjectId || '').trim()
  assert(Boolean(sourceProjectId), '素材库条目缺少 sourceProjectId')

  const workflowRoot = joinRoot(dataRoot, 'workflow')
  const canvasRoot = joinRoot(dataRoot, 'canvas')
  let projectDir = joinRoot(workflowRoot, sourceProjectId)
  try {
    await fs.access(projectDir)
  } catch {
    projectDir = joinRoot(canvasRoot, sourceProjectId)
  }

  const absPath = joinRoot(projectDir, rel.replace(/\//g, path.sep))
  try {
    await fs.access(absPath)
  } catch {
    assert(false, `来源项目内图片不存在: ${absPath}`)
  }
}

async function appendWorkflowSourceProject(workspace, options) {
  const { projectId, title, imageRelPath } = options
  const workflowRoot = joinRoot(workspace.dataRoot, 'workflow')
  const projectsPath = joinRoot(workflowRoot, 'projects.json')
  const projects = JSON.parse(await fs.readFile(projectsPath, 'utf-8'))
  const now = Date.now()
  const meta = {
    id: projectId,
    title,
    description: 'E2E索引来源项目',
    currentStep: 1,
    createdAt: now,
    updatedAt: now,
    ...(options.deletedAt ? { deletedAt: options.deletedAt } : {}),
  }
  if (!projects.some((item) => item?.id === projectId)) {
    projects.push(meta)
    await fs.writeFile(projectsPath, JSON.stringify(projects, null, 2), 'utf-8')
  }

  const sourceDir = joinRoot(workflowRoot, projectId)
  await fs.mkdir(sourceDir, { recursive: true })
  await fs.writeFile(joinRoot(sourceDir, 'tasks.json'), '[]', 'utf-8')
  await fs.writeFile(
    joinRoot(sourceDir, 'data.json'),
    JSON.stringify(
      {
        script: '',
        currentStep: 1,
        projectStylePresetKey: 'style_realistic',
        episodes: [],
        characters: [],
        scenes: [],
        props: [],
        shots: [],
      },
      null,
      2,
    ),
    'utf-8',
  )

  if (imageRelPath) {
    const imageAbs = joinRoot(sourceDir, imageRelPath.replace(/\//g, path.sep))
    await fs.mkdir(path.dirname(imageAbs), { recursive: true })
    await fs.writeFile(imageAbs, TINY_PNG)
  }
}

export async function waitForMaterialsWorkflowEntry(
  dataRoot,
  projectId,
  sourceAssetId,
  kind = 'characters',
  timeoutMs = 15_000,
) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const index = await readMaterialsIndex(dataRoot)
    const list = index[kind] ?? []
    const entry = list.find(
      (item) => item.sourceProjectId === projectId && item.sourceAssetId === sourceAssetId,
    )
    if (entry) return entry
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}

async function seedWorkshopCharacterGeneratedImage(workspace, charId, relPath) {
  const absPath = joinRoot(workspace.projectDir, relPath.replace(/\//g, path.sep))
  await fs.mkdir(path.dirname(absPath), { recursive: true })
  await fs.writeFile(absPath, TINY_PNG)

  const dataPath = joinRoot(workspace.projectDir, 'data.json')
  const data = JSON.parse(await fs.readFile(dataPath, 'utf-8'))
  const charIndex = (data.characters ?? []).findIndex((item) => item.id === charId)
  if (charIndex < 0) throw new Error(`fixture 缺少角色 ${charId}`)
  data.characters[charIndex] = {
    ...data.characters[charIndex],
    generatedImagePath: relPath,
    generatedImagePaths: [relPath],
    primaryGeneratedImageIndex: 0,
    status: 'done',
  }
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8')
}

export async function prepareWorkshopStep3MaterialSaveWorkspace() {
  const workspace = await prepareWorkshopE2eWorkspace()
  await seedWorkshopCharacterGeneratedImage(
    workspace,
    E2E_STEP3_SYNC_CHAR_ID,
    E2E_STEP3_SYNC_IMAGE_REL,
  )
  await fs.writeFile(
    joinRoot(workspace.dataRoot, 'materials.json'),
    JSON.stringify({ characters: [], scenes: [], props: [] }, null, 2),
    'utf-8',
  )
  return workspace
}

export async function prepareWorkshopStep4MaterialReferenceWorkspace() {
  const workspace = await prepareWorkshopE2eWorkspace()
  const { dataRoot } = workspace
  const now = Date.now()

  await appendWorkflowSourceProject(workspace, {
    projectId: E2E_STEP4_REF_SOURCE_PROJECT_ID,
    title: 'E2E参考图来源',
    imageRelPath: E2E_STEP4_REF_SOURCE_IMAGE_REL,
  })

  const materialsIndex = {
    characters: [
      {
        id: E2E_STEP4_REF_MAT_ENTRY_ID,
        kind: 'character',
        name: E2E_STEP4_REF_MAT_NAME,
        description: 'E2E Step4 参考图素材库测试',
        prompt: '',
        status: 'ready',
        generatedImagePath: E2E_STEP4_REF_SOURCE_IMAGE_REL,
        generatedImagePaths: [E2E_STEP4_REF_SOURCE_IMAGE_REL],
        primaryGeneratedImageIndex: 0,
        sourceProjectId: E2E_STEP4_REF_SOURCE_PROJECT_ID,
        sourceProjectTitle: 'E2E参考图来源',
        sourceAssetId: 'char_e2e_ref_source',
        syncedAt: now,
        updatedAt: now,
      },
    ],
    scenes: [],
    props: [],
  }
  await fs.writeFile(joinRoot(dataRoot, 'materials.json'), JSON.stringify(materialsIndex, null, 2), 'utf-8')

  const dataPath = joinRoot(workspace.projectDir, 'data.json')
  const data = JSON.parse(await fs.readFile(dataPath, 'utf-8'))
  const shot = (data.shots ?? []).find((item) => item.id === E2E_SHOT_IDS[0])
  if (shot) {
    delete shot.referenceImagePath
    delete shot.referenceImagePaths
  }
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8')

  return workspace
}

export async function prepareWorkshopStep3MaterialImportWorkspace() {
  const workspace = await prepareWorkshopE2eWorkspace()
  const { dataRoot } = workspace
  const now = Date.now()

  await appendWorkflowSourceProject(workspace, {
    projectId: E2E_IMPORT_SOURCE_PROJECT_ID,
    title: 'E2E导入来源项目',
    imageRelPath: E2E_IMPORT_SOURCE_IMAGE_REL,
  })

  const materialsIndex = {
    characters: [
      {
        id: E2E_IMPORT_MAT_ENTRY_ID,
        kind: 'character',
        name: E2E_IMPORT_MAT_NAME,
        description: 'E2E Step3 素材库导入测试',
        prompt: 'E2E import prompt',
        status: 'ready',
        generatedImagePath: E2E_IMPORT_SOURCE_IMAGE_REL,
        generatedImagePaths: [E2E_IMPORT_SOURCE_IMAGE_REL],
        primaryGeneratedImageIndex: 0,
        sourceProjectId: E2E_IMPORT_SOURCE_PROJECT_ID,
        sourceProjectTitle: 'E2E导入来源项目',
        sourceAssetId: 'char_e2e_import_source',
        syncedAt: now,
        updatedAt: now,
      },
    ],
    scenes: [],
    props: [],
  }
  await fs.writeFile(joinRoot(dataRoot, 'materials.json'), JSON.stringify(materialsIndex, null, 2), 'utf-8')

  return workspace
}

export async function prepareGlobalLibrariesE2eWorkspace() {
  const now = Date.now()
  const meta = {
    id: E2E_GLOBAL_MAT_PROJECT_ID,
    title: 'E2E素材库来源',
    description: '索引模式素材库 E2E',
    currentStep: 1,
    createdAt: now,
    updatedAt: now,
  }

  const workspace = await createE2eWorkspace({
    prefix: 'lc-e2e-global-lib-',
    projects: [meta],
    seedProject: {
      id: E2E_GLOBAL_MAT_PROJECT_ID,
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
  const { dataRoot } = workspace

  const validImageAbs = joinRoot(workspace.projectDir, E2E_GLOBAL_MAT_VALID_IMAGE_REL.replace(/\//g, path.sep))
  await fs.mkdir(path.dirname(validImageAbs), { recursive: true })
  await fs.writeFile(validImageAbs, TINY_PNG)

  const materialsIndex = {
    characters: [
      {
        id: E2E_GLOBAL_MAT_VALID_ID,
        kind: 'character',
        name: 'E2E有效素材',
        description: '索引模式有效条目',
        prompt: '',
        status: 'ready',
        generatedImagePath: E2E_GLOBAL_MAT_VALID_IMAGE_REL,
        generatedImagePaths: [E2E_GLOBAL_MAT_VALID_IMAGE_REL],
        primaryGeneratedImageIndex: 0,
        sourceProjectId: E2E_GLOBAL_MAT_PROJECT_ID,
        sourceProjectTitle: meta.title,
        sourceAssetId: 'char_e2e_global',
        syncedAt: now,
        updatedAt: now,
      },
      {
        id: E2E_GLOBAL_MAT_BROKEN_ID,
        kind: 'character',
        name: 'E2E无效素材',
        description: '来源项目内图片已丢失',
        prompt: '',
        status: 'ready',
        generatedImagePath: E2E_GLOBAL_MAT_BROKEN_IMAGE_REL,
        generatedImagePaths: [E2E_GLOBAL_MAT_BROKEN_IMAGE_REL],
        primaryGeneratedImageIndex: 0,
        sourceProjectId: E2E_GLOBAL_MAT_PROJECT_ID,
        sourceProjectTitle: meta.title,
        sourceAssetId: 'char_missing',
        syncedAt: now,
        updatedAt: now,
      },
      {
        id: E2E_SOFT_DELETE_MAT_ENTRY_ID,
        kind: 'character',
        name: 'E2E软删项目素材',
        description: '来源项目已软删除，列表仍展示并标回收站',
        prompt: '',
        status: 'ready',
        generatedImagePath: 'pictures/e2e_soft_deleted_hidden.png',
        generatedImagePaths: ['pictures/e2e_soft_deleted_hidden.png'],
        primaryGeneratedImageIndex: 0,
        sourceProjectId: E2E_SOFT_DELETE_MAT_PROJECT_ID,
        sourceProjectTitle: 'E2E已软删项目',
        sourceAssetId: 'char_soft_deleted',
        syncedAt: now,
        updatedAt: now,
      },
    ],
    scenes: [],
    props: [],
  }
  await fs.writeFile(joinRoot(dataRoot, 'materials.json'), JSON.stringify(materialsIndex, null, 2), 'utf-8')

  const workflowRoot = joinRoot(dataRoot, 'workflow')
  const legacyVoiceMeta = {
    id: E2E_LEGACY_VOICE_PROJECT_ID,
    title: 'E2E音色来源',
    description: '索引模式音色库 E2E',
    currentStep: 1,
    createdAt: now,
    updatedAt: now,
  }
  const softDeletedMeta = {
    id: E2E_SOFT_DELETE_MAT_PROJECT_ID,
    title: 'E2E已软删项目',
    description: '软删仍展示素材 E2E',
    currentStep: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: now,
  }
  const legacyProjectDir = joinRoot(workflowRoot, E2E_LEGACY_VOICE_PROJECT_ID)
  await fs.mkdir(legacyProjectDir, { recursive: true })
  await fs.writeFile(joinRoot(legacyProjectDir, 'data.json'), JSON.stringify({
    script: '',
    currentStep: 1,
    projectStylePresetKey: 'style_realistic',
    episodes: [],
    characters: [],
    scenes: [],
    props: [],
    shots: [],
  }, null, 2), 'utf-8')
  await fs.writeFile(joinRoot(legacyProjectDir, 'tasks.json'), '[]', 'utf-8')
  await fs.writeFile(
    joinRoot(workflowRoot, 'projects.json'),
    JSON.stringify([meta, legacyVoiceMeta, softDeletedMeta], null, 2),
    'utf-8',
  )

  await appendWorkflowSourceProject(workspace, {
    projectId: E2E_SOFT_DELETE_MAT_PROJECT_ID,
    title: softDeletedMeta.title,
    deletedAt: now,
    imageRelPath: 'pictures/e2e_soft_deleted_hidden.png',
  })

  const legacyVoiceDir = path.join(legacyProjectDir, 'voices', E2E_LEGACY_VOICE_ID)
  await fs.mkdir(legacyVoiceDir, { recursive: true })
  await fs.writeFile(path.join(legacyVoiceDir, 'reference.wav'), TINY_WAV)

  const voiceLibraryDir = joinRoot(dataRoot, 'voice-library')
  await fs.mkdir(voiceLibraryDir, { recursive: true })
  await fs.writeFile(
    joinRoot(voiceLibraryDir, 'voice-library.json'),
    JSON.stringify(
      [
        {
          id: E2E_LEGACY_VOICE_ID,
          name: E2E_LEGACY_VOICE_NAME,
          createdAt: new Date(now).toISOString(),
          referenceAudio: `voices/${E2E_LEGACY_VOICE_ID}/reference.wav`,
          sourceProjectId: E2E_LEGACY_VOICE_PROJECT_ID,
          sourceProjectTitle: legacyVoiceMeta.title,
          sourceProjectKind: 'workflow',
        },
      ],
      null,
      2,
    ),
    'utf-8',
  )

  return workspace
}
