// Copyright (c) Haode AI. All rights reserved.

import {
  readMaterialsIndex,
  readMaterialsIndexWithMeta,
  syncAssetToMaterialsLibraryViaIpc,
} from '@/lib/materials/materials-index-service'
import type { MaterialsSyncProjectKind } from '@/lib/materials/materials-sync-types'
import type { AppSettings } from '@/types/settings'
import type { AssetKind, WorkflowAsset } from '@/types/workflow'
import {
  MATERIALS_LIST_KEY,
  syncedEntryToWorkflowAsset,
  type MaterialsIndexFile,
  type SyncedMaterialEntry,
} from '@/types/material-library'

/**
 * 按项目 ID 显式排除素材索引条目（工具函数；默认列表不再因软删隐藏条目）。
 */
export function filterMaterialsIndexExcludingProjects(
  index: MaterialsIndexFile,
  excludedProjectIds: ReadonlySet<string>,
): MaterialsIndexFile {
  if (!excludedProjectIds.size) return index
  const filterList = (entries: SyncedMaterialEntry[]) =>
    entries.filter((entry) => !excludedProjectIds.has(String(entry.sourceProjectId || '').trim()))
  return {
    characters: filterList(index.characters),
    scenes: filterList(index.scenes),
    props: filterList(index.props),
  }
}

export function isMaterialEntryFromExcludedProject(
  entry: SyncedMaterialEntry,
  excludedProjectIds: ReadonlySet<string>,
): boolean {
  const projectId = String(entry.sourceProjectId || '').trim()
  return Boolean(projectId && excludedProjectIds.has(projectId))
}

export interface MaterialLibraryItem {
  /** 素材库索引 id（materials.json） */
  libraryEntryId: string
  projectId: string
  projectTitle: string
  asset: WorkflowAsset
  /** 来源项目在回收站（软删，文件仍保留） */
  sourceInRecycleBin?: boolean
}

export interface MaterialLibraryFilters {
  kind?: AssetKind | 'all'
  projectId?: string | 'all'
  keyword?: string
}

export interface MaterialProjectGroup {
  projectId: string
  projectTitle: string
  assets: MaterialLibraryItem[]
}

export interface SyncAssetToMaterialLibraryOptions {
  projectKind?: MaterialsSyncProjectKind
}

/** 来源项目是否在回收站（软删，媒体通常仍可读） */
export function isMaterialSourceInRecycleBin(
  projectId: string | undefined,
  softDeletedProjectIds: ReadonlySet<string>,
): boolean {
  const id = String(projectId || '').trim()
  return Boolean(id && softDeletedProjectIds.has(id))
}

function entryToItem(
  entry: SyncedMaterialEntry,
  softDeletedProjectIds?: ReadonlySet<string>,
): MaterialLibraryItem {
  const projectId = entry.sourceProjectId
  return {
    libraryEntryId: entry.id,
    projectId,
    projectTitle: entry.sourceProjectTitle,
    asset: syncedEntryToWorkflowAsset(entry),
    sourceInRecycleBin: softDeletedProjectIds
      ? isMaterialSourceInRecycleBin(projectId, softDeletedProjectIds)
      : false,
  }
}

export async function loadSyncedMaterialLibrary(): Promise<MaterialLibraryItem[]> {
  const { index, softDeletedProjectIds } = await readMaterialsIndexWithMeta()
  const items: MaterialLibraryItem[] = []
  for (const entry of [...index.characters, ...index.scenes, ...index.props]) {
    items.push(entryToItem(entry, softDeletedProjectIds))
  }
  return items.sort((a, b) => b.asset.updatedAt - a.asset.updatedAt)
}

/** 将资产写入 materials.json 索引（媒体保留在来源项目内，不复制） */
export async function syncAssetToMaterialLibrary(
  asset: WorkflowAsset,
  projectId: string,
  projectTitle: string,
  _settings?: AppSettings,
  _appDataDir?: string,
  options: SyncAssetToMaterialLibraryOptions = {},
): Promise<SyncedMaterialEntry> {
  return syncAssetToMaterialsLibraryViaIpc({
    asset,
    projectId,
    projectTitle,
    projectKind: options.projectKind ?? 'workflow',
  })
}

export function isAssetSyncedToLibrary(
  asset: WorkflowAsset,
  projectId: string,
  index: Awaited<ReturnType<typeof readMaterialsIndex>>,
): boolean {
  const listKey = MATERIALS_LIST_KEY[asset.kind]
  return index[listKey].some(
    (item) => item.sourceProjectId === projectId && item.sourceAssetId === asset.id,
  )
}

