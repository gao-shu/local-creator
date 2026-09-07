// Copyright (c) local-creator contributors. All rights reserved.

import type { AppSettings } from '@/types/settings'
import type { ProbeVideoAudioResult } from '@/types/media'
import { resolveCanvasProjectRoot } from '@/lib/canvas/canvas-project-paths'
import { extractVideoAudio, probeVideoAudio } from '@/lib/media/media-service'
import { normalizeStoredMediaPath } from '@/lib/storage/media-path-resolver'
import { resolveProjectRoot } from '@/lib/storage/project-paths'
import { readSettings } from '@/lib/storage/settings-service'
import {
  buildProjectVoiceExtractRelativePath,
  toProjectVoiceExtractRelativePath,
} from '@/lib/voice/project-voice-extract-paths'

export type ExtractAudioProjectKind = 'canvas' | 'workflow'

export interface ExtractAudioFromProjectOptions {
  projectId: string
  videoPath: string
  startSec?: number
  endSec?: number
  projectKind?: ExtractAudioProjectKind
  settings?: AppSettings
  appDataDir?: string
  /** 仅供单测注入固定时间戳 */
  timestamp?: number
}

export interface ExtractAudioFromProjectResult {
  success: boolean
  /** 项目内相对路径，如 voices/extract_123/reference.mp3 */
  relativePath?: string
  outputAbs?: string
  error?: string
}

interface ProjectMediaContext {
  settings: AppSettings
  appDataDir: string
  projectRoot: string
}

export {
  buildProjectVoiceExtractRelativePath,
  buildProjectVoiceExtractRelativePath as buildExtractVoiceRelativePath,
  EXTRACTED_VOICE_DIR_PREFIX,
  EXTRACTED_VOICE_REFERENCE_FILENAME,
  isProjectVoiceExtractRelativePath,
  isVoiceLibraryAddVoiceSourceExtension,
  PROJECT_VOICE_EXTRACT_DIR_PREFIX,
  PROJECT_VOICE_EXTRACT_REFERENCE_FILENAME,
  PROJECT_VOICE_EXTRACT_RELATIVE_PATTERN,
  resolveProjectVoiceExtractAbsolutePath,
  resolveProjectVoiceExtractOutputDir,
  resolveProjectVoiceExtractOutputDir as resolveExtractVoiceOutputDir,
  toProjectVoiceExtractRelativePath,
} from '@/lib/voice/project-voice-extract-paths'

/** 校验并规范化画布/工坊视频存储路径（拒绝远程与 preview 占位） */
export function normalizeLocalVideoInputPath(videoPath: string): string {
  const trimmed = normalizeStoredMediaPath(String(videoPath || '').trim())
  if (!trimmed) {
    throw new Error('缺少视频路径')
  }
  if (trimmed.startsWith('preview:')) {
    throw new Error('视频尚未落盘，无法提取音频')
  }
  if (/^https?:\/\//i.test(trimmed)) {
    throw new Error('仅支持本地已落盘视频')
  }
  return trimmed
}

async function resolveProjectMediaContext(
  options: Pick<ExtractAudioFromProjectOptions, 'projectId' | 'projectKind' | 'settings' | 'appDataDir'>,
): Promise<ProjectMediaContext> {
  const projectId = String(options.projectId || '').trim()
  if (!projectId) {
    throw new Error('项目未就绪，无法提取音频')
  }

  const settingsRes =
    options.settings && options.appDataDir
      ? { data: options.settings, appDataDir: options.appDataDir }
      : await readSettings()

  const projectRoot =
    options.projectKind === 'workflow'
      ? resolveProjectRoot(settingsRes.data, settingsRes.appDataDir, projectId)
      : resolveCanvasProjectRoot(settingsRes.data, settingsRes.appDataDir, projectId)

  return {
    settings: settingsRes.data,
    appDataDir: settingsRes.appDataDir,
    projectRoot,
  }
}

/** 探测项目内视频音轨与时长 */
export async function probeVideoAudioFromProject(
  options: Pick<ExtractAudioFromProjectOptions, 'projectId' | 'videoPath' | 'projectKind' | 'settings' | 'appDataDir'>,
): Promise<ProbeVideoAudioResult> {
  try {
    const inputPath = normalizeLocalVideoInputPath(options.videoPath)
    const { projectRoot } = await resolveProjectMediaContext(options)
    return probeVideoAudio({ inputPath, projectRoot })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { hasAudio: false, durationSec: null, error: message }
  }
}

/**
 * 从项目内已落盘视频提取 mp3 到 voices/extract_{timestamp}/reference.mp3。
 * 返回项目相对路径，供音色库 / 参考条后续使用。
 */
export async function extractAudioFromVideo(
  options: ExtractAudioFromProjectOptions,
): Promise<ExtractAudioFromProjectResult> {
  try {
    const inputPath = normalizeLocalVideoInputPath(options.videoPath)
    const { projectRoot } = await resolveProjectMediaContext(options)
    const timestamp = options.timestamp ?? Date.now()
    const outputPath = buildProjectVoiceExtractRelativePath(timestamp)

    const result = await extractVideoAudio({
      inputPath,
      outputPath,
      startSec: options.startSec,
      endSec: options.endSec,
      projectRoot,
    })

    if (!result.success || !result.outputAbs) {
      return { success: false, error: result.error || '音频提取失败' }
    }

    const relativePath = toProjectVoiceExtractRelativePath(result.outputAbs, projectRoot)
    if (!relativePath) {
      return { success: false, error: '无法解析输出路径' }
    }

    return {
      success: true,
      relativePath,
      outputAbs: result.outputAbs,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}
