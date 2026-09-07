// Copyright (c) local-creator contributors. All rights reserved.

import type { AppSettings } from '@/types/settings'
import { joinPathSegments } from '@/lib/storage/storage-path-utils'
import { resolveProjectRoot } from '@/lib/storage/project-paths'
import { copyReferenceAudioFile } from '@/lib/storage/fs-service'
import {
  resolveProjectVoicesDir,
  toProjectRelativeVoicePath,
} from '@/lib/voice/project-voice-library-paths'
import {
  decodeLocalVoiceType,
  resolveVoiceLabel,
  type VoiceLibraryEntry,
} from '@/types/voice-library'
import { resolveMentionsInText, type MentionCandidate } from '@/lib/workflow/mention-utils'

export const MAX_REFERENCE_AUDIOS = 10

const AUDIO_EXT_RE = /\.(?:mp3|wav|m4a|aac|ogg|flac|opus)$/i
const OBFUSCATED_VOICE_NAME_RE = /^[a-f0-9-]{32,36}$/i

/** 上传后 URL 文件名常为 hash/uuid，不宜作为 @ 引用名 */
export function isObfuscatedVoiceName(name: string): boolean {
  const trimmed = stripReferenceAudioExtension(String(name || '').trim())
  if (!trimmed) return false
  if (OBFUSCATED_VOICE_NAME_RE.test(trimmed)) return true
  if (/^[a-f0-9]{32}$/i.test(trimmed)) return true
  return false
}

export function normalizeVoiceDisplayName(name: string, index = 0): string {
  const trimmed = stripReferenceAudioExtension(String(name || '').trim())
  if (!trimmed || isObfuscatedVoiceName(trimmed)) {
    return `上传音色${index + 1}`
  }
  return trimmed
}

export function stripReferenceAudioExtension(name: string): string {
  return String(name || '')
    .trim()
    .replace(AUDIO_EXT_RE, '')
    .trim()
}

export function formatReferenceAudioDisplayName(path: string, index = 0): string {
  const trimmed = path.trim()
  if (!trimmed) return `音色 ${index + 1}`
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const name = decodeURIComponent(new URL(trimmed).pathname.split('/').pop() || '')
      if (name) return normalizeVoiceDisplayName(name, index)
    } catch {
      // ignore
    }
    return `上传音色${index + 1}`
  }
  const base = trimmed.replace(/\\/g, '/').split('/').pop() || ''
  return normalizeVoiceDisplayName(base, index)
}

export function buildUploadedVoiceMentionId(path: string): string {
  return `voice_ref:${path.trim()}`
}

/** 兼容旧数据：从 referenceAudioPaths 补全 referenceAudioItems */
export function getReferenceAudioItems(
  shot: Pick<WorkflowShot, 'referenceAudioItems' | 'referenceAudioPaths'>,
): WorkflowShotReferenceAudioItem[] {
  if (shot.referenceAudioItems?.length) {
    return shot.referenceAudioItems
      .map((item, index) => {
        const path = String(item.path || '').trim()
        const rawName = String(item.name || '').trim()
        if (!path) return null
        return {
          path,
          name: normalizeVoiceDisplayName(rawName || formatReferenceAudioDisplayName(path, index), index),
        }
      })
      .filter((item): item is WorkflowShotReferenceAudioItem => item != null)
  }
  return (shot.referenceAudioPaths ?? [])
    .map((path, index) => {
      const trimmed = String(path || '').trim()
      if (!trimmed) return null
      return {
        path: trimmed,
        name: formatReferenceAudioDisplayName(trimmed, index),
      }
    })
    .filter((item): item is WorkflowShotReferenceAudioItem => item != null)
}

export function getReferenceAudioPaths(
  shot: Pick<WorkflowShot, 'referenceAudioItems' | 'referenceAudioPaths'>,
): string[] {
  const items = getReferenceAudioItems(shot)
  if (items.length) return items.map((item) => item.path)
  return shot.referenceAudioPaths?.length ? [...shot.referenceAudioPaths] : []
}

export function buildUploadedVoiceMentionCandidates(
  shot: Pick<WorkflowShot, 'referenceAudioItems' | 'referenceAudioPaths'>,
): MentionCandidate[] {
  const candidates: MentionCandidate[] = []
  for (const item of getReferenceAudioItems(shot)) {
    const id = buildUploadedVoiceMentionId(item.path)
    candidates.push({
      id,
      name: item.name,
      mentionName: item.name,
      kind: 'voice',
      description: '上传音色',
    })
    const pathKey = formatReferenceAudioDisplayName(item.path, 0)
    if (pathKey && pathKey !== item.name && isObfuscatedVoiceName(pathKey)) {
      candidates.push({
        id,
        name: item.name,
        mentionName: pathKey,
        kind: 'voice',
        description: '上传音色',
      })
    }
  }
  return candidates
}

