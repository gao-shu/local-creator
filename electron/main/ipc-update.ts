import type { BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { app, ipcMain } from 'electron'
import {
  downloadUpdateViaSession,
  pickPendingUpdateFile,
  type PendingUpdateFile,
} from './update-download'
import { resolveUpdatePublishUrl } from './update-config'

const require = createRequire(import.meta.url)

type UpdateInfoLike = {
  version?: string
  sha512?: string
  path?: string
  files?: Array<{ url?: string; sha512?: string }>
}

type AutoUpdaterLike = {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  setFeedURL: (options: { provider: string; url: string }) => void
  checkForUpdates: () => Promise<{ updateInfo?: UpdateInfoLike } | null>
  downloadUpdate: () => Promise<void>
  /** isSilent=true：NSIS /S 覆盖安装；isForceRunAfter=true：装完自动重启应用 */
  quitAndInstall: (isSilent?: boolean, isForceRunAfter?: boolean) => void
  disableDifferentialDownload?: boolean
  on: (event: string, listener: (...args: unknown[]) => void) => void
}

let autoUpdaterInstance: AutoUpdaterLike | null = null
let getMainWindow: (() => BrowserWindow | null) | null = null
let backgroundCheckStarted = false
let updateCheckInFlight: Promise<CheckUpdatesResponse> | null = null
let cachedUpdateInfo: UpdateInfoLike | null = null
let downloadedInstallerPath: string | null = null

type CheckUpdatesResponse = {
  success: boolean
  error?: string
  manualUpdateOnly?: boolean
  message?: string
  updateInfo?: UpdateInfoLike | null
}

type UpdateStatusSnapshot = {
  checking: boolean
  updateInfo: UpdateInfoLike | null
  error: string | null
  checkedAt: number
}

let updateStatusSnapshot: UpdateStatusSnapshot = {
  checking: false,
  updateInfo: null,
  error: null,
  checkedAt: 0,
}

function sendToRenderer(channel: string, payload?: unknown) {
  const win = getMainWindow?.()
  if (!win) return
  if (payload === undefined) {
    win.webContents.send(channel)
  } else {
    win.webContents.send(channel, payload)
  }
}

function loadAutoUpdater(): AutoUpdaterLike {
  const { autoUpdater } = require('electron-updater') as {
    autoUpdater: AutoUpdaterLike
  }
  return autoUpdater
}

const MAC_MANUAL_UPDATE_HINT =
  'macOS 版请从官网下载 .dmg 手动安装更新（不支持应用内自动更新）'

export function setupAutoUpdater(): AutoUpdaterLike | null {
  if (!app.isPackaged) {
    return null
  }

  if (process.platform === 'darwin') {
    return null
  }

  const publishUrl = resolveUpdatePublishUrl()
  if (!publishUrl) return null

  const autoUpdater = loadAutoUpdater()
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.disableDifferentialDownload = true
  autoUpdater.setFeedURL({ provider: 'generic', url: publishUrl })

  autoUpdater.on('checking-for-update', () => {
    sendToRenderer('update-checking')
  })

  autoUpdater.on('update-available', (info: unknown) => {
    const updateInfo = (info as UpdateInfoLike) || null
    if (!isRemoteVersionNewer(updateInfo?.version, app.getVersion())) {
      cachedUpdateInfo = null
      downloadedInstallerPath = null
      sendToRenderer('update-not-available', info)
      return
    }
    cachedUpdateInfo = updateInfo
    downloadedInstallerPath = null
    sendToRenderer('update-available', info)
  })

  autoUpdater.on('update-not-available', (info: unknown) => {
    cachedUpdateInfo = null
    downloadedInstallerPath = null
    sendToRenderer('update-not-available', info)
  })

  autoUpdater.on('download-progress', (progress: unknown) => {
    sendToRenderer('update-download-progress', progress)
  })

  autoUpdater.on('update-downloaded', (info: unknown) => {
    sendToRenderer('update-downloaded', info)
  })

  autoUpdater.on('error', (error: unknown) => {
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : '更新失败'
    sendToRenderer('update-error', message)
  })

  autoUpdaterInstance = autoUpdater
  return autoUpdater
}

function setUpdateStatusSnapshot(patch: Partial<UpdateStatusSnapshot>) {
  updateStatusSnapshot = { ...updateStatusSnapshot, ...patch }
}

async function runUpdateCheck(): Promise<CheckUpdatesResponse> {
  if (process.platform === 'darwin') {
    return { success: true, manualUpdateOnly: true, message: MAC_MANUAL_UPDATE_HINT }
  }
  if (!autoUpdaterInstance) autoUpdaterInstance = setupAutoUpdater()
  if (!autoUpdaterInstance) {
    return { success: false, error: '当前环境未启用自动更新（开发模式或未打包）' }
  }

  setUpdateStatusSnapshot({ checking: true, error: null })
  try {
    const result = await autoUpdaterInstance.checkForUpdates()
    const rawInfo = result?.updateInfo ?? null
    const currentVersion = app.getVersion()
    // electron-updater 的 updateInfo 始终来自 feed；本地已更新或 feed 滞后时需自行过滤
    const updateInfo =
      rawInfo && isRemoteVersionNewer(rawInfo.version, currentVersion) ? rawInfo : null
    cachedUpdateInfo = updateInfo
    downloadedInstallerPath = null
    setUpdateStatusSnapshot({
      checking: false,
      updateInfo,
      error: null,
      checkedAt: Date.now(),
    })
    return { success: true, updateInfo }
  } catch (error) {
    const message = errorMessage(error)
    setUpdateStatusSnapshot({
      checking: false,
      error: message,
      checkedAt: Date.now(),
    })
    return { success: false, error: message }
  }
}

/** 应用就绪后立即在后台查更，不等待渲染进程 */
export function startBackgroundUpdateCheck(): void {
  if (!app.isPackaged || process.platform === 'darwin') return
  if (backgroundCheckStarted) return
  backgroundCheckStarted = true
  if (!autoUpdaterInstance) autoUpdaterInstance = setupAutoUpdater()
  if (!autoUpdaterInstance) return
  updateCheckInFlight = runUpdateCheck().finally(() => {
    updateCheckInFlight = null
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 远程版本是否严格新于本地（相等或更旧均视为无更新） */
function isRemoteVersionNewer(remote: string | undefined, local: string): boolean {
  if (!remote?.trim() || !local?.trim()) return false
  const parse = (version: string) =>
    version
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0)
  const remoteParts = parse(remote)
  const localParts = parse(local)
  const len = Math.max(remoteParts.length, localParts.length)
  for (let i = 0; i < len; i += 1) {
    const diff = (remoteParts[i] || 0) - (localParts[i] || 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

function resolvePendingUpdateFile(): PendingUpdateFile | null {
  const feedUrl = resolveUpdatePublishUrl()
  const updateInfo = cachedUpdateInfo || updateStatusSnapshot.updateInfo
  if (!feedUrl || !updateInfo) return null
  return pickPendingUpdateFile(updateInfo, feedUrl)
}

/** 应用内更新：Chromium 下载完整安装包（速度接近浏览器） */
async function downloadUpdateFull(): Promise<void> {
  const pending = resolvePendingUpdateFile()
  if (!pending) {
    throw new Error('未找到可下载的更新包，请先检查更新')
  }

  downloadedInstallerPath = await downloadUpdateViaSession(pending, (progress) => {
    sendToRenderer('update-download-progress', progress)
  })
  sendToRenderer('update-downloaded', cachedUpdateInfo || updateStatusSnapshot.updateInfo)
}

function installDownloadedUpdate(): void {
  if (downloadedInstallerPath) {
    // 与 electron-updater NsisUpdater 一致：静默覆盖 + 装完拉起
    spawn(downloadedInstallerPath, ['--updated', '/S', '--force-run'], {
      detached: true,
      stdio: 'ignore',
    }).unref()
    app.quit()
    return
  }
  if (autoUpdaterInstance) {
    // assisted installer（oneClick=false）下默认非静默会再次弹出选用户/目录向导；
    // 升级必须 /S，并强制安装后拉起应用。
    autoUpdaterInstance.quitAndInstall(true, true)
  }
}

export function registerUpdateIpc(resolveWindow: () => BrowserWindow | null): void {
  getMainWindow = resolveWindow

  ipcMain.handle('check-for-updates', async () => {
    try {
      if (updateCheckInFlight) return updateCheckInFlight
      updateCheckInFlight = runUpdateCheck().finally(() => {
        updateCheckInFlight = null
      })
      return updateCheckInFlight
    } catch (error) {
      return { success: false, error: errorMessage(error) }
    }
  })

  ipcMain.handle('get-update-status', () => {
    return {
      success: true,
      checking: updateStatusSnapshot.checking,
      updateInfo: updateStatusSnapshot.updateInfo,
      error: updateStatusSnapshot.error,
      checkedAt: updateStatusSnapshot.checkedAt,
      currentVersion: app.getVersion(),
    }
  })

  ipcMain.handle('download-update', async () => {
    try {
      if (process.platform === 'darwin') {
        return { success: false, error: MAC_MANUAL_UPDATE_HINT }
      }
      if (!autoUpdaterInstance) autoUpdaterInstance = setupAutoUpdater()
      if (!autoUpdaterInstance) {
        return { success: false, error: '当前环境未启用自动更新' }
      }
      await downloadUpdateFull()
      return { success: true }
    } catch (error) {
      return { success: false, error: errorMessage(error) }
    }
  })

  ipcMain.handle('install-update', () => {
    installDownloadedUpdate()
    return { success: true }
  })

  ipcMain.handle('get-app-version', () => {
    return { success: true, version: app.getVersion() }
  })

  ipcMain.handle('get-update-feed-url', () => {
    return { success: true, url: resolveUpdatePublishUrl() }
  })
}
