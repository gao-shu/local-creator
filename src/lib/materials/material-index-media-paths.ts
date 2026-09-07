// Copyright (c) Haode AI. All rights reserved.

import {
  isRemoteMediaReference,
  normalizeStoredMediaPath,
  isAbsoluteMediaPath,
  toProjectRelativeMediaPath,
  isProjectRelativeMediaPath,
} from '@/lib/storage/media-path-resolver'

/** 素材库索引内可解析的项目相对媒体路径（含 assets/{id}/ref|gen/ 布局） */
export function isMaterialIndexStoredMediaPath(storedPath: string): boolean {
  const text = normalizeStoredMediaPath(storedPath).replace(/\\/g, '/')
  if (!text || /^https?:\/\//i.test(text)) return false
  if (isRemoteMediaReference(text)) return true
  if (isProjectRelativeMediaPath(text)) return true
  return /^assets\/[^/]+\/(?:ref|gen)\/.+$/i.test(text)
}
export function normalizeMaterialIndexMediaPath(
  storedPath: string,
  sourceProjectRoot: string,
): string | undefined {
  const trimmed = normalizeStoredMediaPath(String(storedPath || '').trim())
  if (!trimmed) return undefined
  if (isRemoteMediaReference(trimmed) || /^https?:\/\//i.test(trimmed)) return trimmed
  if (!isAbsoluteMediaPath(trimmed)) {
    return trimmed.replace(/\\/g, '/')
  }
  const relative = toProjectRelativeMediaPath(trimmed, sourceProjectRoot)
  if (!relative) return undefined
  return relative.replace(/\\/g, '/')
}

export function normalizeMaterialIndexMediaPathList(
  paths: string[],
  sourceProjectRoot: string,
): string[] {
  const normalized: string[] = []
  for (const rawPath of paths) {
    const path = normalizeMaterialIndexMediaPath(rawPath, sourceProjectRoot)
    if (path) normalized.push(path)
  }
  return normalized
}
