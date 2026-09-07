// Copyright (c) local-creator contributors. All rights reserved.

import type { CanvasImageGridPreset } from '@/types/canvas-image-tools'
import { CANVAS_IMAGE_GRID_PRESETS } from '@/types/canvas-image-tools'

export interface CanvasImageGridCell {
  dataUrl: string
  row: number
  col: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('无法读取图片进行切分'))
    img.src = src
  })
}

/** 客户端宫格切图（画镜 split-grid 无后端时的本地实现） */
export async function splitCanvasImageGrid(
  previewSrc: string,
  preset: CanvasImageGridPreset,
): Promise<CanvasImageGridCell[]> {
  const { rows, cols } = CANVAS_IMAGE_GRID_PRESETS[preset]
  const img = await loadImage(previewSrc)
  const cellWidth = Math.floor(img.naturalWidth / cols)
  const cellHeight = Math.floor(img.naturalHeight / rows)
  if (!cellWidth || !cellHeight) throw new Error('图片尺寸过小，无法切分')

  const cells: CanvasImageGridCell[] = []
  const canvas = document.createElement('canvas')
  canvas.width = cellWidth
  canvas.height = cellHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建切图画布')

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      ctx.clearRect(0, 0, cellWidth, cellHeight)
      ctx.drawImage(
        img,
        col * cellWidth,
        row * cellHeight,
        cellWidth,
        cellHeight,
        0,
        0,
        cellWidth,
        cellHeight,
      )
      cells.push({
        dataUrl: canvas.toDataURL('image/png'),
        row,
        col,
      })
    }
  }
  return cells
}
