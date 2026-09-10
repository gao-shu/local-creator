import fs from 'node:fs/promises'
import {
  normalizeMaterialIndexMediaPath,
  normalizeMaterialIndexMediaPathList,
} from '../../src/lib/materials/material-index-media-paths'
import { resolveMaterialsIndexPath } from '../../src/lib/materials/global-materials-paths'
import type { MaterialsSyncAssetPayload } from '../../src/lib/materials/materials-sync-types'
import {
  isRemoteMediaReference,
  normalizeStoredMediaPath,
  resolveProjectMediaPath,
} from '../../src/lib/storage/media-path-resolver'
import {
  resolveCanvasStorageDir,
  resolveSafeCanvasProjectDir,
  resolveWorkflowStorageDir,
} from '../../src/lib/storage/storage-path-utils'
import {
  getGeneratedImagePaths,
  getReferenceImagePaths,
} from '../../src/lib/workflow/asset-utils'
import { generateUUID } from '../../src/lib/utils'
import {
  createEmptyMaterialsIndex,
  MATERIALS_LIST_KEY,
  normalizeMaterialsIndex,
  type MaterialsIndexFile,
  type SyncedMaterialEntry,
} from '../../src/types/material-library'
import { readModifyWriteJsonAtomic, writeJsonAtomic } from './atomic-write'
import { readSettingsMerged } from './ipc-settings'
import { projectDir, resolveWorkflowRoot } from './ipc-workflow'

async function resolveSourceProjectRoot(
  projectId: string,
  projectKind: MaterialsSyncAssetPayload['projectKind'] = 'workflow',
): Promise<string> {
  const id = String(projectId || '').trim()
  if (!id) throw new Error('项目 ID 无效')

  const { data, ctx } = await readSettingsMerged()
  const dataRoot = data.dataRootPath || ctx.dataRoot
  if (!dataRoot) throw new Error('请先在系统设置中选择数据根目录')

  if (projectKind === 'canvas') {
    const canvasRoot = resolveCanvasStorageDir(data, dataRoot)
    return resolveSafeCanvasProjectDir(canvasRoot, id)
  }

  const workflowRoot = resolveWorkflowStorageDir(data, dataRoot) || (await resolveWorkflowRoot())
  return projectDir(workflowRoot, id)
}

function buildPrimaryPath(
  paths: string[] | undefined,
  primaryIndex: number | undefined,
): string | undefined {
  if (!paths?.length) return undefined
  const index = Math.min(Math.max(primaryIndex ?? 0, 0), paths.length - 1)
  return paths[index]
}

async function assertResolvableProjectMediaPaths(
  paths: string[],
  sourceProjectRoot: string,
): Promise<void> {
  let resolvable = 0
  for (const storedPath of paths) {
    const trimmed = normalizeStoredMediaPath(storedPath)
    if (!trimmed) continue
    if (isRemoteMediaReference(trimmed) || /^https?:\/\//i.test(trimmed)) {
      resolvable += 1
      continue
    }
    const absolute = resolveProjectMediaPath(trimmed, sourceProjectRoot)
    if (!absolute) continue
    try {
      await fs.access(absolute)
      resolvable += 1
    } catch {
      /* 文件不存在则不计入 */
    }
  }
  if (!resolvable) {
    throw new Error('请先有参考图或生成图后再保存到素材库')
  }
}

