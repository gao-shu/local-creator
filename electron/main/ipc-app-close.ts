// Copyright (c) Haode AI. All rights reserved.

import { app, BrowserWindow, ipcMain } from 'electron'

let quitting = false
let closePromptSent = false

function getPrimaryWindow(getWindow: () => BrowserWindow | null): BrowserWindow | null {
  const focused = BrowserWindow.getFocusedWindow()
  if (focused && !focused.isDestroyed()) return focused
  const win = getWindow()
  if (win && !win.isDestroyed()) return win
  const first = BrowserWindow.getAllWindows().find((item) => !item.isDestroyed())
  return first ?? null
}

function requestClosePrompt(getWindow: () => BrowserWindow | null): void {
  if (quitting || closePromptSent) return
  const win = getPrimaryWindow(getWindow)
  if (!win) {
    quitting = true
    app.quit()
    return
  }
  closePromptSent = true
  win.webContents.send('app:close-request')
}

export function registerAppCloseGuard(getWindow: () => BrowserWindow | null): void {
  ipcMain.on('app:close-decision', (_event, allow: boolean) => {
    closePromptSent = false
    if (!allow) return
    quitting = true
    app.quit()
  })

  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    requestClosePrompt(getWindow)
  })
}

export function bindWindowCloseGuard(
  window: BrowserWindow,
  getWindow: () => BrowserWindow | null,
): void {
  window.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    requestClosePrompt(getWindow)
  })
}
