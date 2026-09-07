// Copyright (c) local-creator contributors. All rights reserved.

/**
 * 豆包网页侧栏 IPC（阶段 2.2 通道 + 2.3 BrowserView）。
 */
import { ipcMain, type BrowserWindow } from 'electron'
import type {
  DoubaoWebPanelBounds,
  DoubaoWebPanelResult,
} from '../../src/types/doubao-web-panel'
import {
  getDoubaoWebPanelState,
  hideDoubaoWebPanel,
  openDoubaoWebPanel,
  openDoubaoWebPanelExternal,
  setDoubaoWebPanelBounds,
  toggleDoubaoWebPanel,
} from './doubao-web-panel'

function snapshot(success = true, error?: string): DoubaoWebPanelResult {
  const state = getDoubaoWebPanelState()
  return {
    success,
    error,
    open: state.open,
    bounds: state.bounds,
  }
}

function isValidBounds(value: unknown): value is DoubaoWebPanelBounds {
  if (!value || typeof value !== 'object') return false
  const b = value as DoubaoWebPanelBounds
  return (
    Number.isFinite(b.x) &&
    Number.isFinite(b.y) &&
    Number.isFinite(b.width) &&
    Number.isFinite(b.height) &&
    b.width >= 0 &&
    b.height >= 0
  )
}

function requireWindow(getWindow: () => BrowserWindow | null): BrowserWindow {
  const win = getWindow()
  if (!win || win.isDestroyed()) {
    throw new Error('Main window unavailable')
  }
  return win
}

export function registerDoubaoWebPanelIpc(
  getWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle('doubao-web-panel:open', async (): Promise<DoubaoWebPanelResult> => {
    try {
      await openDoubaoWebPanel(requireWindow(getWindow))
      return snapshot()
    } catch (err) {
      return snapshot(false, err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle('doubao-web-panel:close', async (): Promise<DoubaoWebPanelResult> => {
    try {
      hideDoubaoWebPanel(getWindow())
      return snapshot()
    } catch (err) {
      return snapshot(false, err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle('doubao-web-panel:toggle', async (): Promise<DoubaoWebPanelResult> => {
    try {
      await toggleDoubaoWebPanel(requireWindow(getWindow))
      return snapshot()
    } catch (err) {
      return snapshot(false, err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(
    'doubao-web-panel:set-bounds',
    async (_event, bounds: unknown): Promise<DoubaoWebPanelResult> => {
      if (!isValidBounds(bounds)) {
        return snapshot(false, 'Invalid bounds')
      }
      try {
        setDoubaoWebPanelBounds(getWindow(), bounds)
        return snapshot()
      } catch (err) {
        return snapshot(false, err instanceof Error ? err.message : String(err))
      }
    },
  )

  ipcMain.handle('doubao-web-panel:get-state', async (): Promise<DoubaoWebPanelResult> => {
    return snapshot()
  })

  ipcMain.handle(
    'doubao-web-panel:open-external',
    async (): Promise<DoubaoWebPanelResult> => {
      try {
        // 外开兜底：不 close / 不改 bounds
        await openDoubaoWebPanelExternal()
        return snapshot()
      } catch (err) {
        return snapshot(false, err instanceof Error ? err.message : String(err))
      }
    },
  )
}