export function appendShotReferenceAudio(
  shot: WorkflowShot,
  audioPath: string,
  name?: string,
): Partial<WorkflowShot> {
  const prev = getReferenceAudioItems(shot)
  const displayName = normalizeVoiceDisplayName(
    stripReferenceAudioExtension(name?.trim() || '') ||
      formatReferenceAudioDisplayName(audioPath, prev.length),
    prev.length,
  )
  const next = [...prev, { path: audioPath.trim(), name: displayName }]
  const trimmed =
    next.length > MAX_REFERENCE_AUDIOS ? next.slice(-MAX_REFERENCE_AUDIOS) : next
  return {
    referenceAudioItems: trimmed.length ? trimmed : undefined,
    referenceAudioPaths: trimmed.length ? trimmed.map((item) => item.path) : undefined,
    updatedAt: Date.now(),
  }
}

export function removeShotReferenceAudioAt(shot: WorkflowShot, index: number): Partial<WorkflowShot> {
  const next = getReferenceAudioItems(shot).filter((_, i) => i !== index)
  return {
    referenceAudioItems: next.length ? next : undefined,
    referenceAudioPaths: next.length ? next.map((item) => item.path) : undefined,
    updatedAt: Date.now(),
  }
}

const SHOT_AUDIO_REFERENCE_PATCH_KEYS = new Set(['referenceAudioPaths', 'referenceAudioItems'])

export function isShotAudioReferencePatch(patch: Partial<WorkflowShot>): boolean {
  return Object.keys(patch).some((key) => SHOT_AUDIO_REFERENCE_PATCH_KEYS.has(key))
}

/** 将分镜参考音色保存到项目 voices/ 目录，返回项目内相对路径 */
export async function saveShotReferenceAudio(
  sourceAudioPath: string,
  options: {
    settings: AppSettings
    appDataDir: string
    projectId: string
    shotId: string
  },
): Promise<string> {
  const source = String(sourceAudioPath || '').trim()
  if (!source) throw new Error('未选择音频文件')

  const ext = source.replace(/\\/g, '/').split('/').pop()?.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase()
  if (ext !== '.mp3' && ext !== '.wav') {
    throw new Error('仅支持 mp3 / wav 格式')
  }

  const projectRoot = resolveProjectRoot(
    options.settings,
    options.appDataDir,
    options.projectId,
  )
  const safeShotId = String(options.shotId || 'shot').replace(/[^a-zA-Z0-9_-]/g, '_')
  const targetDir = joinPathSegments(resolveProjectVoicesDir(projectRoot), `shot_${safeShotId}`)

  const copied = await copyReferenceAudioFile({
    sourcePath: source,
    targetDir,
    filename: `upload_${Date.now()}${ext}`,
  })
  if (!copied.success || !copied.filePath) {
    throw new Error(copied.error || '保存参考音色到项目目录失败')
  }

  return toProjectRelativeVoicePath(copied.filePath, projectRoot)
}

/** @deprecated 保留兼容；生视频时仍可能上传 https 历史数据 */
export async function uploadShotReferenceAudio(
  sourceAudioPath: string,
  options: {
    apiBaseUrl?: string
    shotId: string
  },
): Promise<string> {
  const { uploadReferenceAudioForGeneration } = await import('@/lib/workflow/reference-audio-upload')
  const source = String(sourceAudioPath || '').trim()
  if (!source) throw new Error('未选择音频文件')

  const ext = source.replace(/\\/g, '/').split('/').pop()?.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase()
  if (ext !== '.mp3' && ext !== '.wav') {
    throw new Error('仅支持 mp3 / wav 格式')
  }

  return uploadReferenceAudioForGeneration(source, {
    apiBaseUrl: options.apiBaseUrl,
    label: `shot_${options.shotId}_ref_audio`,
  })
}

export interface ShotVideoReferenceAudioItem {
  label: string
  path: string
  source: 'upload' | 'character_voice'
  /** 角色 @ 引用名（绑定音色时用于 UI 与微视占位关联） */
  mentionName?: string
}

function findCharacterAsset(
  assetId: string,
  characters: WorkflowAsset[],
): WorkflowAsset | undefined {
  return characters.find((item) => item.id === assetId)
}

function resolveVoiceLibraryAudioPath(
  voiceType: string | undefined,
  voiceLibrary: VoiceLibraryEntry[],
): string | undefined {
  const voiceId = decodeLocalVoiceType(voiceType)
  if (!voiceId) return undefined
  const entry = voiceLibrary.find((item) => item.id === voiceId)
  return entry?.referenceAudio?.trim() || undefined
}

