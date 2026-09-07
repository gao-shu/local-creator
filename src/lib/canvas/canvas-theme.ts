// Copyright (c) local-creator contributors. All rights reserved.

export interface CanvasThemeTokens {
  workflowBg: string
  dotColor: string
  edgeStroke: string
  minimapBg: string
  minimapNode: string
  minimapMask: string
  minimapMaskStroke: string
}

export const CANVAS_THEME_DARK: CanvasThemeTokens = {
  workflowBg: '#0a0b0d',
  dotColor: 'rgba(148, 163, 184, 0.32)',
  edgeStroke: 'rgba(148, 163, 184, 0.55)',
  minimapBg: '#121316',
  minimapNode: 'rgba(226, 232, 240, 0.38)',
  minimapMask: 'rgba(0, 0, 0, 0.52)',
  minimapMaskStroke: 'rgba(255, 255, 255, 0.88)',
}

export const CANVAS_THEME_LIGHT: CanvasThemeTokens = {
  workflowBg: '#f4f5f7',
  dotColor: 'rgba(100, 116, 139, 0.28)',
  edgeStroke: 'rgba(100, 116, 139, 0.42)',
  minimapBg: '#dde1e7',
  minimapNode: 'rgba(100, 116, 139, 0.62)',
  minimapMask: 'rgba(255, 255, 255, 0.58)',
  minimapMaskStroke: 'rgba(255, 255, 255, 0.96)',
}

export function resolveCanvasTheme(isDark: boolean): CanvasThemeTokens {
  return isDark ? CANVAS_THEME_DARK : CANVAS_THEME_LIGHT
}
