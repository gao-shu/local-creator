// Copyright (c) local-creator contributors. All rights reserved.

import fs from 'node:fs/promises'
import path from 'node:path'
import type { ExtractAudioResult } from '../../src/types/media'
import { probeVideoAudioAtPath } from './ffmpeg-probe'
import {
  formatFfmpegRunFailure,
  isFfmpegRunSuccess,
  runFfmpeg,
  type FfmpegRunOptions,
} from './ffmpeg-runtime'

export type { ExtractAudioResult }

export interface ExtractAudioParams {
  inputAbs: string
  outputAbs: string
  startSec?: number
  endSec?: number
}

export interface NormalizedExtractRange {
  startSec: number
  /** null 表示截取到片尾 */
  endSec: number | null
}

/** 规范化起止秒并校验（endSec 省略表示到片尾） */
export function normalizeExtractRange(
  startSec?: number,
  endSec?: number,
  durationSec?: number | null,
): { ok: true; range: NormalizedExtractRange } | { ok: false; error: string } {
  const start = startSec ?? 0
  const end = endSec ?? null

  if (!Number.isFinite(start) || start < 0) {
    return { ok: false, error: '起始时间无效' }
  }
  if (end != null && (!Number.isFinite(end) || end <= start)) {
    return { ok: false, error: '结束时间须大于起始时间' }
  }
  if (durationSec != null && Number.isFinite(durationSec)) {
    if (start >= durationSec) {
      return { ok: false, error: '起始时间超出视频时长' }
    }
    if (end != null && end > durationSec) {
      return { ok: false, error: '结束时间超出视频时长' }
    }
  }

  return { ok: true, range: { startSec: start, endSec: end } }
}

/** 构造 ffmpeg 抽音参数（输出 mp3） */
export function buildFfmpegExtractArgs(
  inputAbs: string,
  outputAbs: string,
  range: NormalizedExtractRange,
): string[] {
  const args = ['-y', '-i', inputAbs]
  if (range.startSec > 0) {
    args.push('-ss', String(range.startSec))
  }
  if (range.endSec != null) {
    args.push('-to', String(range.endSec))
  }
  args.push('-vn', '-acodec', 'libmp3lame', '-q:a', '2', outputAbs)
  return args
}

/**
 * 对已校验的本地绝对路径抽音写 mp3（调用方须先走路径安全解析）。
 */
export async function extractAudioAtPath(
  params: ExtractAudioParams,
  options?: FfmpegRunOptions,
): Promise<ExtractAudioResult> {
  const inputAbs = path.resolve(String(params.inputAbs || '').trim())
  const outputAbs = path.resolve(String(params.outputAbs || '').trim())
  if (!inputAbs) {
    return { success: false, error: '缺少输入视频路径' }
  }
  if (!outputAbs) {
    return { success: false, error: '缺少输出音频路径' }
  }
  if (path.extname(outputAbs).toLowerCase() !== '.mp3') {
    return { success: false, error: '输出格式须为 .mp3' }
  }

  try {
    await fs.access(inputAbs)
  } catch {
    return { success: false, error: '视频文件不存在' }
  }

  const probe = await probeVideoAudioAtPath(inputAbs, options)
  if (probe.error) {
    return { success: false, error: probe.error }
  }
  if (!probe.hasAudio) {
    return { success: false, error: '视频无音轨，无法提取音频' }
  }

  const rangeResult = normalizeExtractRange(params.startSec, params.endSec, probe.durationSec)
  if (!rangeResult.ok) {
    return { success: false, error: rangeResult.error }
  }

  try {
    await fs.mkdir(path.dirname(outputAbs), { recursive: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: `无法创建输出目录：${message}` }
  }

  const ffmpegArgs = buildFfmpegExtractArgs(inputAbs, outputAbs, rangeResult.range)
  const result = await runFfmpeg(ffmpegArgs, options)
  if (!isFfmpegRunSuccess(result)) {
    return { success: false, error: formatFfmpegRunFailure(result) }
  }

  try {
    await fs.access(outputAbs)
  } catch {
    return { success: false, error: '音频提取完成但未找到输出文件' }
  }

  return { success: true, outputAbs }
}

/** 解析项目内 / dataRoot 下路径并抽音写 mp3 */
export async function extractAudio(options: {
  inputPath: string
  outputPath: string
  startSec?: number
  endSec?: number
  projectRoot?: string
  ffmpeg?: FfmpegRunOptions
}): Promise<ExtractAudioResult> {
  try {
    const { resolveReadableMediaPath, assertWritableDirUnderDataRoot } = await import(
      './ipc-path-security'
    )
    const inputAbs = await resolveReadableMediaPath(options.inputPath, {
      projectRoot: options.projectRoot,
    })

    let outputCandidate = String(options.outputPath || '').trim()
    if (options.projectRoot && !path.isAbsolute(outputCandidate)) {
      outputCandidate = path.join(
        options.projectRoot,
        outputCandidate.replace(/\\/g, '/'),
      )
    }
    const outputAbs = await resolveReadableMediaPath(outputCandidate, {
      projectRoot: options.projectRoot,
    })
    await assertWritableDirUnderDataRoot(path.dirname(outputAbs))

    return extractAudioAtPath(
      {
        inputAbs,
        outputAbs,
        startSec: options.startSec,
        endSec: options.endSec,
      },
      options.ffmpeg,
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}
