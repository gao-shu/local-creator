// Copyright (c) local-creator contributors. All rights reserved.

import {
  joinPathSegments,
  normalizeDataRootPath,
  resolveStorageRoot,
  isCanvasProjectDirName,
} from '@/lib/storage/storage-path-utils'
import type { AppSettings } from '@/types/settings'
import { resolveProjectRoot } from '@/lib/storage/project-paths'
import { resolveCanvasProjectRoot } from '@/lib/canvas/canvas-project-paths'
import {
  VOICE_LIBRARY_DIR_NAME,
  VOICE_LIBRARY_INDEX_FILENAME,
  type VoiceLibraryEntry,
  type VoiceLibraryProjectKind,
} from '@/types/voice-library'
import { resolveProjectVoicePath } from '@/lib/voice/project-voice-library-paths'
import {
  isAbsoluteMediaPath,
  normalizeStoredMediaPath,
} from '@/lib/storage/media-path-resolver'

export function resolveGlobalVoiceLibraryRoot(dataRoot: string): string {
  const root = normalizeDataRootPath(dataRoot)
  if (!root) return ''
  return joinPathSegments(root, VOICE_LIBRARY_DIR_NAME)
}

export function resolveGlobalVoiceLibraryRootFromSettings(
  settings: Pick<AppSettings, 'dataRootPath'>,
  dataRoot: string,
): string {
  return resolveGlobalVoiceLibraryRoot(resolveStorageRoot(settings, dataRoot))
}

export function resolveGlobalVoiceLibraryIndexPath(libraryRoot: string): string {
  return joinPathSegments(libraryRoot, VOICE_LIBRARY_INDEX_FILENAME)
}

/** 音色库条目 ID，如 voice_1739xxx */
export function isGlobalVoiceLibraryEntryId(voiceId: string): boolean {
  return /^voice_\d+$/i.test(String(voiceId || '').trim())
}

/** 音色库索引内可解析的项目相对音频路径 */
export function isVoiceIndexStoredMediaPath(storedPath: string): boolean {
  const text = normalizeStoredMediaPath(storedPath).replace(/\\/g, '/')
  if (!text || /^https?:\/\//i.test(text)) return false
  if (isAbsoluteMediaPath(text)) return false
  return /^voices\/voice_\d+\/reference\.(?:mp3|wav)$/i.test(text)
}

/** 项目内分镜上传音色：voices/shot_xxx/... */
export function isProjectShotVoiceRelativePath(storedPath: string): boolean {
  const text = normalizeStoredMediaPath(storedPath).replace(/\\/g, '/')
  return /^voices\/shot_[^/]+(?:\/|$)/i.test(text)
}

/** 过滤掉来源项目已软删除的音色库条目 */
/**
 * 按项目 ID 显式排除音色条目（工具函数；默认 list 不再因软删隐藏）。
 */
export function filterVoiceLibraryExcludingProjects(
  entries: VoiceLibraryEntry[],
  excludedProjectIds: ReadonlySet<string>,
): VoiceLibraryEntry[] {
  if (!excludedProjectIds.size) return entries
  return entries.filter((entry) => {
    const projectId = String(entry.sourceProjectId || '').trim()
    return !projectId || !excludedProjectIds.has(projectId)
  })
}

/** 读取音色音频时解析来源项目根目录 */
export function resolveVoiceMediaReadRoot(
  sourceProjectId: string,
  sourceProjectKind: VoiceLibraryProjectKind | undefined,
  settings: Pick<AppSettings, 'dataRootPath'>,
  dataRoot: string,
): string | undefined {
  const projectId = String(sourceProjectId || '').trim()
  if (!projectId) return undefined
  const kind = sourceProjectKind ?? (isCanvasProjectDirName(projectId) ? 'canvas' : 'workflow')
  if (kind === 'canvas') {
    return resolveCanvasProjectRoot(settings, dataRoot, projectId)
  }
  return resolveProjectRoot(settings, dataRoot, projectId)
}

export function resolveVoiceLibraryEntryAudioPath(
  entry: VoiceLibraryEntry,
  projectRoot: string,
): string {
  const trimmed = normalizeStoredMediaPath(entry.referenceAudio)
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed) || isAbsoluteMediaPath(trimmed)) return trimmed
  return resolveProjectVoicePath(trimmed, projectRoot)
}

/** 主进程读取索引后：将项目相对路径解析为绝对路径供渲染进程使用 */
export function remapVoiceLibraryEntriesForRead(
  entries: VoiceLibraryEntry[],
  resolveProjectRoot: (entry: VoiceLibraryEntry) => string | undefined,
): VoiceLibraryEntry[] {
  return entries.map((entry) => {
    const projectRoot = resolveProjectRoot(entry)
    if (!projectRoot) return entry
    return {
      ...entry,
      referenceAudio: resolveVoiceLibraryEntryAudioPath(entry, projectRoot),
    }
  })
}

/** 写入 voice-library.json 前去掉运行时字段，路径原样存储 */
export function remapVoiceLibraryEntriesForWrite(entries: VoiceLibraryEntry[]): VoiceLibraryEntry[] {
  return entries.map((entry) => {
    const { sourceInRecycleBin: _flag, ...rest } = entry
    return rest
  })
}