/** 按来源项目 + 资产 ID 判断是否已同步到素材库（跨角色/场景/道具列表） */
export function isSourceAssetSyncedToLibrary(
  sourceProjectId: string,
  sourceAssetId: string,
  index: MaterialsIndexFile,
): boolean {
  if (!sourceProjectId || !sourceAssetId) return false
  return [...index.characters, ...index.scenes, ...index.props].some(
    (item) => item.sourceProjectId === sourceProjectId && item.sourceAssetId === sourceAssetId,
  )
}

export function materialLibrarySyncButtonLabel(synced: boolean): string {
  return synced ? '更新到素材库' : '保存到素材库'
}

/** 保存按钮禁用/悬停提示（索引模式：文件仍在来源项目） */
export function materialLibrarySyncButtonTip(options: {
  synced: boolean
  hasMedia: boolean
  needsAssetRoleMark?: boolean
}): string {
  if (!options.hasMedia) return '请先有参考图或生成图后再保存到素材库'
  if (options.needsAssetRoleMark) return '请先标记为人物/场景/道具后再保存到素材库'
  if (options.synced) return '再次点击可更新素材库索引（图片仍保存在来源项目）'
  return '写入素材库索引（图片仍保存在来源项目，不会复制到全局目录）'
}

export function materialLibrarySyncSuccessMessage(name: string, synced: boolean): string {
  const label = name.trim() || '未命名资产'
  return synced
    ? `「${label}」已更新到素材库索引`
    : `「${label}」已写入素材库索引（文件仍在原项目）`
}

/** 收集指定项目已同步到素材库的资产 ID */
export function collectSyncedAssetIds(index: MaterialsIndexFile, projectId: string): Set<string> {
  const ids = new Set<string>()
  if (!projectId) return ids
  for (const entry of [...index.characters, ...index.scenes, ...index.props]) {
    if (entry.sourceProjectId === projectId) {
      ids.add(entry.sourceAssetId)
    }
  }
  return ids
}

export function isMaterialLibraryItemInProject(
  item: MaterialLibraryItem,
  currentProjectId: string,
  existingAssetIds: ReadonlySet<string>,
): boolean {
  if (!currentProjectId || item.projectId !== currentProjectId) return false
  return existingAssetIds.has(item.asset.id)
}

export function filterMaterialAssets(
  items: MaterialLibraryItem[],
  filters: MaterialLibraryFilters,
): MaterialLibraryItem[] {
  const keyword = filters.keyword?.trim().toLowerCase()
  return items.filter((item) => {
    if (filters.kind && filters.kind !== 'all' && item.asset.kind !== filters.kind) return false
    if (filters.projectId && filters.projectId !== 'all' && item.projectId !== filters.projectId) {
      return false
    }
    if (keyword) {
      const haystack = `${item.asset.name} ${item.asset.description} ${item.projectTitle}`.toLowerCase()
      if (!haystack.includes(keyword)) return false
    }
    return true
  })
}

export function countAssetsByKind(
  items: MaterialLibraryItem[],
): Record<AssetKind, number> & { total: number } {
  const character = items.filter((item) => item.asset.kind === 'character').length
  const scene = items.filter((item) => item.asset.kind === 'scene').length
  const prop = items.filter((item) => item.asset.kind === 'prop').length
  return { character, scene, prop, total: character + scene + prop }
}

export function groupMaterialAssetsByProject(items: MaterialLibraryItem[]): MaterialProjectGroup[] {
  const map = new Map<string, MaterialProjectGroup>()
  for (const item of items) {
    let group = map.get(item.projectId)
    if (!group) {
      group = {
        projectId: item.projectId,
        projectTitle: item.projectTitle,
        assets: [],
      }
      map.set(item.projectId, group)
    }
    group.assets.push(item)
  }

  return [...map.values()].sort((a, b) => {
    const aMax = Math.max(...a.assets.map((entry) => entry.asset.updatedAt), 0)
    const bMax = Math.max(...b.assets.map((entry) => entry.asset.updatedAt), 0)
    return bMax - aMax
  })
}

export function resolveRouteKind(pathname: string): AssetKind | 'all' {
  if (pathname.startsWith('/materials/characters')) return 'character'
  if (pathname.startsWith('/materials/scenes')) return 'scene'
  if (pathname.startsWith('/materials/props')) return 'prop'
  return 'all'
}
