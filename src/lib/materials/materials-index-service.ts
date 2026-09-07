// Copyright (c) Haode AI. All rights reserved.

import type { MaterialsSyncAssetPayload } from '@/lib/materials/materials-sync-types'
import {
  createEmptyMaterialsIndex,
  MATERIALS_LIST_KEY,
  normalizeMaterialsIndex,
  type MaterialsIndexFile,
  type SyncedMaterialEntry,
} from '@/types/material-library'

export interface MaterialsReadResult {
  success: boolean
  fileExists?: boolean
  data: MaterialsIndexFile
  /** 来源项目已在回收站的 ID（软删；媒体仍可读） */
  softDeletedProjectIds?: string[]
  error?: string
}

export interface MaterialsAPI {
  read: () => Promise<MaterialsReadResult>
  write: (data: MaterialsIndexFile) => Promise<{ success: boolean; error?: string }>
  upsertEntry: (payload: {
    kind: SyncedMaterialEntry['kind']
    entry: SyncedMaterialEntry
  }) => Promise<{ success: boolean; error?: string }>
  syncAsset: (
    payload: MaterialsSyncAssetPayload,
  ) => Promise<{ success: boolean; entry?: SyncedMaterialEntry; error?: string }>
  removeEntries?: (payload: {
    entryIds: string[]
  }) => Promise<{ success: boolean; removedCount?: number; error?: string }>
}

export async function readMaterialsIndex(): Promise<MaterialsIndexFile> {
  const { index } = await readMaterialsIndexWithMeta()
  return index
}

export async function readMaterialsIndexWithMeta(): Promise<{
  index: MaterialsIndexFile
  softDeletedProjectIds: Set<string>
}> {
  if (window.materialsAPI) {
    const res = await window.materialsAPI.read()
    if (res.success) {
      return {
        index: normalizeMaterialsIndex(res.data),
        softDeletedProjectIds: new Set(
          (res.softDeletedProjectIds ?? []).map((id) => String(id || '').trim()).filter(Boolean),
        ),
      }
    }
  }
  return { index: createEmptyMaterialsIndex(), softDeletedProjectIds: new Set() }
}

export async function writeMaterialsIndex(data: MaterialsIndexFile): Promise<void> {
  const normalized = normalizeMaterialsIndex(data)
  if (window.materialsAPI) {
    const res = await window.materialsAPI.write(normalized)
    if (!res.success) throw new Error(res.error || '写入素材库失败')
    return
  }
  throw new Error('素材库仅在桌面客户端可用')
}

export async function upsertMaterialsEntry(entry: SyncedMaterialEntry): Promise<void> {
  if (window.materialsAPI?.upsertEntry) {
    const res = await window.materialsAPI.upsertEntry({
      kind: MATERIALS_LIST_KEY[entry.kind],
      entry,
    })
    if (!res.success) throw new Error(res.error || '同步到素材库失败')
    return
  }
  throw new Error('素材库仅在桌面客户端可用')
}

export async function syncAssetToMaterialsLibraryViaIpc(
  payload: MaterialsSyncAssetPayload,
): Promise<SyncedMaterialEntry> {
  if (!window.materialsAPI?.syncAsset) {
    throw new Error('素材库同步服务未就绪，请完全退出并重新启动桌面客户端')
  }
  const res = await window.materialsAPI.syncAsset(payload)
  if (!res.success || !res.entry) {
    throw new Error(res.error || '同步到素材库失败')
  }
  return res.entry
}

export async function removeMaterialLibraryEntriesByIds(entryIds: string[]): Promise<number> {
  if (!window.materialsAPI?.removeEntries) {
    throw new Error('素材库清理服务未就绪，请完全退出并重新启动桌面客户端')
  }
  const ids = entryIds.map((id) => String(id || '').trim()).filter(Boolean)
  if (!ids.length) return 0
  const res = await window.materialsAPI.removeEntries({ entryIds: ids })
  if (!res.success) throw new Error(res.error || '清理素材库条目失败')
  return res.removedCount ?? 0
}
