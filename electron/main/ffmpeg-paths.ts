// Copyright (c) Haode AI. All rights reserved.

/**
 * FFmpeg 可执行文件路径约定（Phase 1 · Windows 主战场）
 *
 * | 场景 | ffmpeg.exe / ffprobe.exe |
 * |------|--------------------------|
 * | 开发 `electron-vite dev` | `{repo}/vendor/ffmpeg/win/` |
 * | 打包 NSIS 安装后 | `{process.resourcesPath}/ffmpeg/win/` |
 *
 * 打包：`electron-builder.yml` → `extraResources` 将 `vendor/ffmpeg/win` 复制到 `resources/ffmpeg/win`。
 * 开发机首次：`npm run fetch:ffmpeg-win`（二进制不入 git，见 `.gitignore`）。
 *
 * Step 2 起由 `ffmpeg-runtime.ts` 调用本模块解析路径并 spawn。
 */

import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

export type FfmpegTool = 'ffmpeg' | 'ffprobe'

const FFMPEG_VENDOR_SEGMENT = 'ffmpeg'

const modulePath =
  typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url)
const require = createRequire(modulePath)

interface ElectronAppLike {
  isPackaged: boolean
  getAppPath(): string
}

function getElectronApp(): ElectronAppLike | null {
  try {
    const mod = require('electron') as { app?: ElectronAppLike }
    return mod.app ?? null
  } catch {
    return null
  }
}

function resolveRepoRootFromThisFile(): string {
  return path.resolve(path.dirname(modulePath), '../..')
}

function resolvePlatformBundleSubdir(): string {
  if (process.platform === 'win32') return 'win'
  if (process.platform === 'darwin') return 'mac'
  return 'linux'
}

function resolveExecutableFilename(tool: FfmpegTool): string {
  return process.platform === 'win32' ? `${tool}.exe` : tool
}

/** 捆绑目录（内含 ffmpeg / ffprobe 及可选 LICENSE.txt） */
export function resolveFfmpegBundleDir(): string {
  const platformDir = resolvePlatformBundleSubdir()
  const app = getElectronApp()
  if (app?.isPackaged) {
    return path.join(process.resourcesPath, FFMPEG_VENDOR_SEGMENT, platformDir)
  }
  const basePath = app ? app.getAppPath() : resolveRepoRootFromThisFile()
  return path.join(basePath, 'vendor', FFMPEG_VENDOR_SEGMENT, platformDir)
}

export function resolveFfmpegExecutable(tool: FfmpegTool): string {
  return path.join(resolveFfmpegBundleDir(), resolveExecutableFilename(tool))
}
