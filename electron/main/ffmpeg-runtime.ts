// Copyright (c) local-creator contributors. All rights reserved.

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import type { FfmpegTool } from './ffmpeg-paths'
import { resolveFfmpegExecutable } from './ffmpeg-paths'

const DEFAULT_FFPROBE_TIMEOUT_MS = 30_000
const DEFAULT_FFMPEG_TIMEOUT_MS = 600_000
const KILL_GRACE_MS = 3_000
const MAX_CAPTURE_BYTES = 8 * 1024 * 1024

export interface FfmpegRunOptions {
  /** 覆盖捆绑路径（仅供单测注入） */
  executablePath?: string
  timeoutMs?: number
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export interface FfmpegRunResult {
  tool: FfmpegTool
  executablePath: string
  exitCode: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  timedOut: boolean
  killed: boolean
}

function appendCapped(buffer: string, chunk: Buffer, maxBytes: number): string {
  if (buffer.length >= maxBytes) return buffer
  const next = buffer + chunk.toString('utf8')
  return next.length <= maxBytes ? next : next.slice(0, maxBytes)
}

function resolveTimeoutMs(tool: FfmpegTool, override?: number): number {
  if (override != null && override > 0) return override
  return tool === 'ffprobe' ? DEFAULT_FFPROBE_TIMEOUT_MS : DEFAULT_FFMPEG_TIMEOUT_MS
}

async function ensureExecutableExists(executablePath: string): Promise<void> {
  try {
    await fs.access(executablePath)
  } catch {
    throw new Error(
      `FFmpeg 运行时未就绪：找不到 ${executablePath}。请先执行 npm run fetch:ffmpeg-win`,
    )
  }
}

export async function assertFfmpegBundleReady(): Promise<{ ffmpeg: string; ffprobe: string }> {
  const ffmpeg = resolveFfmpegExecutable('ffmpeg')
  const ffprobe = resolveFfmpegExecutable('ffprobe')
  await ensureExecutableExists(ffmpeg)
  await ensureExecutableExists(ffprobe)
  return { ffmpeg, ffprobe }
}

export function isFfmpegRunSuccess(result: FfmpegRunResult): boolean {
  return !result.timedOut && !result.killed && result.exitCode === 0
}

/** 将 run 结果整理为面向用户的错误文案（stderr 优先） */
export function formatFfmpegRunFailure(result: FfmpegRunResult): string {
  if (result.timedOut) {
    return `${result.tool} 执行超时`
  }
  const detail = (result.stderr || result.stdout || '').trim()
  if (result.exitCode != null && result.exitCode !== 0) {
    return detail || `${result.tool} 退出码 ${result.exitCode}`
  }
  if (result.signal) {
    return detail || `${result.tool} 被信号终止: ${result.signal}`
  }
  return detail || `${result.tool} 执行失败`
}

export function runFfmpegTool(
  tool: FfmpegTool,
  args: string[],
  options: FfmpegRunOptions = {},
): Promise<FfmpegRunResult> {
  const executablePath = options.executablePath ?? resolveFfmpegExecutable(tool)

  return ensureExecutableExists(executablePath).then(
    () =>
      new Promise<FfmpegRunResult>((resolve) => {
        const timeoutMs = resolveTimeoutMs(tool, options.timeoutMs)
        let stdout = ''
        let stderr = ''
        let timedOut = false
        let killed = false
        let settled = false

        const finish = (result: FfmpegRunResult) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          clearTimeout(killTimer)
          resolve(result)
        }

        const child = spawn(executablePath, args, {
          cwd: options.cwd,
          env: options.env ?? process.env,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        let killTimer: ReturnType<typeof setTimeout> | undefined

        const timer = setTimeout(() => {
          timedOut = true
          killed = true
          child.kill('SIGTERM')
          killTimer = setTimeout(() => {
            if (!child.killed) child.kill('SIGKILL')
          }, KILL_GRACE_MS)
        }, timeoutMs)

        child.stdout?.on('data', (chunk: Buffer) => {
          stdout = appendCapped(stdout, chunk, MAX_CAPTURE_BYTES)
        })
        child.stderr?.on('data', (chunk: Buffer) => {
          stderr = appendCapped(stderr, chunk, MAX_CAPTURE_BYTES)
        })

        child.on('error', (error) => {
          finish({
            tool,
            executablePath,
            exitCode: null,
            signal: null,
            stdout,
            stderr: appendCapped(stderr, Buffer.from(`${error.message}\n`, 'utf8'), MAX_CAPTURE_BYTES),
            timedOut,
            killed,
          })
        })

        child.on('close', (exitCode, signal) => {
          finish({
            tool,
            executablePath,
            exitCode,
            signal,
            stdout,
            stderr,
            timedOut,
            killed,
          })
        })
      }),
  )
}

export function runFfprobe(args: string[], options?: FfmpegRunOptions): Promise<FfmpegRunResult> {
  return runFfmpegTool('ffprobe', args, options)
}

export function runFfmpeg(args: string[], options?: FfmpegRunOptions): Promise<FfmpegRunResult> {
  return runFfmpegTool('ffmpeg', args, options)
}