function normalizeComparableAudioPath(path: string): string {
  return String(path || '').trim().replace(/\\/g, '/').split('?')[0]!.toLowerCase()
}

function collectUploadVoiceMentionKeys(item: ShotVideoReferenceAudioItem): string[] {
  const keys = new Set<string>()
  if (item.mentionName?.trim()) keys.add(item.mentionName.trim())
  if (item.label?.trim()) keys.add(item.label.trim())
  const pathKey = formatReferenceAudioDisplayName(item.path, 0)
  if (pathKey?.trim()) keys.add(pathKey.trim())
  return [...keys].filter(Boolean)
}

/**
 * 分镜视频参考音频：提示词 @ 引用的上传音色 + @ 角色绑定的本地音色
 */
export function buildShotVideoReferenceAudioItems(
  shot: WorkflowShot,
  options?: {
    mentionCandidates?: MentionCandidate[]
    characters?: WorkflowAsset[]
    voiceLibrary?: VoiceLibraryEntry[]
  },
): ShotVideoReferenceAudioItem[] {
  const items: ShotVideoReferenceAudioItem[] = []
  const seenPaths = new Set<string>()
  const push = (
    path: string | undefined,
    label: string,
    source: ShotVideoReferenceAudioItem['source'],
    mentionName?: string,
  ) => {
    const trimmed = path?.trim()
    if (!trimmed) return
    const dedupeKey = normalizeComparableAudioPath(trimmed)
    if (seenPaths.has(dedupeKey)) return
    seenPaths.add(dedupeKey)
    items.push({ label, path: trimmed, source, mentionName })
  }

  const voiceLibrary = options?.voiceLibrary ?? []
  const mentionText = [shot.spatialAnchor, shot.prompt].filter(Boolean).join('\n')
  const uploadedVoiceCandidates = buildUploadedVoiceMentionCandidates(shot)
  const assetCandidates = options?.mentionCandidates ?? []
  const allMentionCandidates = [...assetCandidates, ...uploadedVoiceCandidates]

  for (const mention of resolveMentionsInText(mentionText, uploadedVoiceCandidates)) {
    if (mention.kind !== 'voice') continue
    const audioItem = getReferenceAudioItems(shot).find(
      (item) => buildUploadedVoiceMentionId(item.path) === mention.id,
    )
    if (!audioItem) continue
    push(audioItem.path, audioItem.name, 'upload', audioItem.name)
  }

  const characters = options?.characters ?? []
  for (const mention of resolveMentionsInText(mentionText, allMentionCandidates)) {
    if (mention.kind !== 'character') continue
    const asset = findCharacterAsset(mention.id, characters)
    const voicePath = resolveVoiceLibraryAudioPath(asset?.voiceType, voiceLibrary)
    if (!voicePath) continue
    const voiceLabel =
      resolveVoiceLabel(asset?.voiceType, voiceLibrary) ||
      mention.voiceLabel ||
      `${mention.mentionName}的音色`
    push(voicePath, voiceLabel, 'character_voice', mention.mentionName)
  }

  return items.slice(0, MAX_REFERENCE_AUDIOS)
}

export function collectUploadVoiceMentionKeysForItems(
  items: ShotVideoReferenceAudioItem[],
): string[] {
  const keys = new Set<string>()
  for (const item of items) {
    if (item.source !== 'upload') continue
    for (const key of collectUploadVoiceMentionKeys(item)) {
      keys.add(key)
    }
  }
  return [...keys]
}

/** 上传音色 @ 引用 → 正文占位 @N（含旧 hash 别名） */
export function buildUploadVoiceBodyReplacementEntries(
  audioItems: ShotVideoReferenceAudioItem[],
  audioPlaceholderIndexes: number[],
): Array<{ key: string; placeholderIndex: number }> {
  const entries: Array<{ key: string; placeholderIndex: number }> = []
  audioItems.forEach((item, index) => {
    if (item.source !== 'upload') return
    const placeholderIndex = audioPlaceholderIndexes[index]
    if (!placeholderIndex) return
    for (const key of collectUploadVoiceMentionKeys(item)) {
      entries.push({ key, placeholderIndex })
    }
  })
  return entries.sort((a, b) => b.key.length - a.key.length)
}

export function buildShotVideoReferenceAudioPaths(
  shot: WorkflowShot,
  options?: {
    mentionCandidates?: MentionCandidate[]
    characters?: WorkflowAsset[]
    voiceLibrary?: VoiceLibraryEntry[]
  },
): string[] {
  return buildShotVideoReferenceAudioItems(shot, options).map((item) => item.path)
}
