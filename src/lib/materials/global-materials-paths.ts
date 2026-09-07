// Copyright (c) Haode AI. All rights reserved.

import {
  joinPathSegments,
  normalizeDataRootPath,
  resolveStorageRoot,
  isCanvasProjectDirName,
} from '@/lib/storage/storage-path-utils'
import {
  normalizeStoredMediaPath,
  isAbsoluteMediaPath,
} from '@/lib/storage/media-path-resolver'
import type { AppSettings } from '@/types/settings'
import { resolveProjectRoot } from '@/lib/storage/project-paths'
import { resolveCanvasProjectRoot } from '@/lib/canvas/canvas-project-paths'
import {
  MATERIALS_INDEX_FILENAME,
  MATERIALS_LIBRARY_DIR_NAME,
  type MaterialsIndexFile,
  type SyncedMaterialEntry,
} from '@/types/material-library'

import type { CanvasMediaOwnerKind } from '@/types/canvas-nodes'

export function resolveMaterialsIndexPath(dataRoot: string): string {
  const root = normalizeDataRootPath(dataRoot)
  if (!root) return ''
  return joinPathSegments(root, MATERIALS_INDEX_FILENAME)
}

/** 素材库目录（仅索引模式遗留引用，媒体不在此目录） */
export function resolveMaterialsLibraryRoot(dataRoot: string): string {
  const root = normalizeDataRootPath(dataRoot)
  if (!root) return ''
  return joinPathSegments(root, MATERIALS_LIBRARY_DIR_NAME)
}

export function resolveMaterialsLibraryRootFromSettings(
  settings: Pick<AppSettings, 'dataRootPath'>,
  dataRoot: string,
): string {
  return resolveMaterialsLibraryRoot(resolveStorageRoot(settings, dataRoot))
}

/** 读取 materials.json 后原样返回（路径保持项目相对路径） */
export function remapMaterialEntryMediaForRead(entry: SyncedMaterialEntry): SyncedMaterialEntry {
  return entry
}

/** 写入 materials.json 前原样存储（路径保持项目相对路径） */
export function remapMaterialEntryMediaForWrite(entry: SyncedMaterialEntry): SyncedMaterialEntry {
  return entry
}

export function collectMaterialEntryMediaPaths(entry: SyncedMaterialEntry): string[] {
  const values: string[] = []
  const push = (value?: string) => {
    if (value?.trim()) values.push(value.trim())
  }
  const pushList = (list?: string[]) => {
    if (list?.length) values.push(...list.filter(Boolean))
  }

  push(entry.referenceImagePath)
  pushList(entry.referenceImagePaths)
  push(entry.generatedImagePath)
  pushList(entry.generatedImagePaths)
  push(entry.reviewImagePath)
  return values
}

/** 读取素材图片时解析项目根目录（媒体保留在来源项目内） */
export function resolveMaterialMediaReadRoot(
  storedPath: string | undefined,
  settings: Pick<AppSettings, 'dataRootPath'>,
  dataRoot: string,
  sourceProjectId: string,
): string | undefined {
  const trimmed = normalizeStoredMediaPath(String(storedPath || '').trim())
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return undefined
  if (isAbsoluteMediaPath(trimmed)) return undefined
  if (!sourceProjectId) return undefined
  if (isCanvasProjectDirName(sourceProjectId)) {
    return resolveCanvasProjectRoot(settings, dataRoot, sourceProjectId)
  }
  return resolveProjectRoot(settings, dataRoot, sourceProjectId)
}

export function resolveMaterialLibraryMediaOwner(
  _storedPath: string | undefined,
  sourceProjectId: string,
): { ownerKind: CanvasMediaOwnerKind; ownerProjectId?: string } {
  if (sourceProjectId && isCanvasProjectDirName(sourceProjectId)) {
    return { ownerKind: 'canvas', ownerProjectId: sourceProjectId }
  }
  return { ownerKind: 'workflow', ownerProjectId: sourceProjectId || undefined }
}

export function remapMaterialsIndexForRead(index: MaterialsIndexFile): MaterialsIndexFile {
  const remapList = (entries: SyncedMaterialEntry[]) =>
    entries.map((entry) => remapMaterialEntryMediaForRead(entry))
  return {
    characters: remapList(index.characters),
    scenes: remapList(index.scenes),
    props: remapList(index.props),
  }
}
