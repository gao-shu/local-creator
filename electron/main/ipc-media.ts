// Copyright (c) Haode AI. All rights reserved.

import { ipcMain } from 'electron'
import { extractAudio } from './ffmpeg-extract'
import { probeVideoAudio } from './ffmpeg-probe'
import type {
  MediaExtractAudioPayload,
  MediaProbeVideoAudioPayload,
  ExtractAudioResult,
  ProbeVideoAudioResult,
} from '../../src/types/media'

function bindMediaHandler<T extends unknown[]>(
  channel: string,
  handler: (...args: T) => Promise<unknown>,
) {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, handler)
}

function parseOptionalSec(value: unknown): number | undefined {
  if (value == null || value === '') return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

export function registerMediaIpc() {
  bindMediaHandler(
    'media:probe-video-audio',
    async (_event, payload: MediaProbeVideoAudioPayload) => {
      const inputPath = String(payload?.inputPath || '').trim()
      if (!inputPath) {
        return { hasAudio: false, durationSec: null, error: '缺少视频路径' } satisfies ProbeVideoAudioResult
      }
      const projectRoot = String(payload?.projectRoot || '').trim() || undefined
      return probeVideoAudio(inputPath, { projectRoot })
    },
  )

  bindMediaHandler(
    'media:extract-audio',
    async (_event, payload: MediaExtractAudioPayload) => {
      const inputPath = String(payload?.inputPath || '').trim()
      const outputPath = String(payload?.outputPath || '').trim()
      if (!inputPath) {
        return { success: false, error: '缺少视频路径' } satisfies ExtractAudioResult
      }
      if (!outputPath) {
        return { success: false, error: '缺少输出路径' } satisfies ExtractAudioResult
      }
      return extractAudio({
        inputPath,
        outputPath,
        startSec: parseOptionalSec(payload?.startSec),
        endSec: parseOptionalSec(payload?.endSec),
        projectRoot: String(payload?.projectRoot || '').trim() || undefined,
      })
    },
  )
}

// 主进程加载时即注册，避免 dev 热更新 preload 后主进程未重启导致无 handler
registerMediaIpc()
