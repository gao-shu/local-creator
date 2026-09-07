// Copyright (c) Haode AI. All rights reserved.

/**
 * 视频抽音落盘路径约定（Phase 1）
 *
 * | 用途 | 项目内相对路径 |
 * |------|----------------|
 * | 画布/工坊视频抽音 | `voices/extract_{timestamp}/reference.mp3` |
 *
 * 与 `voices/` 下其它目录并列：
 * - `voices/voice_{ts}/reference.{mp3,wav}` — `voice-library:add-voice` 入库后条目
 * - `voices/shot_{id}/upload_{ts}.{mp3,wav}` — 分镜参考上传
 *
 * **音色库衔接**：`add-voice` 的 `sourceAudioPath` 传 extract 产物绝对路径即可
 *（`.mp3`）；主进程会复制到 `voices/voice_{newTs}/reference.mp3` 并写索引。
 */

import { joinPathSegments } from '@/lib/storage/storage-path-utils'
import { normalizeStoredMediaPath } from '@/lib/storage/media-path-resolver'
import {
  resolveProjectVoicePath,
  resolveProjectVoicesDir,
  toProjectRelativeVoicePath,
} from '@/lib/voice/project-voice-library-paths'
import { PROJECT_VOICES_FOLDER } from '@/types/voice-library'

/** 抽音目录名前缀：`extract_{timestamp}` */
export const PROJECT_VOICE_EXTRACT_DIR_PREFIX = 'extract_'

/** 抽音参考音频文件名（与音色库 reference 命名一致） */
export const PROJECT_VOICE_EXTRACT_REFERENCE_FILENAME = 'reference.mp3'

/** 合法的项目内抽音相对路径 */
export const PROJECT_VOICE_EXTRACT_RELATIVE_PATTERN =
  /^voices\/extract_\d+\/reference\.mp3$/i

/** @deprecated 使用 PROJECT_VOICE_EXTRACT_REFERENCE_FILENAME */
export const EXTRACTED_VOICE_REFERENCE_FILENAME = PROJECT_VOICE_EXTRACT_REFERENCE_FILENAME

/** @deprecated 使用 PROJECT_VOICE_EXTRACT_DIR_PREFIX */
export const EXTRACTED_VOICE_DIR_PREFIX = PROJECT_VOICE_EXTRACT_DIR_PREFIX

export function buildProjectVoiceExtractDirName(timestamp = Date.now()): string {
  return `${PROJECT_VOICE_EXTRACT_DIR_PREFIX}${timestamp}`
}

/** 生成抽音落盘相对路径：`voices/extract_{timestamp}/reference.mp3` */
export function buildProjectVoiceExtractRelativePath(timestamp = Date.now()): string {
  return joinPathSegments(
    joinPathSegments(PROJECT_VOICES_FOLDER, buildProjectVoiceExtractDirName(timestamp)),
    PROJECT_VOICE_EXTRACT_REFERENCE_FILENAME,
  )
}

/** 生成抽音落盘绝对目录：`{projectRoot}/voices/extract_{timestamp}` */
export function resolveProjectVoiceExtractOutputDir(
  projectRoot: string,
  timestamp = Date.now(),
): string {
  return joinPathSegments(
    resolveProjectVoicesDir(projectRoot),
    buildProjectVoiceExtractDirName(timestamp),
  )
}

/** 生成抽音落盘绝对文件路径 */
export function resolveProjectVoiceExtractOutputAbs(
  projectRoot: string,
  timestamp = Date.now(),
): string {
  return joinPathSegments(
    resolveProjectVoiceExtractOutputDir(projectRoot, timestamp),
    PROJECT_VOICE_EXTRACT_REFERENCE_FILENAME,
  )
}

export function isProjectVoiceExtractRelativePath(storedPath: string): boolean {
  const text = normalizeStoredMediaPath(storedPath).replace(/\\/g, '/')
  return PROJECT_VOICE_EXTRACT_RELATIVE_PATTERN.test(text)
}

/** 是否可作为 voice-library:add-voice 的 sourceAudioPath（mp3 / wav 本地文件） */
export function isVoiceLibraryAddVoiceSourceExtension(filePath: string): boolean {
  const ext = String(filePath || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    ?.match(/\.[a-z0-9]+$/i)?.[0]
    ?.toLowerCase()
  return ext === '.mp3' || ext === '.wav'
}

/** 抽音相对路径 → 绝对路径（供 add-voice sourceAudioPath） */
export function resolveProjectVoiceExtractAbsolutePath(
  projectRoot: string,
  relativePath: string,
): string {
  return resolveProjectVoicePath(relativePath, projectRoot)
}

/** 抽音绝对路径 → 项目相对路径 */
export function toProjectVoiceExtractRelativePath(
  absolutePath: string,
  projectRoot: string,
): string {
  return toProjectRelativeVoicePath(absolutePath, projectRoot)
}

/** @deprecated 使用 buildProjectVoiceExtractRelativePath */
export const buildExtractVoiceRelativePath = buildProjectVoiceExtractRelativePath

/** @deprecated 使用 resolveProjectVoiceExtractOutputDir */
export const resolveExtractVoiceOutputDir = resolveProjectVoiceExtractOutputDir
