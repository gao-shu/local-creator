// Copyright (c) local-creator contributors. All rights reserved.

import { addVoiceLibraryEntry } from '@/lib/voice/voice-library-service'
import {
  isAllowedVoiceAudioPath,
  probeLocalAudioDurationSec,
  validateVoiceAudioDuration,
} from '@/lib/voice/voice-audio-utils'
import { isVoiceLibraryAddVoiceSourceExtension } from '@/lib/voice/project-voice-extract-paths'
import type { VoiceLibraryEntry, VoiceLibraryProjectKind } from '@/types/voice-library'
import type { ExtractAudioFromProjectResult } from '@/lib/media/extract-audio-from-video'
import { resolveExtractResultOutputAbs } from '@/lib/media/extract-audio-post-actions'

export interface SaveExtractedAudioToVoiceLibraryOptions {
  /** 音色名称（UI 可编辑后传入） */
  name: string
  /** 抽音产物绝对路径（extractAudioFromVideo 的 outputAbs） */
  sourceAudioPath: string
  projectId: string
  projectTitle?: string
  projectKind?: VoiceLibraryProjectKind
  /** 默认 true：与工坊/画布新增音色一致，校验 1.8–15.2 秒 */
  validateDuration?: boolean
}

export interface SaveExtractedAudioToVoiceLibraryResult {
  success: boolean
  voice?: VoiceLibraryEntry
  error?: string
}

/** 去掉台词与括号备注，便于生成短展示名 */
function stripExtractDisplayNoise(text: string): string {
  return text
    .split(/[：:]/)[0]
    ?.replace(/\s*[（(][^）)]*[）)]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || ''
}

/**
 * 从视频展示名提炼短来源（成功态副标题），如「镜 1 · 阿尔多」。
 */
export function formatExtractVoiceSourceLabel(videoDisplayName?: string): string {
  const raw = String(videoDisplayName || '').trim()
  if (!raw) return ''
  let label = stripExtractDisplayNoise(raw).replace(/^视频\s*/, '').trim()
  if (label.length > 28) label = `${label.slice(0, 28)}…`
  return label
}

/**
 * 根据视频节点展示名生成默认音色库名称（尽量短，如「阿尔多 · 参考音」）。
 */
export function buildDefaultExtractVoiceLibraryName(videoDisplayName?: string): string {
  const cleaned = stripExtractDisplayNoise(String(videoDisplayName || '').trim())
  if (!cleaned) return '参考音'

  const parts = cleaned
    .replace(/^视频\s*/, '')
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean)
  let core = parts.length >= 2 ? parts[parts.length - 1]! : parts[0] || cleaned
  if (core.length > 12) core = `${core.slice(0, 12)}…`
  if (!core) return '参考音'
  return `${core} · 参考音`
}

/** 校验抽音 mp3 是否满足音色库 sourceAudioPath 要求 */
export function assertExtractedAudioVoiceLibraryReady(sourceAudioPath: string): void {
  const path = String(sourceAudioPath || '').trim()
  if (!path) {
    throw new Error('缺少音频文件路径')
  }
  if (!isVoiceLibraryAddVoiceSourceExtension(path) || !isAllowedVoiceAudioPath(path)) {
    throw new Error('仅支持 mp3 / wav 格式')
  }
}

/**
 * 将视频抽音产物保存到软件音色库（复用 voice-library:add-voice，不新建音频库）。
 */
export async function saveExtractedAudioToVoiceLibrary(
  options: SaveExtractedAudioToVoiceLibraryOptions,
): Promise<SaveExtractedAudioToVoiceLibraryResult> {
  try {
    const name = String(options.name || '').trim()
    const sourceAudioPath = String(options.sourceAudioPath || '').trim()
    if (!name) {
      return { success: false, error: '请输入音色名称' }
    }
    assertExtractedAudioVoiceLibraryReady(sourceAudioPath)

    if (options.validateDuration !== false) {
      const durationSec = await probeLocalAudioDurationSec(sourceAudioPath)
      const durationError = validateVoiceAudioDuration(durationSec)
      if (durationError) {
        return { success: false, error: durationError }
      }
    }

    const voice = await addVoiceLibraryEntry(name, sourceAudioPath, {
      projectId: options.projectId,
      projectTitle: options.projectTitle,
      projectKind: options.projectKind ?? 'canvas',
    })

    return { success: true, voice }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}

/** 抽音成功后可选入库：从 extract 结果 + 名称写入音色库 */
export async function saveExtractResultToVoiceLibrary(
  extractResult: ExtractAudioFromProjectResult,
  options: Omit<SaveExtractedAudioToVoiceLibraryOptions, 'sourceAudioPath'> & {
    projectRoot?: string
  },
): Promise<SaveExtractedAudioToVoiceLibraryResult> {
  if (!extractResult.success) {
    return { success: false, error: extractResult.error || '音频提取失败' }
  }
  try {
    const sourceAudioPath = resolveExtractResultOutputAbs(extractResult, options.projectRoot)
    if (!sourceAudioPath) {
      return { success: false, error: '缺少抽音产物路径' }
    }
    return saveExtractedAudioToVoiceLibrary({
      ...options,
      sourceAudioPath,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}
