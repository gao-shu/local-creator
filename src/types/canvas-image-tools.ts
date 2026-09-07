// Copyright (c) Haode AI. All rights reserved.

/** 主体视角（对齐画镜 subjectView） */
export type CanvasSubjectHorizontal =
  | 'front'
  | 'left_side'
  | 'right_side'
  | 'back'
  | 'left_three_quarter'
  | 'right_three_quarter'

export type CanvasSubjectVertical = 'eye_level' | 'top_down' | 'low_angle'

export interface CanvasImageSubjectView {
  horizontal?: CanvasSubjectHorizontal
  vertical?: CanvasSubjectVertical
  wideAngle?: boolean
  subjectScale?: number
}

export interface CanvasImageLightingConfig {
  brightness?: number
  colorTemp?: 'warm' | 'neutral' | 'cool'
  mainSource?: 'left' | 'right' | 'top' | 'front' | 'back'
  rimLight?: boolean
  autoRelight?: boolean
}

export type CanvasImageGridPreset = '2x2' | '2x3' | '3x3' | '3x4'

export const CANVAS_IMAGE_GRID_PRESETS: Record<
  CanvasImageGridPreset,
  { rows: number; cols: number; label: string }
> = {
  '2x2': { rows: 2, cols: 2, label: '2×2' },
  '2x3': { rows: 2, cols: 3, label: '2×3' },
  '3x3': { rows: 3, cols: 3, label: '3×3' },
  '3x4': { rows: 3, cols: 4, label: '3×4' },
}
