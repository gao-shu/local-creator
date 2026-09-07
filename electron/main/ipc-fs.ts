import path from 'node:path'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { readSettingsMerged } from './ipc-settings'
import {
  assertHttpFetchUrl,
  assertPathUnderDataRoot,
  assertWritableDirUnderDataRoot,
  assertWritableUserDirectory,
  normalizeLoopbackOrigin,
  resolveReadableMediaPath,
  tryParseHttpOrigin,
} from './ipc-path-security'

async function readSettingsRaw() {
  const { data } = await readSettingsMerged()
  return data
}

/** 从全局 API + 各模型 endpoint/baseUrl 收集可信 Origin（含环回归一） */
function collectTrustedDownloadOrigins(settings: {
  apiBaseUrl?: string
  llmModels?: Array<{ endpoint?: string; baseUrl?: string }>
  imageModels?: Array<{ endpoint?: string; baseUrl?: string }>
  videoModels?: Array<{ endpoint?: string; baseUrl?: string }>
}): string[] {
  const origins = new Set<string>()
  const add = (raw?: string) => {
    const origin = tryParseHttpOrigin(String(raw || '').trim())
    if (!origin) return
    origins.add(normalizeLoopbackOrigin(origin))
  }
  add(settings.apiBaseUrl)
  for (const list of [settings.llmModels, settings.imageModels, settings.videoModels]) {
    for (const model of list || []) {
      add(model.endpoint)
      add(model.baseUrl)
    }
  }
  return Array.from(origins)
}

/** 内网下载：仅放行与设置中 API/模型地址同源的源（本机 ModelDesk 等） */
async function assertDownloadUrl(
  rawUrl: string,
  _allowPrivateNetwork?: boolean,
): Promise<string> {
  const settings = await readSettingsRaw()
  const trustedOrigins = collectTrustedDownloadOrigins(settings)
  // 兼容旧调用：即使未传 allowPrivate，只要命中已配置的本机模型 endpoint 也放行
  return assertHttpFetchUrl(rawUrl, {
    allowPrivateNetwork: true,
    trustedOrigins,
    trustedApiBaseUrl: settings.apiBaseUrl,
  })
}

function toDataUrl(buffer: Buffer, ext: string) {
  const mime =
    ext === '.png'
      ? 'image/png'
      : ext === '.webp'
        ? 'image/webp'
        : ext === '.gif'
          ? 'image/gif'
          : 'image/jpeg'
  return `data:${mime};base64,${buffer.toString('base64')}`
}

async function fetchAsBuffer(
  source: string,
  headers?: Record<string, string>,
  options?: { allowPrivateNetwork?: boolean },
): Promise<Buffer> {
  if (source.startsWith('data:')) {
    const base64 = source.split(',')[1] || ''
    return Buffer.from(base64, 'base64')
  }
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const safeUrl = await assertDownloadUrl(source, options?.allowPrivateNetwork === true)
    // 成片下载：生成常很快，中转/CDN 拉文件可能较慢；5 分钟内失败可重试
    const DOWNLOAD_TIMEOUT_MS = 300_000
    try {
      const res = await fetch(safeUrl, {
        ...(headers ? { headers } : {}),
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      })
      if (!res.ok) {
        throw new Error(
          res.status === 401 || res.status === 403
            ? `下载成片鉴权失败 (${res.status})，请检查 API Key`
            : `下载失败 (${res.status})`,
        )
      }
      const buffer = Buffer.from(await res.arrayBuffer())
      if (buffer.byteLength < 64) {
        throw new Error('下载的视频文件过小，请检查鉴权或成片地址后重试')
      }
      return buffer
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string }
      const message = String(err?.message || '')
      if (
        err?.name === 'TimeoutError'
        || err?.name === 'AbortError'
        || /aborted due to timeout/i.test(message)
        || /timeout/i.test(message)
      ) {
        throw new Error('成片下载超时（已等约 5 分钟），请点击「重新下载」重试')
      }
      throw error instanceof Error ? error : new Error(message || '下载失败')
    }
  }
  const filePath = await resolveReadableMediaPath(source)
  return fs.readFile(filePath)
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov'])

function resolveDialogParent(event: Electron.IpcMainInvokeEvent) {
  const window = BrowserWindow.fromWebContents(event.sender)
  return window && !window.isDestroyed() ? window : undefined
}

function assertLocalImageSourcePath(sourcePath: string): string {
  const resolved = path.resolve(String(sourcePath || '').trim())
  if (!resolved) throw new Error('未选择图片文件')
  const ext = path.extname(resolved).toLowerCase()
  if (!IMAGE_EXTENSIONS.has(ext)) {
    throw new Error('仅支持 png / jpg / jpeg / webp / gif 图片')
  }
  return resolved
}

function assertLocalVideoSourcePath(sourcePath: string): string {
  const resolved = path.resolve(String(sourcePath || '').trim())
  if (!resolved) throw new Error('未选择视频文件')
  const ext = path.extname(resolved).toLowerCase()
  if (!VIDEO_EXTENSIONS.has(ext)) {
    throw new Error('仅支持 mp4 / webm / mov 视频')
  }
  return resolved
}

