// Copyright (c) Haode AI. All rights reserved.

/**
 * Electron `webContents.startDrag` 拖到剪映时，若未落到外部应用而松手在本窗口，
 * 会触发 Files drop，被画布误当成「导入新媒体」。用会话标记跳过这类导入。
 */

let nativeVideoDragActive = false
let suppressCanvasFileDropUntil = 0

const SUPPRESS_GRACE_MS = 600

export function beginNativeVideoDragSession(): void {
  nativeVideoDragActive = true
  suppressCanvasFileDropUntil = 0
}

export function endNativeVideoDragSession(): void {
  if (!nativeVideoDragActive) return
  nativeVideoDragActive = false
  suppressCanvasFileDropUntil = Date.now() + SUPPRESS_GRACE_MS
}

/** 是否应忽略画布对 Files drop 的导入（剪映拖拽会话中或刚结束） */
export function shouldSuppressCanvasFileDropFromNativeVideoDrag(): boolean {
  return nativeVideoDragActive || Date.now() < suppressCanvasFileDropUntil
}
