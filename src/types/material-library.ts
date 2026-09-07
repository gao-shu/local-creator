// Copyright (c) Haode AI. All rights reserved.

import type { AssetKind, AssetStatus, WorkflowAsset } from '@/types/workflow'

/**
 * 素材库索引条目（dataRoot/materials.json）。
 * 媒体文件保留在来源项目目录内；本条目仅存项目相对路径 + 元数据。
 */
export interface SyncedMaterialEntry {
  id: string
  kind: AssetKind
  name: string
  description: string
  prompt: string
  layoutKey?: string
  styleKey?: string
  /** 来源项目内相对路径，如 assets/{assetId}/ref/001.png */
  referenceImagePath?: string
  referenceImagePaths?: string[]
  selectedReferenceImageIndex?: number
  /** 来源项目内相对路径，如 assets/{assetId}/gen/001.png */
  generatedImagePath?: string
  generatedImagePaths?: string[]
  primaryGeneratedImageIndex?: number
  weishiAssetId?: string
  weishiAssetUrl?: string
  weishiAssetStatus?: string
  jimengAssetId?: string
  jimengAssetStatus?: string
  /** 来源项目内相对路径 */
  reviewImagePath?: string
  voiceType?: string
  status: AssetStatus
  /** 来源项目 ID（wf_* / cv_*）；与媒体路径配套解析 */
  sourceProjectId: string
  sourceProjectTitle: string
  sourceAssetId: string
  syncedAt: number
  updatedAt: number
}

export interface MaterialsIndexFile {
  characters: SyncedMaterialEntry[]
  scenes: SyncedMaterialEntry[]
  props: SyncedMaterialEntry[]
}

export const MATERIALS_INDEX_FILENAME = 'materials.json'

/** @deprecated 索引模式下不再复制媒体到全局目录；保留常量供旧代码清理前引用 */
export const MATERIALS_LIBRARY_DIR_NAME = 'materials'

/** @deprecated 见 MATERIALS_LIBRARY_DIR_NAME */
export const MATERIALS_LIBRARY_ASSETS_FOLDER = 'assets'

/** @deprecated 见 MATERIALS_LIBRARY_DIR_NAME */
export const MATERIALS_LIBRARY_REF_FOLDER = 'ref'

/** @deprecated 见 MATERIALS_LIBRARY_DIR_NAME */
export const MATERIALS_LIBRARY_GEN_FOLDER = 'gen'

/** 素材库索引条目 ID 前缀（仅 materials.json 内标识，非磁盘目录） */
export const MATERIALS_LIBRARY_ENTRY_ID_PREFIX = 'lib_'

export const MATERIALS_LIST_KEY: Record<AssetKind, keyof MaterialsIndexFile> = {
  character: 'characters',
  scene: 'scenes',
  prop: 'props',
}

export function createEmptyMaterialsIndex(): MaterialsIndexFile {
  return { characters: [], scenes: [], props: [] }
}

export function normalizeMaterialsIndex(raw: unknown): MaterialsIndexFile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createEmptyMaterialsIndex()
  }
  const data = raw as Partial<MaterialsIndexFile> & Record<string, unknown>
  const characters = Array.isArray(data.characters) ? [...data.characters] : []
  const scenes = Array.isArray(data.scenes) ? [...data.scenes] : []
  const props = Array.isArray(data.props) ? [...data.props] : []

  // 兼容早期误写入的单数 key（character / scene / prop）
  if (Array.isArray(data.character)) characters.push(...(data.character as SyncedMaterialEntry[]))
  if (Array.isArray(data.scene)) scenes.push(...(data.scene as SyncedMaterialEntry[]))
  if (Array.isArray(data.prop)) props.push(...(data.prop as SyncedMaterialEntry[]))

  return { characters, scenes, props }
}

export function syncedEntryToWorkflowAsset(entry: SyncedMaterialEntry): WorkflowAsset {
  return {
    id: entry.sourceAssetId,
    kind: entry.kind,
    name: entry.name,
    description: entry.description,
    prompt: entry.prompt,
    layoutKey: entry.layoutKey,
    styleKey: entry.styleKey,
    referenceImagePath: entry.referenceImagePath,
    referenceImagePaths: entry.referenceImagePaths,
    selectedReferenceImageIndex: entry.selectedReferenceImageIndex,
    generatedImagePath: entry.generatedImagePath,
    generatedImagePaths: entry.generatedImagePaths,
    primaryGeneratedImageIndex: entry.primaryGeneratedImageIndex,
    weishiAssetId: entry.weishiAssetId,
    weishiAssetUrl: entry.weishiAssetUrl,
    weishiAssetStatus: entry.weishiAssetStatus,
    jimengAssetId: entry.jimengAssetId,
    jimengAssetStatus: entry.jimengAssetStatus,
    reviewImagePath: entry.reviewImagePath,
    voiceType: entry.voiceType,
    status: entry.status,
    updatedAt: entry.updatedAt,
  }
}
