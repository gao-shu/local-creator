// Copyright (c) 2025 好的AI. All rights reserved.

/** BrowserView 在主窗口客户区中的矩形（物理像素，相对内容区左上） */
export interface DoubaoWebPanelBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface DoubaoWebPanelState {
  open: boolean
  bounds: DoubaoWebPanelBounds | null
}

export interface DoubaoWebPanelResult extends DoubaoWebPanelState {
  success: boolean
  error?: string
}

/** Preload → renderer：豆包网页侧栏 IPC（仅豆包，无多厂商） */
export interface DoubaoWebPanelAPI {
  open: () => Promise<DoubaoWebPanelResult>
  close: () => Promise<DoubaoWebPanelResult>
  toggle: () => Promise<DoubaoWebPanelResult>
  setBounds: (bounds: DoubaoWebPanelBounds) => Promise<DoubaoWebPanelResult>
  getState: () => Promise<DoubaoWebPanelResult>
  /** 系统浏览器打开豆包；不影响内嵌侧栏 open/bounds */
  openExternal: () => Promise<DoubaoWebPanelResult>
}
