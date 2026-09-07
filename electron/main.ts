import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { registerSettingsIpc } from './main/ipc-settings'
import { registerWorkflowIpc } from './main/ipc-workflow'
import { registerCanvasIpc } from './main/ipc-canvas'
import { registerMaterialsIpc } from './main/ipc-materials'
import { registerFsIpc } from './main/ipc-fs'
import './main/ipc-media'
import './main/ipc-voice'
import {
  registerLocalImageProtocol,
  registerLocalImageScheme,
} from './main/local-image-protocol'
import { registerUpdateIpc, startBackgroundUpdateCheck } from './main/ipc-update'
import { closeSplashWindow, createSplashWindow } from './main/splash-window'
import { registerVideoDragIpc } from './main/video-drag'
import { registerCapcutExportIpc } from './main/capcut-export'
import { bindWindowCloseGuard, registerAppCloseGuard } from './main/ipc-app-close'
import { registerDoubaoWebPanelIpc } from './main/ipc-doubao-web-panel'
import { applyOpenAtLogin, resolveOpenAtLogin } from './main/login-item'
import { readSettingsMerged } from './main/ipc-settings'

registerLocalImageScheme()
// 开发态故意关闭 webSecurity，控制台安全警告仅 dev 出现；打包后不会显示
if (process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}
process.env.APP_ROOT = path.join(__dirname, '../..')

export const VITE_DEV_SERVER_URL =
  process.env['ELECTRON_RENDERER_URL'] || process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(__dirname)
export const RENDERER_DIST = path.join(__dirname, '../renderer')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null = null
let splashRevealFallbackTimer: ReturnType<typeof setTimeout> | null = null

function clearSplashRevealFallback() {
  if (splashRevealFallbackTimer == null) return
  clearTimeout(splashRevealFallbackTimer)
  splashRevealFallbackTimer = null
}

function revealMainWindow() {
  closeSplashWindow()
  if (win && !win.isDestroyed() && !win.isVisible()) {
    win.show()
    win.focus()
  }
}

function scheduleSplashRevealFallback() {
  clearSplashRevealFallback()
  splashRevealFallbackTimer = setTimeout(() => {
    splashRevealFallbackTimer = null
    revealMainWindow()
  }, 30_000)
}

/** 开发态使用 build/icon.png；打包后 Windows/macOS 使用安装包内嵌图标 */
function resolveAppIconPath(): string | undefined {
  const iconPath = path.join(process.env.APP_ROOT!, 'build', 'icon.png')
  return existsSync(iconPath) ? iconPath : undefined
}

function buildWindowTitle(): string {
  const version = app.getVersion()
  const base = `好的漫创 v${version}`
  // electron-vite dev：有 VITE_DEV_SERVER_URL；打包后无此变量
  if (VITE_DEV_SERVER_URL) {
    return `${base} · 开发`
  }
  if (!app.isPackaged) {
    return `${base} · 本地未打包`
  }
  return base
}

function applyWindowTitle(window: BrowserWindow) {
  window.setTitle(buildWindowTitle())
}

function registerDevToolsShortcuts(window: BrowserWindow) {
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const reload =
      VITE_DEV_SERVER_URL &&
      (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r'))
    if (reload) {
      event.preventDefault()
      window.webContents.reload()
      return
    }
    const toggle =
      input.key === 'F12' ||
      (input.control && input.shift && input.key.toLowerCase() === 'i')
    if (!toggle) return
    event.preventDefault()
    window.webContents.toggleDevTools()
  })
}

function createWindow() {
  win = new BrowserWindow({
    title: buildWindowTitle(),
    icon: resolveAppIconPath(),
    width: 1400,
    height: 900,
    minWidth: 1280,
    minHeight: 800,
    show: false,
    backgroundColor: '#050505',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // 开发态关闭 webSecurity 便于 Vite 调试；打包后启用
      webSecurity: !VITE_DEV_SERVER_URL,
    },
  })

  win.setMenuBarVisibility(false)
  Menu.setApplicationMenu(null)
  win.on('page-title-updated', (event) => {
    event.preventDefault()
    applyWindowTitle(win!)
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (VITE_DEV_SERVER_URL && url.startsWith(VITE_DEV_SERVER_URL)) return
    if (url.startsWith('file://')) return
    if (url.startsWith('local-image:')) return
    event.preventDefault()
    shell.openExternal(url)
  })
  registerDevToolsShortcuts(win)

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  scheduleSplashRevealFallback()

  bindWindowCloseGuard(win, () => win)
}

const isE2eRun = process.env.HAODE_E2E === '1'

app.whenReady().then(() => {
  registerLocalImageProtocol()
  registerSettingsIpc()
  registerWorkflowIpc()
  registerCanvasIpc()
  registerMaterialsIpc()
  registerFsIpc()
  registerUpdateIpc(() => win)
  registerVideoDragIpc(() => win)
  registerCapcutExportIpc()
  registerDoubaoWebPanelIpc(() => win)
  registerAppCloseGuard(() => win)
  ipcMain.on('app-splash-ready', () => {
    clearSplashRevealFallback()
    revealMainWindow()
  })
  if (isE2eRun) {
    createWindow()
    revealMainWindow()
  } else {
    createSplashWindow()
    createWindow()
  }
  if (!isE2eRun) {
    startBackgroundUpdateCheck()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow()
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
