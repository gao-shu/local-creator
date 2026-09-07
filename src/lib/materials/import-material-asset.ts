// Copyright (c) Haode AI. All rights reserved.

import type { AppSettings } from '@/types/settings'
import type { WorkflowAsset } from '@/types/workflow'
import { generateUUID } from '@/lib/utils'
import { readStoredMediaAsDataUrl } from '@/lib/storage/fs-service'
import { resolveMaterialMediaReadRoot } from '@/lib/materials/global-materials-paths'
import {
  buildImageFieldsFromPaths,
  clearAssetReviewPatch,
  createEmptyAsset,
  getGeneratedImagePaths,
  getReferenceImagePaths,
} from '@/lib/workflow/asset-utils'
import { saveProjectMediaFromDataUrl } from '@/lib/workflow/project-media-save'
import { saveShotReferenceImage } from '@/lib/workflow/shot-reference-utils'
import type { MaterialLibraryItem } from '@/lib/materials/material-library-service'
import { getAssetPreviewPath } from '@/lib/workflow/asset-utils'

async function copyMediaPathList(
  paths: string[],
  options: {
    settings: AppSettings
    appDataDir: string
    sourceProjectId: string
    targetProjectId: string
    assetKind: WorkflowAsset['kind']
    entityId: string
    purpose: 'ref' | 'gen'
  },
): Promise<string[]> {
  const copied: string[] = []
  for (const storedPath of paths) {
    const readRoot = resolveMaterialMediaReadRoot(
      storedPath,
      options.settings,
      options.appDataDir,
      options.sourceProjectId,
    )
    const dataUrl = await readStoredMediaAsDataUrl(storedPath, readRoot)
    if (!dataUrl || dataUrl.startsWith('preview:')) continue
    const relative = await saveProjectMediaFromDataUrl({
      settings: options.settings,
      appDataDir: options.appDataDir,
      projectId: options.targetProjectId,
      dataUrl,
      entityId: options.entityId,
      target: options.assetKind,
      purpose: options.purpose,
    })
    copied.push(relative)
  }
  return copied
}

/** 导入时在目标项目内生成不重复的名称 */
export function resolveUniqueAssetName(existingNames: string[], baseName: string): string {
  const trimmed = baseName.trim() || '未命名资产'
  const normalized = existingNames.map((name) => name.trim().toLowerCase())
  if (!normalized.includes(trimmed.toLowerCase())) return trimmed
  let index = 2
  while (normalized.includes(`${trimmed} (${index})`.toLowerCase())) {
    index += 1
  }
  return `${trimmed} (${index})`
}

/** 从素材库条目复制资产（含图片）到目标项目 */
export async function cloneAssetFromMaterialLibrary(options: {
  source: MaterialLibraryItem
  targetProjectId: string
  settings: AppSettings
  appDataDir: string
  nameOverride?: string
}): Promise<WorkflowAsset> {
  const { source, targetProjectId, settings, appDataDir, nameOverride } = options
  const sourceAsset = source.asset
  const newId = `asset_${generateUUID()}`
  const copyOptions = {
    settings,
    appDataDir,
    sourceProjectId: source.projectId,
    targetProjectId,
    assetKind: sourceAsset.kind,
    entityId: newId,
  }

  const refPaths = await copyMediaPathList(getReferenceImagePaths(sourceAsset), {
    ...copyOptions,
    purpose: 'ref',
  })

  const genPaths = await copyMediaPathList(getGeneratedImagePaths(sourceAsset), {
    ...copyOptions,
    purpose: 'gen',
  })

  const primaryIndex = sourceAsset.primaryGeneratedImageIndex ?? 0
  const imageFields = buildImageFieldsFromPaths(refPaths, genPaths, primaryIndex)

  const base = createEmptyAsset(sourceAsset.kind, nameOverride?.trim() || sourceAsset.name)
  const hasImage = genPaths.length > 0 || refPaths.length > 0

  return {
    ...base,
    id: newId,
    name: nameOverride?.trim() || sourceAsset.name,
    description: sourceAsset.description,
    prompt: sourceAsset.prompt || sourceAsset.description,
    layoutKey: sourceAsset.layoutKey,
    styleKey: sourceAsset.styleKey,
    voiceType: sourceAsset.kind === 'character' ? sourceAsset.voiceType : undefined,
    selectedReferenceImageIndex: sourceAsset.selectedReferenceImageIndex,
    ...imageFields,
    ...clearAssetReviewPatch(),
    status: hasImage ? 'done' : sourceAsset.status === 'generating' ? 'draft' : sourceAsset.status,
    updatedAt: Date.now(),
  }
}

