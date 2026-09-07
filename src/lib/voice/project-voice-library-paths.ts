// Copyright (c) Haode AI. All rights reserved.

import {
  joinPathSegments,
  trimTrailingSeparators,
} from '@/lib/storage/storage-path-utils'
import {
  isAbsoluteMediaPath,
  normalizeStoredMediaPath,
} from '@/lib/storage/media-path-resolver'
import type { VoiceLibraryEntry } from '@/types/voice-library'
import { PROJECT_VOICES_FOLDER, PROJECT_VOICE_LIBRARY_INDEX } from '@/types/voice-library'

export function resolveProjectVoiceLibraryIndexPath(projectRoot: string): string {
  return joinPathSegments(projectRoot, PROJECT_VOICE_LIBRARY_INDEX)
}

export function resolveProjectVoicesDir(projectRoot: string): string {
  return joinPathSegments(projectRoot, PROJECT_VOICES_FOLDER)
}

/** 磁盘绝对路径 → 项目内相对路径（如 voices/voice_xxx/reference.mp3） */
export function toProjectRelativeVoicePath(
  storedPath: string,
  projectRoot: string,
): string {
  const trimmed = normalizeStoredMediaPath(storedPath)
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const root = trimTrailingSeparators(projectRoot).replace(/\\/g, '/')
  const normalized = trimmed.replace(/\\/g, '/')
  const rootKey = root.toLowerCase()
  const pathKey = normalized.toLowerCase()

  if (pathKey.startsWith(`${rootKey}/`)) {
    return normalized.slice(root.length + 1)
  }

  if (!isAbsoluteMediaPath(trimmed)) return trimmed

  const projectId = root.split('/').pop() || ''
  if (projectId) {
    const marker = `/${projectId}/`
    const idx = pathKey.indexOf(marker.toLowerCase())
    if (idx >= 0) {
      return normalized.slice(idx + marker.length)
    }
  }

  const voicesMatch = normalized.match(/(?:^|[\\/])voices[\\/].+$/i)
  if (voicesMatch) {
    return voicesMatch[0].replace(/^[\\/]/, '')
  }

  return trimmed
}

/** 存储路径 → 当前项目下可读绝对路径 */
export function resolveProjectVoicePath(storedPath: string, projectRoot: string): string {
  const trimmed = normalizeStoredMediaPath(storedPath)
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const root = trimTrailingSeparators(projectRoot)
  if (!isAbsoluteMediaPath(trimmed)) {
    return joinPathSegments(root, trimmed.replace(/\\/g, '/'))
  }

  const normalized = trimmed.replace(/\\/g, '/')
  const projectId = root.split(/[\\/]/).pop() || ''
  if (projectId) {
    const marker = `/${projectId}/`
    const idx = normalized.toLowerCase().indexOf(marker.toLowerCase())
    if (idx >= 0) {
      const suffix = normalized.slice(idx + marker.length)
      return joinPathSegments(root, suffix)
    }
  }

  const voicesMatch = normalized.match(/(?:^|[\\/])voices[\\/].+$/i)
  if (voicesMatch) {
    return joinPathSegments(root, voicesMatch[0].replace(/^[\\/]/, ''))
  }

  return trimmed
}

export function remapVoiceLibraryForRead(
  entries: VoiceLibraryEntry[],
  projectRoot: string,
): VoiceLibraryEntry[] {
  return entries.map((entry) => ({
    ...entry,
    referenceAudio: resolveProjectVoicePath(entry.referenceAudio, projectRoot),
  }))
}

export function remapVoiceLibraryForWrite(
  entries: VoiceLibraryEntry[],
  projectRoot: string,
): VoiceLibraryEntry[] {
  return entries.map((entry) => ({
    ...entry,
    referenceAudio: toProjectRelativeVoicePath(entry.referenceAudio, projectRoot),
  }))
}