export async function syncAssetToGlobalMaterialsLibrary(
  payload: MaterialsSyncAssetPayload,
): Promise<SyncedMaterialEntry> {
  const asset = payload.asset
  const projectId = String(payload.projectId || '').trim()
  const projectTitle = String(payload.projectTitle || projectId).trim()
  if (!projectId) throw new Error('项目未就绪，无法同步素材')

  const { ctx } = await readSettingsMerged()
  const dataRoot = ctx.dataRoot
  if (!dataRoot) throw new Error('请先在系统设置中选择数据根目录')

  const sourceProjectRoot = await resolveSourceProjectRoot(projectId, payload.projectKind)
  const indexPath = resolveMaterialsIndexPath(dataRoot)
  const listKey = MATERIALS_LIST_KEY[asset.kind]

  const referenceImagePaths = normalizeMaterialIndexMediaPathList(
    getReferenceImagePaths(asset),
    sourceProjectRoot,
  )
  const generatedImagePaths = normalizeMaterialIndexMediaPathList(
    getGeneratedImagePaths(asset),
    sourceProjectRoot,
  )
  const reviewImagePath = asset.reviewImagePath
    ? normalizeMaterialIndexMediaPath(asset.reviewImagePath, sourceProjectRoot)
    : undefined

  const allPaths = [
    ...referenceImagePaths,
    ...generatedImagePaths,
    ...(reviewImagePath ? [reviewImagePath] : []),
  ]
  await assertResolvableProjectMediaPaths(allPaths, sourceProjectRoot)

  let existingEntry: SyncedMaterialEntry | undefined
  try {
    const raw = await fs.readFile(indexPath, 'utf-8')
    const normalized = normalizeMaterialsIndex(JSON.parse(raw))
    existingEntry = normalized[listKey].find(
      (item) => item.sourceProjectId === projectId && item.sourceAssetId === asset.id,
    )
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException
    if (err.code !== 'ENOENT') throw error
  }

  const entryId = existingEntry?.id || `lib_${generateUUID()}`
  const now = Date.now()

  const entry: SyncedMaterialEntry = {
    id: entryId,
    kind: asset.kind,
    name: asset.name,
    description: asset.description,
    prompt: asset.prompt,
    layoutKey: asset.layoutKey,
    styleKey: asset.styleKey,
    referenceImagePath: buildPrimaryPath(
      referenceImagePaths,
      asset.selectedReferenceImageIndex,
    ),
    referenceImagePaths: referenceImagePaths.length ? referenceImagePaths : undefined,
    selectedReferenceImageIndex: asset.selectedReferenceImageIndex,
    generatedImagePath: buildPrimaryPath(
      generatedImagePaths,
      asset.primaryGeneratedImageIndex,
    ),
    generatedImagePaths: generatedImagePaths.length ? generatedImagePaths : undefined,
    primaryGeneratedImageIndex: asset.primaryGeneratedImageIndex,
    jimengAssetId: asset.jimengAssetId,
    jimengAssetStatus: asset.jimengAssetStatus,
    reviewImagePath,
    voiceType: asset.voiceType,
    status: asset.status,
    sourceProjectId: projectId,
    sourceProjectTitle: projectTitle,
    sourceAssetId: asset.id,
    syncedAt: existingEntry?.syncedAt ?? now,
    updatedAt: now,
  }

  await readModifyWriteJsonAtomic<MaterialsIndexFile>(
    indexPath,
    createEmptyMaterialsIndex(),
    async (index) => {
      const normalized = normalizeMaterialsIndex(index)
      const list = [...(normalized[listKey] ?? [])]
      const idx = list.findIndex(
        (item) => item.sourceProjectId === projectId && item.sourceAssetId === asset.id,
      )
      if (idx >= 0) {
        list[idx] = { ...entry, id: list[idx].id, syncedAt: list[idx].syncedAt }
      } else {
        list.unshift(entry)
      }
      return { ...normalized, [listKey]: list }
    },
  )

  return entry
}

export async function ensureMaterialsLibraryLayout(dataRoot: string): Promise<void> {
  const indexPath = resolveMaterialsIndexPath(dataRoot)
  try {
    await fs.access(indexPath)
  } catch {
    await writeJsonAtomic(indexPath, createEmptyMaterialsIndex())
  }
}

/** 从 materials.json 移除条目（索引模式不删除项目内图片） */
export async function removeMaterialLibraryEntries(
  dataRoot: string,
  entryIds: string[],
): Promise<number> {
  const ids = new Set(entryIds.map((id) => String(id || '').trim()).filter(Boolean))
  if (!ids.size) return 0

  const indexPath = resolveMaterialsIndexPath(dataRoot)
  let removedCount = 0

  await readModifyWriteJsonAtomic<MaterialsIndexFile>(
    indexPath,
    createEmptyMaterialsIndex(),
    async (index) => {
      const normalized = normalizeMaterialsIndex(index)
      const next: MaterialsIndexFile = {
        characters: normalized.characters.filter((entry) => {
          if (!ids.has(entry.id)) return true
          removedCount += 1
          return false
        }),
        scenes: normalized.scenes.filter((entry) => {
          if (!ids.has(entry.id)) return true
          removedCount += 1
          return false
        }),
        props: normalized.props.filter((entry) => {
          if (!ids.has(entry.id)) return true
          removedCount += 1
          return false
        }),
      }
      return next
    },
  )

  return removedCount
}
