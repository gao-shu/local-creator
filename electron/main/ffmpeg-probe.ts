// Copyright (c) local-creator contributors. All rights reserved.

import fs from 'node:fs/promises'
import path from 'node:path'
import type { ProbeVideoAudioResult } from '../../src/types/media'
import {
  formatFfmpegRunFailure,
  isFfmpegRunSuccess,
  runFfprobe,
  type FfmpegRunOptions,
  type FfmpegRunResult,
} from './ffmpeg-runtime'

export type { ProbeVideoAudioResult }

interface FfprobeStream {
  codec_type?: string
}

interface FfprobeFormat {
  duration?: string
}

interface FfprobeJson {
  streams?: FfprobeStream[]
  format?: FfprobeFormat
}

/** 解析 ffprobe JSON（-show_format -show_streams） */
export function parseFfprobeVideoAudioPayload(raw: string): Pick<ProbeVideoAudioResult, 'hasAudio' | 'durationSec'> {
  const parsed = JSON.parse(raw) as FfprobeJson
  const streams = Array.isArray(parsed.streams) ? parsed.streams : []
  const hasAudio = streams.some((stream) => String(stream.codec_type || '').toLowerCase() === 'audio')

  let durationSec: number | null = null
  const durationRaw = parsed.format?.duration
  if (durationRaw != null && String(durationRaw).trim() !== '') {
    const value = Number(durationRaw)
    if (Number.isFinite(value) && value >= 0) {
      durationSec = value
    }
  }

  return { hasAudio, durationSec }
}

/** 调用方误传 ffmpeg 路径时，改用同目录 ffprobe */
function resolveFfprobeExecutableOptions(options?: FfmpegRunOptions): FfmpegRunOptions | undefined {
  const executablePath = options?.executablePath
  if (!executablePath) return options
  if (/ffprobe(\.exe)?$/i.test(executablePath)) return options
  if (/ffmpeg(\.exe)?$/i.test(executablePath)) {
    return {
      ...options,
      executablePath: executablePath.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1'),
    }
  }
  return options
}

/**
 * 对已校验的本地绝对路径执行 ffprobe（调用方须先走 resolveReadableMediaPath）。
 */
export async function probeVideoAudioAtPath(
  absolutePath: string,
  options?: FfmpegRunOptions,
): Promise<ProbeVideoAudioResult> {
  const resolved = path.resolve(String(absolutePath || '').trim())
  if (!resolved) {
    return { hasAudio: false, durationSec: null, error: '缺少视频路径' }
  }

  const ffprobeOptions = resolveFfprobeExecutableOptions(options)

  try {
    await fs.access(resolved)
  } catch {
    return { hasAudio: false, durationSec: null, error: '视频文件不存在' }
  }

  const ffprobeArgVariants: string[][] = [
    ['-hide_banner', '-v', 'error', '-of', 'json', '-show_format', '-show_streams', resolved],
    [
      '-hide_banner',
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      resolved,
    ],
  ]

  let lastFailure: FfmpegRunResult | null = null
  for (const args of ffprobeArgVariants) {
    const result = await runFfprobe(args, ffprobeOptions)
    if (isFfmpegRunSuccess(result)) {
      const payload = (result.stdout || '').trim()
      if (!payload) {
        return { hasAudio: false, durationSec: null, error: 'ffprobe 未返回有效数据' }
      }
      try {
        const { hasAudio, durationSec } = parseFfprobeVideoAudioPayload(payload)
        return { hasAudio, durationSec }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        return { hasAudio: false, durationSec: null, error: `解析 ffprobe 输出失败：${message}` }
      }
    }
    lastFailure = result
    const failureText = `${result.stderr}\n${result.stdout}`
    if (!/Unrecognized option 'of'|Option not found/i.test(failureText)) {
      break
    }
  }

  if (lastFailure) {
    return {
      hasAudio: false,
      durationSec: null,
      error: formatFfmpegRunFailure(lastFailure),
    }
  }

  return { hasAudio: false, durationSec: null, error: 'ffprobe 执行失败' }
}

/** 解析项目内 / dataRoot 下视频路径并探测音轨与时长 */
export async function probeVideoAudio(
  inputPath: string,
  options?: { projectRoot?: string; ffprobe?: FfmpegRunOptions },
): Promise<ProbeVideoAudioResult> {
  try {
    const { resolveReadableMediaPath } = await import('./ipc-path-security')
    const absPath = await resolveReadableMediaPath(inputPath, {
      projectRoot: options?.projectRoot,
    })
    return probeVideoAudioAtPath(absPath, options?.ffprobe)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { hasAudio: false, durationSec: null, error: message }
  }
}
