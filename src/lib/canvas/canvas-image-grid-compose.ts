// Copyright (c) local-creator contributors. All rights reserved.

import type { CanvasImageGridPreset } from '@/types/canvas-image-tools'
import { CANVAS_IMAGE_GRID_PRESETS } from '@/types/canvas-image-tools'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('无法读取图片进行宫格合成'))
    img.src = src
  })
}

export interface ComposeCanvasImageGridOptions {
  /** data URL 或可加载的 blob/http(s) 预览地址，按阅读顺序填入 */
  imageSrcs: string[]
  preset?: CanvasImageGridPreset
  /** 单格输出边长（正方形宫格），默认 512 */
  cellSize?: number
  /** 不足格数时是否留空（黑底）；默认 true */
  allowEmptyCells?: boolean
}

/**
 * 将多张图合成为一张宫格图（切分的反向）。
 * 不足格数时剩余格留空；超过则截断。
 */
export async function composeCanvasImageGrid(
  options: ComposeCanvasImageGridOptions,
): Promise<string> {
  const preset = options.preset || '3x3'
  const { rows, cols } = CANVAS_IMAGE_GRID_PRESETS[preset]
  const total = rows * cols
  const srcs = options.imageSrcs.filter(Boolean).slice(0, total)
  if (!srcs.length) throw new Error('请至少选择一张图片')
  if (!options.allowEmptyCells && srcs.length < total) {
    throw new Error(`合成 ${CANVAS_IMAGE_GRID_PRESETS[preset].label} 需要 ${total} 张图，当前 ${srcs.length} 张`)
  }

  const cellSize = Math.max(64, Math.floor(options.cellSize || 512))
  const canvas = document.createElement('canvas')
  canvas.width = cellSize * cols
  canvas.height = cellSize * rows
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建合成画布')

  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const images = await Promise.all(srcs.map((src) => loadImage(src)))
  for (let index = 0; index < images.length; index += 1) {
    const row = Math.floor(index / cols)
    const col = index % cols
    const img = images[index]
    const scale = Math.max(cellSize / img.naturalWidth, cellSize / img.naturalHeight)
    const drawW = img.naturalWidth * scale
    const drawH = img.naturalHeight * scale
    const dx = col * cellSize + (cellSize - drawW) / 2
    const dy = row * cellSize + (cellSize - drawH) / 2
    ctx.save()
    ctx.beginPath()
    ctx.rect(col * cellSize, row * cellSize, cellSize, cellSize)
    ctx.clip()
    ctx.drawImage(img, dx, dy, drawW, drawH)
    ctx.restore()
  }

  return canvas.toDataURL('image/png')
}
