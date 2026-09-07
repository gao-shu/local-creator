// Copyright (c) Haode AI. All rights reserved.

import { generateUUID } from '@/lib/utils'
import { syncAssetToMaterialLibrary, isAssetSyncedToLibrary } from '@/lib/materials/material-library-service'
import { readMaterialsIndex, type MaterialsIndexFile } from '@/lib/materials/materials-index-service'
import { resolveCanvasImageDisplayName } from '@/lib/canvas/canvas-image-role'
import type { CanvasImageAssetRole, CanvasImageNodeData } from '@/types/canvas-nodes'
import type { AppSettings } from '@/types/settings'
import type { AssetKind, WorkflowAsset } from '@/types/workflow'

function assetRoleToKind(role: CanvasImageAssetRole): AssetKind {
  if (role === 'scene') return 'scene'
  if (role === 'item') return 'prop'
  return 'character'
}

export async function saveCanvasImageNodeToMaterialLibrary(options: {
  nodeId: string
  data: CanvasImageNodeData
  projectId: string
  projectTitle: string
  settings: AppSettings
  appDataDir: string
}): Promise<void> {
  const outputPath = String(options.data.outputPath || '').trim()
  if (!outputPath) throw new Error('请先生成或上传图片')

  const role = options.data.assetRole ?? 'character'
  if (!options.data.assetRoleConverted) {
    throw new Error('请先将图片转换为人物/场景/道具后再保存')
  }

  const displayName = resolveCanvasImageDisplayName({
    assetRole: role,
    imageName: options.data.imageName,
    assetRoleConverted: true,
    importShotNumber: options.data.importShotNumber,
  })

  const name =
    displayName.nickname === '未命名'
      ? `画布素材_${options.nodeId.slice(-6)}`
      : displayName.label
  const now = Date.now()
  const asset: WorkflowAsset = {
    id: `canvas_asset_${options.nodeId}`,
    kind: assetRoleToKind(role),
    name,
    description: String(options.data.prompt || '').trim(),
    prompt: String(options.data.prompt || '').trim(),
    generatedImagePath: outputPath,
    generatedImagePaths: [outputPath],
    primaryGeneratedImageIndex: 0,
    status: 'ready',
    updatedAt: now,
    createdAt: now,
  }

  await syncAssetToMaterialLibrary(
    asset,
    options.projectId,
    options.projectTitle || options.projectId,
    options.settings,
    options.appDataDir,
    { projectKind: 'canvas' },
  )
}

export function buildCanvasMaterialAssetId(nodeId: string): string {
  return `canvas_asset_${nodeId}`
}

/** 画布节点是否已同步到全局素材库 */
export function isCanvasImageNodeSyncedToMaterialLibrary(options: {
  nodeId: string
  projectId: string
  role: CanvasImageAssetRole
  index: MaterialsIndexFile
}): boolean {
  const asset: WorkflowAsset = {
    id: buildCanvasMaterialAssetId(options.nodeId),
    kind: assetRoleToKind(options.role),
    name: '',
    description: '',
    prompt: '',
    status: 'ready',
    updatedAt: 0,
  }
  return isAssetSyncedToLibrary(asset, options.projectId, options.index)
}

export async function isCanvasImageNodeSyncedToMaterialLibraryAsync(options: {
  nodeId: string
  projectId: string
  role: CanvasImageAssetRole
}): Promise<boolean> {
  const index = await readMaterialsIndex()
  return isCanvasImageNodeSyncedToMaterialLibrary({ ...options, index })
}

export function createEditedSiblingAssetId(): string {
  return `canvas_edit_${generateUUID().slice(0, 8)}`
}
