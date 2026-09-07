// Copyright (c) local-creator contributors. All rights reserved.

import type {
  CanvasImageLightingConfig,
  CanvasImageSubjectView,
} from '@/types/canvas-image-tools'

const HORIZONTAL_LABELS: Record<NonNullable<CanvasImageSubjectView['horizontal']>, string> = {
  front: 'front view',
  left_side: 'left side view',
  right_side: 'right side view',
  back: 'back view',
  left_three_quarter: 'left three-quarter view',
  right_three_quarter: 'right three-quarter view',
}

const VERTICAL_LABELS: Record<NonNullable<CanvasImageSubjectView['vertical']>, string> = {
  eye_level: 'eye-level',
  top_down: 'slightly top-down view',
  low_angle: 'low angle view',
}

export function buildSubjectViewPrompt(view?: CanvasImageSubjectView): string {
  if (!view) return ''
  const parts: string[] = []
  if (view.horizontal) parts.push(HORIZONTAL_LABELS[view.horizontal])
  if (view.vertical) parts.push(VERTICAL_LABELS[view.vertical])
  if (view.wideAngle) parts.push('wide-angle lens')
  if (view.subjectScale && Math.abs(view.subjectScale - 1) > 0.05) {
    parts.push(`subject scale ${view.subjectScale.toFixed(1)}x`)
  }
  if (!parts.length) return ''
  const angle = parts.join(', ')
  return [
    'same scene, same composition, re-render from a new camera viewpoint while keeping subject identity and background parallax consistent',
    `camera angle: ${angle}`,
  ].join(', ')
}

export function buildLightingPrompt(config?: CanvasImageLightingConfig): string {
  if (!config) return ''
  const parts: string[] = []
  if (config.autoRelight !== false) parts.push('smart relighting')
  if (config.mainSource) {
    const map = {
      left: 'key light from camera left',
      right: 'key light from camera right',
      top: 'top lighting',
      front: 'front lighting',
      back: 'back lighting',
    } as const
    parts.push(map[config.mainSource])
  }
  const brightness = config.brightness ?? 50
  if (brightness < 35) parts.push('soft low-key lighting')
  else if (brightness > 65) parts.push('bright high-key lighting')
  else parts.push('balanced lighting intensity')

  if (config.colorTemp === 'warm') parts.push('warm golden hour tone')
  else if (config.colorTemp === 'cool') parts.push('cool daylight tone')
  else parts.push('neutral daylight')

  if (config.rimLight) parts.push('subtle rim light separation')
  if (!parts.length) return ''
  return `relight the scene with ${parts.join(', ')}`
}

export function buildErasePrompt(userPrompt?: string): string {
  const detail = String(userPrompt || '').trim() || '自然补全被擦除区域'
  return `请仅在蒙版白色区域执行擦除并自然补全，蒙版外区域保持不变。要求：${detail}`
}

export const CANVAS_IMAGE_TOOL_PROMPTS = {
  removeBackground: '去除背景，保留主体，输出干净透明感背景或纯白背景',
  hdEnhance: '4K ultra high definition, enhance details and sharpness, preserve composition',
  cutout: '去除背景',
} as const

export function mergeCanvasImagePrompt(
  basePrompt: string,
  extras: Array<string | undefined | null>,
): string {
  const local = String(basePrompt || '').trim()
  const suffix = extras.map((item) => String(item || '').trim()).filter(Boolean)
  if (!suffix.length) return local
  if (!local) return suffix.join('\n')
  return `${local}\n${suffix.join('\n')}`
}
