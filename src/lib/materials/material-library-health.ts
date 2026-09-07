// Copyright (c) local-creator contributors. All rights reserved.

import { isMaterialIndexStoredMediaPath } from '@/lib/materials/material-index-media-paths'
import { materialPreviewKey } from '@/components/materials/material-asset-view'
import { collectMaterialEntryMediaPaths } from '@/lib/materials/global-materials-paths'
import { getAssetPreviewPath, getGeneratedImagePaths, getReferenceImagePaths } from '@/lib/workflow/asset-utils'
import type { MaterialsIndexFile, SyncedMaterialEntry } from '@/types/material-library'
import type { MaterialLibraryItem } from '@/lib/materials/material-library-service'

function isResolvableMaterialIndexMediaPath(path: string): boolean {
  const trimmed = String(path || '').trim()
  if (!trimmed) return false
  if (/^https?:\/\//i.test(trimmed)) return true
  return isMaterialIndexStoredMediaPath(trimmed)
}

function hasResolvableMaterialMedia(paths: string[]): boolean {
  return paths.some((path) => isResolvableMaterialIndexMediaPath(path))
}

function collectItemMediaPaths(item: MaterialLibraryItem): string[] {
  const asset = item.asset
  const paths = [
    ...getReferenceImagePaths(asset),
    ...getGeneratedImagePaths(asset),
    asset.reviewImagePath,
  ]
  return paths.map((path) => String(path || '').trim()).filter(Boolean)
}

/** 索引条目无图片路径或路径格式不可解析时视为无效 */
export function isBrokenMaterialLibraryEntry(entry: SyncedMaterialEntry): boolean {
  const paths = collectMaterialEntryMediaPaths(entry)
  if (!paths.length) return true
  return !hasResolvableMaterialMedia(paths)
}

/** 无预览路径或路径格式不可解析时视为无效（不校验磁盘文件） */
export function isBrokenMaterialLibraryItem(item: MaterialLibraryItem): boolean {
  const paths = collectItemMediaPaths(item)
  if (!paths.length) return true
  if (!getAssetPreviewPath(item.asset)) return true
  return !hasResolvableMaterialMedia(paths)
}

/**
 * 预览图加载完成后：以实际读盘结果为准（已成功加载则视为有效，避免绝对路径等格式误判）
 */
export function isBrokenMaterialLibraryItemAfterPreview(
  item: MaterialLibraryItem,
  previewMap: Readonly<Record<string, string>>,
): boolean {
  if (previewMap[materialPreviewKey(item)]) return false
  const previewPath = getAssetPreviewPath(item.asset)
  if (!previewPath) return true
  return true
}

export function collectBrokenMaterialLibraryItems(
  items: MaterialLibraryItem[],
): MaterialLibraryItem[] {
  return items.filter(isBrokenMaterialLibraryItem)
}

export function collectBrokenMaterialLibraryItemsAfterPreview(
  items: MaterialLibraryItem[],
  previewMap: Readonly<Record<string, string>>,
): MaterialLibraryItem[] {
  return items.filter((item) => isBrokenMaterialLibraryItemAfterPreview(item, previewMap))
}

export function collectBrokenMaterialEntriesFromIndex(
  index: MaterialsIndexFile,
): SyncedMaterialEntry[] {
  return [...index.characters, ...index.scenes, ...index.props].filter(isBrokenMaterialLibraryEntry)
}
