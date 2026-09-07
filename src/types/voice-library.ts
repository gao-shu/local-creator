// Copyright (c) local-creator contributors. All rights reserved.

export type VoiceLibraryProjectKind = 'workflow' | 'canvas'

/**
 * 音色库索引条目（dataRoot/voice-library/voice-library.json）。
 * 音频文件保留在来源项目目录内；本条目仅存项目相对路径 + 元数据。
 */
export interface VoiceLibraryEntry {
  id: string
  name: string
  createdAt: string
  /** 来源项目内相对路径，如 voices/voice_xxx/reference.mp3 */
  referenceAudio: string
  /** 来源项目 ID（wf_* / cv_*）；与 referenceAudio 配套解析 */
  sourceProjectId: string
  sourceProjectTitle?: string
  sourceProjectKind?: VoiceLibraryProjectKind
  /** 运行时标记：来源项目在回收站（不落盘） */
  sourceInRecycleBin?: boolean
}

/** 项目内分镜上传音色目录（非音色库条目） */
export const PROJECT_VOICES_FOLDER = 'voices'

/** @deprecated 项目级音色索引，迁移后不再写入 */
export const PROJECT_VOICE_LIBRARY_INDEX = 'voice-library.json'

/** 软件级音色库目录名：{dataRoot}/voice-library */
export const VOICE_LIBRARY_DIR_NAME = 'voice-library'

/** 软件级音色库索引文件名 */
export const VOICE_LIBRARY_INDEX_FILENAME = 'voice-library.json'

/** @deprecated 索引模式下不再复制音频到 voice-library/voices/ */
export const GLOBAL_VOICE_LIBRARY_VOICES_FOLDER = 'voices'

/** 角色绑定的本地音色前缀（对齐 weifan / 画境） */
export const LOCAL_VOICE_PREFIX = 'local:'

export function encodeLocalVoiceType(voiceId: string): string {
  return `${LOCAL_VOICE_PREFIX}${voiceId}`
}

export function decodeLocalVoiceType(voiceType?: string | null): string | null {
  const text = String(voiceType || '').trim()
  if (!text.startsWith(LOCAL_VOICE_PREFIX)) return null
  const id = text.slice(LOCAL_VOICE_PREFIX.length).trim()
  return id || null
}

export function isLocalVoiceType(voiceType?: string | null): boolean {
  return Boolean(decodeLocalVoiceType(voiceType))
}

/** 仅保留 local: 前缀的音色 id，云端等非本地值返回 undefined */
export function normalizeLocalVoiceType(voiceType?: string | null): string | undefined {
  const localId = decodeLocalVoiceType(voiceType)
  return localId ? encodeLocalVoiceType(localId) : undefined
}

export function resolveVoiceLabel(
  voiceType: string | undefined,
  voices: VoiceLibraryEntry[],
): string {
  const localId = decodeLocalVoiceType(voiceType)
  if (!localId) return ''
  return voices.find((item) => item.id === localId)?.name ?? localId
}
