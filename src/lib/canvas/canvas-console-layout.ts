// Copyright (c) Haode AI. All rights reserved.

/** 图片 / 文本节点下控制台统一宽度 */
export const CANVAS_NODE_CONSOLE_WIDTH = 648

/** 展开控制台时，上工具栏 / 下控制台与预览框的间距（px） */
export const CANVAS_NODE_CONSOLE_GAP_PX = 8

/** 相对预览容器：上工具栏锚在预览顶边之上 */
export const CANVAS_NODE_TOP_TOOLBAR_ANCHOR_STYLE = {
  left: '50%',
  transform: 'translateX(-50%)',
  bottom: '100%',
  marginBottom: CANVAS_NODE_CONSOLE_GAP_PX,
} as const

/** 相对预览容器：下控制台锚在预览底边之下 */
export const CANVAS_NODE_BOTTOM_CONSOLE_ANCHOR_STYLE = {
  left: '50%',
  transform: 'translateX(-50%)',
  top: '100%',
  marginTop: CANVAS_NODE_CONSOLE_GAP_PX,
} as const

/**
 * 展开控制台时 React Flow 节点 zIndex。
 * basic 模式下选中节点会 +1000（@xyflow SELECTED_NODE_Z），须高于该值才能盖住相邻选中节点。
 */
export const CANVAS_CONSOLE_ELEVATED_Z_INDEX = 2000

export function isCanvasConsoleElevatedZIndex(zIndex: unknown): boolean {
  return zIndex === CANVAS_CONSOLE_ELEVATED_Z_INDEX || zIndex === 1000
}

export function resolveCanvasConsoleOffsetX(nodeWidthPx: number): number {
  return (nodeWidthPx - CANVAS_NODE_CONSOLE_WIDTH) / 2
}
