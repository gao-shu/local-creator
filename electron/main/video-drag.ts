// Copyright (c) local-creator contributors. All rights reserved.

import path from 'node:path'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import { createHash } from 'node:crypto'
import { app, ipcMain, nativeImage, type BrowserWindow } from 'electron'
import {
  assertDragFilePath,
  assertHttpFetchUrl,
  assertPathUnderDataRoot,
} from './ipc-path-security'
import {
  fromLocalImageUrl,
  isLocalImageUrl,
  resolveProjectMediaPath,
} from '../../src/lib/storage/media-path-resolver'

const DRAG_DIR_NAME = 'lc-capcut-drag'

function sanitizeDragFilename(filename: string): string {
  const base = path.basename(String(filename || '').trim()) || 'video'
  return base.replace(/[^a-zA-Z0-9\u4e00-\u9fa5._-]/g, '_')
}

function inferVideoExtension(source: string, filename = ''): string {
  const fromName = path.extname(filename).toLowerCase()
  if (fromName) return fromName
  try {
    const urlExt = path.extname(new URL(source).pathname).toLowerCase()
    if (urlExt) return urlExt
  } catch {
    /* ignore */
  }
  return '.mp4'
}

function buildVideoDragFilename(sourceKey: string, filename = ''): string {
  const safeName = sanitizeDragFilename(filename)
  const ext = inferVideoExtension(sourceKey, safeName)
  const baseName = path.basename(safeName, path.extname(safeName)) || 'video'
  const hash = createHash('sha256').update(String(sourceKey || '')).digest('hex').slice(0, 12)
  return `${baseName}-${hash}${ext}`
}

async function fetchRemoteVideoBuffer(url: string): Promise<Buffer> {
  const safeUrl = assertHttpFetchUrl(url)
  const response = await fetch(safeUrl)
  if (!response.ok) throw new Error(`下载视频失败 (${response.status})`)
  return Buffer.from(await response.arrayBuffer())
}

function resolveLocalVideoPath(storedPath: string, projectRoot?: string): string {
  const trimmed = String(storedPath || '').trim()
  if (!trimmed) throw new Error('缺少视频路径')

  if (trimmed.startsWith('data:')) {
    return trimmed
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return assertHttpFetchUrl(trimmed)
  }

  if (isLocalImageUrl(trimmed)) {
    return fromLocalImageUrl(trimmed)
  }

  if (projectRoot) {
    const resolved = resolveProjectMediaPath(trimmed, projectRoot)
    if (resolved && !/^https?:\/\//i.test(resolved)) {
      return resolved
    }
  }

  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed
  }

  throw new Error('无法解析视频本地路径')
}

/** 准备可拖拽到剪映等外部应用的视频文件（复制到 temp 并缓存） */
export async function materializeVideoForNativeDrag(
  storedPath: string,
  options?: { projectRoot?: string; filename?: string },
): Promise<string> {
  const dragDir = path.join(app.getPath('temp'), DRAG_DIR_NAME)
  await fs.mkdir(dragDir, { recursive: true })

  const sourceKey = `${options?.projectRoot || ''}::${storedPath}`
  const finalName = buildVideoDragFilename(sourceKey, options?.filename)
  const targetPath = path.join(dragDir, finalName)

  if (fsSync.existsSync(targetPath)) {
    return targetPath
  }

  const localSource = resolveLocalVideoPath(storedPath, options?.projectRoot)

  if (localSource.startsWith('data:')) {
    const match = localSource.match(/^data:([^;]+);base64,(.+)$/i)
    if (!match) throw new Error('无法解析视频数据')
    await fs.writeFile(targetPath, Buffer.from(match[2], 'base64'))
    return targetPath
  }

  if (/^https?:\/\//i.test(localSource)) {
    const buffer = await fetchRemoteVideoBuffer(localSource)
    await fs.writeFile(targetPath, buffer)
    return targetPath
  }

  const safeLocalSource = await assertPathUnderDataRoot(localSource)
  if (!fsSync.existsSync(safeLocalSource)) {
    throw new Error('视频文件不存在')
  }

  await fs.copyFile(safeLocalSource, targetPath)
  return targetPath
}

export function registerVideoDragIpc(getMainWindow: () => BrowserWindow | null) {
  ipcMain.removeHandler('video:prepare-drag-source')
  ipcMain.removeHandler('video:prepare-drag-sources')
  ipcMain.removeAllListeners('video:start-drag')

  ipcMain.handle(
    'video:prepare-drag-source',
    async (
      _event,
      payload: { storedPath: string; projectRoot?: string; filename?: string },
    ) => {
      try {
        const filePath = await materializeVideoForNativeDrag(payload.storedPath, {
          projectRoot: payload.projectRoot,
          filename: payload.filename,
        })
        return { success: true, filePath }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message || '准备拖拽文件失败' }
      }
    },
  )

  ipcMain.handle(
    'video:prepare-drag-sources',
    async (
      _event,
      payload: {
        items: Array<{ storedPath: string; projectRoot?: string; filename?: string }>
      },
    ) => {
      try {
        const items = Array.isArray(payload?.items) ? payload.items : []
        if (items.length === 0) {
          return { success: false, error: '没有可拖拽的视频' }
        }
        const filePaths = await Promise.all(
          items.map((item) =>
            materializeVideoForNativeDrag(item.storedPath, {
              projectRoot: item.projectRoot,
              filename: item.filename,
            }),
          ),
        )
        return { success: true, filePaths }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message || '准备拖拽文件失败' }
      }
    },
  )

  ipcMain.on(
    'video:start-drag',
    async (_event, payload: { filePath?: string; filePaths?: string[] }) => {
      const mainWindow = getMainWindow()
      if (!mainWindow) return

      const rawPaths = Array.isArray(payload?.filePaths)
        ? payload.filePaths
        : payload?.filePath
          ? [payload.filePath]
          : []
      const filePaths = rawPaths.map((item) => String(item || '').trim()).filter(Boolean)
      if (filePaths.length === 0) return

      try {
        const safePaths = await Promise.all(filePaths.map((filePath) => assertDragFilePath(filePath)))
        const iconPath = path.join(process.env.APP_ROOT || '', 'build', 'icon.png')
        const dragIcon = fsSync.existsSync(iconPath)
          ? nativeImage.createFromPath(iconPath)
          : nativeImage.createEmpty()
        const icon = dragIcon.isEmpty() ? nativeImage.createEmpty() : dragIcon

        if (safePaths.length === 1) {
          mainWindow.webContents.startDrag({ file: safePaths[0], icon })
        } else {
          mainWindow.webContents.startDrag({ files: safePaths, icon })
        }
      } catch (error) {
        console.error('启动视频拖拽失败:', error)
      }
    },
  )
}