/** 从素材库条目复制预览图到分镜参考图 */
export async function saveShotReferenceFromMaterialItem(options: {
  item: MaterialLibraryItem
  settings: AppSettings
  appDataDir: string
  projectId: string
  shotId: string
}): Promise<string> {
  const previewPath = getAssetPreviewPath(options.item.asset)
  if (!previewPath) throw new Error('该素材没有可用的图片')

  const readRoot = resolveMaterialMediaReadRoot(
    previewPath,
    options.settings,
    options.appDataDir,
    options.item.projectId,
  )
  const dataUrl = await readStoredMediaAsDataUrl(previewPath, readRoot)
  if (!dataUrl || dataUrl.startsWith('preview:')) {
    throw new Error('无法读取素材图片，请检查素材是否已损坏')
  }

  return saveShotReferenceImage(dataUrl, {
    settings: options.settings,
    appDataDir: options.appDataDir,
    projectId: options.projectId,
    shotId: options.shotId,
  })
}

async function copyMaterialPreviewToProjectAssetMedia(options: {
  item: MaterialLibraryItem
  settings: AppSettings
  appDataDir: string
  targetProjectId: string
  entityId: string
  assetKind: WorkflowAsset['kind']
  purpose: 'ref' | 'gen'
}): Promise<string> {
  const previewPath = getAssetPreviewPath(options.item.asset)
  if (!previewPath) throw new Error('该素材没有可用的图片')

  const readRoot = resolveMaterialMediaReadRoot(
    previewPath,
    options.settings,
    options.appDataDir,
    options.item.projectId,
  )
  const dataUrl = await readStoredMediaAsDataUrl(previewPath, readRoot)
  if (!dataUrl || dataUrl.startsWith('preview:')) {
    throw new Error('无法读取素材图片，请检查素材是否已损坏')
  }

  return saveProjectMediaFromDataUrl({
    settings: options.settings,
    appDataDir: options.appDataDir,
    projectId: options.targetProjectId,
    dataUrl,
    entityId: options.entityId,
    target: options.assetKind,
    purpose: options.purpose,
  })
}

/** 从素材库条目复制预览图到项目资产参考图 */
export async function saveAssetReferenceFromMaterialItem(options: {
  item: MaterialLibraryItem
  settings: AppSettings
  appDataDir: string
  projectId: string
  assetId: string
  assetKind: WorkflowAsset['kind']
}): Promise<string> {
  return copyMaterialPreviewToProjectAssetMedia({
    item: options.item,
    settings: options.settings,
    appDataDir: options.appDataDir,
    targetProjectId: options.projectId,
    entityId: options.assetId,
    assetKind: options.assetKind,
    purpose: 'ref',
  })
}

/** 从素材库条目复制生成图（无生成图时用预览图）到项目资产 */
export async function copyMaterialGeneratedImagesToAsset(options: {
  item: MaterialLibraryItem
  settings: AppSettings
  appDataDir: string
  projectId: string
  assetId: string
  assetKind: WorkflowAsset['kind']
}): Promise<string[]> {
  const genPaths = getGeneratedImagePaths(options.item.asset)
  const copyOptions = {
    settings: options.settings,
    appDataDir: options.appDataDir,
    sourceProjectId: options.item.projectId,
    targetProjectId: options.projectId,
    assetKind: options.assetKind,
    entityId: options.assetId,
  }

  if (genPaths.length) {
    return copyMediaPathList(genPaths, { ...copyOptions, purpose: 'gen' })
  }

  return [
    await copyMaterialPreviewToProjectAssetMedia({
      item: options.item,
      settings: options.settings,
      appDataDir: options.appDataDir,
      targetProjectId: options.projectId,
      entityId: options.assetId,
      assetKind: options.assetKind,
      purpose: 'gen',
    }),
  ]
}