async function assertExternalReadableFile(sourcePath: string): Promise<string> {
  const resolved = path.resolve(String(sourcePath || '').trim())
  if (!resolved) throw new Error('缺少源文件路径')
  const stat = await fs.stat(resolved).catch(() => null)
  if (!stat?.isFile()) {
    throw new Error('源文件不存在或不可读')
  }
  return resolved
}

function bindFsHandler<T extends unknown[]>(
  channel: string,
  handler: (...args: T) => Promise<unknown>,
) {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, handler)
}

export function registerFsIpc() {
  bindFsHandler(
    'fs:select-image',
    async (_event, options?: { includeDataUrl?: boolean }) => {
      try {
        const result = await dialog.showOpenDialog({
          parent: resolveDialogParent(_event),
          properties: ['openFile'],
          filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
        })
        if (result.canceled || !result.filePaths[0]) {
          return { success: true, canceled: true }
        }
        const filePath = result.filePaths[0]
        if (!options?.includeDataUrl) {
          return { success: true, filePath }
        }
        const ext = path.extname(filePath).toLowerCase()
        const buffer = await fs.readFile(filePath)
        return {
          success: true,
          filePath,
          dataUrl: toDataUrl(buffer, ext),
        }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message }
      }
    },
  )

  bindFsHandler('fs:select-video', async (_event) => {
    try {
      const result = await dialog.showOpenDialog({
        parent: resolveDialogParent(_event),
        properties: ['openFile'],
        filters: [{ name: 'Videos', extensions: ['mp4', 'webm', 'mov'] }],
      })
      if (result.canceled || !result.filePaths[0]) {
        return { success: true, canceled: true }
      }
      return { success: true, filePath: result.filePaths[0] }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message }
    }
  })

  bindFsHandler('fs:select-videos', async (_event) => {
    try {
      const result = await dialog.showOpenDialog({
        parent: resolveDialogParent(_event),
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Videos', extensions: ['mp4', 'webm', 'mov'] }],
      })
      if (result.canceled || !result.filePaths.length) {
        return { success: true, canceled: true, filePaths: [] as string[] }
      }
      return { success: true, filePaths: result.filePaths }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message, filePaths: [] as string[] }
    }
  })

  bindFsHandler(
    'fs:import-local-image',
    async (
      _event,
      payload: { sourcePath: string; targetDir: string; filename?: string },
    ) => {
      try {
        const sourcePath = assertLocalImageSourcePath(payload.sourcePath)
        const safeDir = await assertWritableDirUnderDataRoot(payload.targetDir)
        const ext = path.extname(sourcePath).toLowerCase() || '.jpg'
        const filename = payload.filename || `import_${randomUUID()}${ext}`
        const filePath = path.join(safeDir, filename)
        await fs.copyFile(sourcePath, filePath)
        return { success: true, filePath }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message }
      }
    },
  )

  bindFsHandler(
    'fs:save-generated-image',
    async (
      _event,
      payload: { dataUrl: string; targetDir?: string; filename?: string },
    ) => {
      try {
        const settings = await readSettingsRaw()
        const dir = payload.targetDir?.trim() || settings.generatedImagesPath
        const safeDir = await assertWritableDirUnderDataRoot(dir)
        const filename = payload.filename || `gen_${randomUUID()}.png`
        const filePath = path.join(safeDir, filename)
        const buffer = await fetchAsBuffer(payload.dataUrl)
        await fs.writeFile(filePath, buffer)
        return {
          success: true,
          filePath,
          dataUrl: toDataUrl(buffer, path.extname(filename)),
        }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message }
      }
    },
  )

  bindFsHandler('fs:read-image-data-url', async (_event, filePath: string) => {
    try {
      const targetPath = await resolveReadableMediaPath(filePath)
      const ext = path.extname(targetPath).toLowerCase()
      const buffer = await fs.readFile(targetPath)
      return { success: true as const, dataUrl: toDataUrl(buffer, ext) }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message }
    }
  })

  bindFsHandler(
    'fs:reveal-path',
    async (_event, payload: { absolutePath: string; revealFile?: boolean }) => {
      try {
        const targetPath = await assertPathUnderDataRoot(payload.absolutePath)
        let stat = await fs.stat(targetPath).catch(() => null)
        if (!stat) {
          if (payload.revealFile) {
            return { success: false, error: '文件不存在' }
          }
          await fs.mkdir(targetPath, { recursive: true })
          stat = await fs.stat(targetPath)
        }

        if (payload.revealFile && stat.isFile()) {
          shell.showItemInFolder(targetPath)
          return { success: true }
        }

        const folderPath = stat.isDirectory() ? targetPath : path.dirname(targetPath)
        const openError = await shell.openPath(folderPath)
        if (openError) {
          return { success: false, error: openError }
        }
        return { success: true }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message }
      }
    },
  )

  bindFsHandler(
    'fs:copy-reference-audio',
    async (
      _event,
      payload: { sourcePath: string; targetDir: string; filename?: string },
    ) => {
      try {
        const sourcePath = String(payload.sourcePath || '').trim()
        const targetDir = String(payload.targetDir || '').trim()
        if (!sourcePath) return { success: false, error: '未选择音频文件' }
        if (!targetDir) return { success: false, error: '缺少目标目录' }
        const safeTargetDir = await assertWritableDirUnderDataRoot(targetDir)
        const ext = path.extname(sourcePath).toLowerCase()
        if (ext !== '.mp3' && ext !== '.wav') {
          return { success: false, error: '仅支持 mp3 / wav 格式' }
        }
        const filename = payload.filename || `ref_audio_${randomUUID()}${ext}`
        const filePath = path.join(safeTargetDir, filename)
        await fs.copyFile(sourcePath, filePath)
        return { success: true, filePath }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message }
      }
    },
  )

  bindFsHandler(
    'fs:copy-media-file',
    async (
      _event,
      payload: { sourcePath: string; targetDir: string; filename?: string; externalTarget?: boolean },
    ) => {
      try {
        const sourcePath = String(payload.sourcePath || '').trim()
        const targetDir = String(payload.targetDir || '').trim()
        if (!sourcePath) return { success: false, error: '缺少源文件路径' }
        if (!targetDir) return { success: false, error: '缺少目标目录' }
        const resolvedSource = assertLocalVideoSourcePath(
          await assertExternalReadableFile(sourcePath),
        )
        const safeTargetDir = payload.externalTarget
          ? await assertWritableUserDirectory(targetDir)
          : await assertWritableDirUnderDataRoot(targetDir)
        const ext = path.extname(resolvedSource).toLowerCase() || '.mp4'
        const filename = payload.filename || `media_${randomUUID()}${ext}`
        const filePath = path.join(safeTargetDir, filename)
        await fs.copyFile(resolvedSource, filePath)
        return { success: true, filePath }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message }
      }
    },
  )

  bindFsHandler('fs:read-audio-data-url', async (_event, filePath: string) => {
    try {
      const targetPath = await resolveReadableMediaPath(filePath)
      const ext = path.extname(targetPath).toLowerCase()
      if (ext !== '.mp3' && ext !== '.wav') {
        return { success: false as const, error: '仅支持 mp3 / wav 格式' }
      }
      const buffer = await fs.readFile(targetPath)
      const mime = ext === '.wav' ? 'audio/wav' : 'audio/mpeg'
      return {
        success: true as const,
        dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
        ext: ext.slice(1),
      }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message }
    }
  })

  bindFsHandler('fs:ensure-directories', async (_event, directories: string[]) => {
    try {
      const list = Array.isArray(directories) ? directories.filter(Boolean) : []
      for (const dir of list) {
        await assertWritableDirUnderDataRoot(dir)
      }
      return { success: true }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message }
    }
  })

  bindFsHandler(
    'fs:save-remote-file',
    async (
      _event,
      payload: {
        url: string
        targetDir?: string
        filename?: string
        headers?: Record<string, string>
        /** 仅允许下载已配置视频 API 的内网源 */
        allowPrivateNetwork?: boolean
      },
    ) => {
      try {
        const allowPrivateNetwork = payload.allowPrivateNetwork === true
        const safeUrl = await assertDownloadUrl(payload.url, allowPrivateNetwork)
        const settings = await readSettingsRaw()
        const dir = payload.targetDir?.trim() || settings.videoSavePath || settings.generatedImagesPath
        const safeDir = await assertWritableDirUnderDataRoot(dir)
        const ext = (() => {
          try {
            const pathname = new URL(safeUrl).pathname
            // /videos/{id}/content 无扩展名，默认 mp4
            if (/\/content\/?$/i.test(pathname)) return '.mp4'
            const match = pathname.match(/\.(png|jpe?g|webp|gif|mp4|webm|mov)$/i)
            if (match) {
              const found = match[0].toLowerCase()
              return found === '.jpeg' ? '.jpg' : found
            }
            return path.extname(pathname) || '.mp4'
          } catch {
            return '.mp4'
          }
        })()
        const filename = payload.filename || `video_${randomUUID()}${ext}`
        const filePath = path.join(safeDir, filename)
        const buffer = await fetchAsBuffer(safeUrl, payload.headers, { allowPrivateNetwork: true })
        await fs.writeFile(filePath, buffer)
        return { success: true, filePath }
      } catch (error: unknown) {
        const err = error as Error
        const message = String(err?.message || '下载失败')
        if (
          /aborted due to timeout/i.test(message)
          || err?.name === 'TimeoutError'
          || err?.name === 'AbortError'
        ) {
          return {
            success: false,
            error: '成片下载超时（已等约 5 分钟），请点击「重新下载」重试',
          }
        }
        return { success: false, error: message }
      }
    },
  )
}

// 主进程加载时即注册，避免 dev 热更新 preload 后主进程未重启导致无 handler
registerFsIpc()
