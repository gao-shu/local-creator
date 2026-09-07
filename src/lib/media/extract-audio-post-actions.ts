// Copyright (c) Haode AI. All rights reserved.

import type { ExtractAudioFromProjectResult } from '@/lib/media/extract-audio-from-video'
import { revealPathInExplorer } from '@/lib/storage/fs-service'
import { resolveProjectVoiceExtractAbsolutePath } from '@/lib/voice/project-voice-extract-paths'

/** 从抽音结果解析可用于 reveal / add-voice 的绝对路径 */
export function resolveExtractResultOutputAbs(
  result: Pick<ExtractAudioFromProjectResult, 'outputAbs' | 'relativePath'>,
  projectRoot?: string,
): string {
  const abs = String(result.outputAbs || '').trim()
  if (abs) return abs

  const relativePath = String(result.relativePath || '').trim()
  const root = String(projectRoot || '').trim()
  if (relativePath && root) {
    return resolveProjectVoiceExtractAbsolutePath(root, relativePath)
  }

  return ''
}

/** 在资源管理器中定位抽音 mp3（Step 11） */
export async function revealExtractedAudioInExplorer(
  result: ExtractAudioFromProjectResult,
  options?: { projectRoot?: string },
): Promise<{ success: boolean; error?: string }> {
  if (!result.success) {
    return { success: false, error: result.error || '音频提取失败' }
  }

  const outputAbs = resolveExtractResultOutputAbs(result, options?.projectRoot)
  if (!outputAbs) {
    return { success: false, error: '缺少输出路径' }
  }

  return revealPathInExplorer(outputAbs, { revealFile: true })
}
