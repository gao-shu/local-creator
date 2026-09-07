// Copyright (c) local-creator contributors. All rights reserved.

/**
 * 豆包网页侧栏 BrowserView 生命周期（阶段 2.3）。
 * 关闭 = hide（removeBrowserView），保留 persist:aiweb-doubao session。
 */
import { app, BrowserView, shell, type BrowserWindow } from 'electron'
import {
  DOUBAO_CHAT_URL,
  DOUBAO_WEB_PARTITION,
} from '../../src/constants/doubao-web-panel'
import type { DoubaoWebPanelBounds } from '../../src/types/doubao-web-panel'

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

let view: BrowserView | null = null
let hostWindow: BrowserWindow | null = null
let panelOpen = false
let panelBounds: DoubaoWebPanelBounds | null = null
let loadedUrl: string | null = null
let windowHooksBound = false
let quitHookBound = false

function isDoubaoUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host === 'doubao.com' || host.endsWith('.doubao.com')
  } catch {
    return false
  }
}

function resolveBounds(win: BrowserWindow): DoubaoWebPanelBounds {
  // 无 renderer 推送的占位前保持零尺寸，避免盖住顶栏
  if (panelBounds && panelBounds.width > 0 && panelBounds.height > 0) {
    return { ...panelBounds }
  }
  void win
  return { x: 0, y: 0, width: 0, height: 0 }
}

function ensureView(win: BrowserWindow): BrowserView {
  if (view) return view

  view = new BrowserView({
    webPreferences: {
      partition: DOUBAO_WEB_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const wc = view.webContents
  wc.setUserAgent(CHROME_UA)

  wc.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  wc.on('will-navigate', (event, url) => {
    if (isDoubaoUrl(url)) return
    if (url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault()
      void shell.openExternal(url)
    }
  })

  bindWindowHooks(win)
  bindQuitHook()
  return view
}

function bindWindowHooks(win: BrowserWindow): void {
  if (windowHooksBound && hostWindow === win) return
  windowHooksBound = true
  hostWindow = win

  const reapply = () => {
    if (!panelOpen || !view || win.isDestroyed()) return
    const next = resolveBounds(win)
    view.setBounds(next)
  }

  win.on('resize', reapply)
  win.on('move', reapply)
  win.on('closed', () => {
    hidePanel(win)
    // 窗口销毁时仍保留 View 实例 + session；下次 open 挂到新窗
    hostWindow = null
    windowHooksBound = false
  })
}

function bindQuitHook(): void {
  if (quitHookBound) return
  quitHookBound = true
  app.on('before-quit', () => {
    destroyPanel()
  })
}

function attach(win: BrowserWindow, next: BrowserView): void {
  hostWindow = win
  // 单 View：setBrowserView；hide 用 removeBrowserView
  win.setBrowserView(next)
  next.setBounds(resolveBounds(win))
}

async function loadChatIfNeeded(next: BrowserView): Promise<void> {
  if (loadedUrl === DOUBAO_CHAT_URL) return
  await next.webContents.loadURL(DOUBAO_CHAT_URL)
  loadedUrl = DOUBAO_CHAT_URL
}

export function getDoubaoWebPanelState(): {
  open: boolean
  bounds: DoubaoWebPanelBounds | null
} {
  return {
    open: panelOpen,
    bounds: panelBounds ? { ...panelBounds } : null,
  }
}

export async function openDoubaoWebPanel(win: BrowserWindow): Promise<void> {
  if (win.isDestroyed()) {
    throw new Error('Main window is destroyed')
  }
  const next = ensureView(win)
  bindWindowHooks(win)
  attach(win, next)
  panelOpen = true
  // 不阻塞 IPC：网页加载慢时侧栏壳应先出现
  void loadChatIfNeeded(next).catch((err) => {
    console.warn('[doubao-web-panel] loadURL failed:', err)
  })
}

export function hideDoubaoWebPanel(win: BrowserWindow | null): void {
  hidePanel(win)
}

function hidePanel(win: BrowserWindow | null): void {
  panelOpen = false
  const target = win && !win.isDestroyed() ? win : hostWindow
  if (view && target && !target.isDestroyed()) {
    try {
      target.removeBrowserView(view)
    } catch {
      /* ignore */
    }
  }
}

export async function toggleDoubaoWebPanel(win: BrowserWindow): Promise<boolean> {
  if (panelOpen) {
    hidePanel(win)
    return false
  }
  await openDoubaoWebPanel(win)
  return true
}

export function setDoubaoWebPanelBounds(
  win: BrowserWindow | null,
  bounds: DoubaoWebPanelBounds,
): void {
  panelBounds = {
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  }
  if (!panelOpen || !view) return
  const target = win && !win.isDestroyed() ? win : hostWindow
  if (!target || target.isDestroyed()) return
  view.setBounds({ ...panelBounds })
}

/**
 * 系统默认浏览器打开豆包聊天页。
 * 不改变内嵌侧栏 open/bounds，也不销毁 BrowserView session。
 */
export async function openDoubaoWebPanelExternal(): Promise<void> {
  await shell.openExternal(DOUBAO_CHAT_URL)
}

export function destroyPanel(): void {
  panelOpen = false
  loadedUrl = null
  if (view) {
    const target = hostWindow && !hostWindow.isDestroyed() ? hostWindow : null
    if (target) {
      try {
        target.removeBrowserView(view)
      } catch {
        /* ignore */
      }
    }
    try {
      if (!view.webContents.isDestroyed()) {
        view.webContents.close()
      }
    } catch {
      /* ignore */
    }
    view = null
  }
  hostWindow = null
}
