// Copyright (c) local-creator contributors. All rights reserved.

export interface CropAspectPreset {
  id: string
  label: string
  w: number
  h: number
}

export const CROP_ASPECT_PRESETS: CropAspectPreset[] = [
  { id: '16:9', label: '16:9 横屏', w: 16, h: 9 },
  { id: '9:16', label: '9:16 竖屏', w: 9, h: 16 },
  { id: '1:1', label: '1:1 方形', w: 1, h: 1 },
  { id: '4:3', label: '4:3', w: 4, h: 3 },
]

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = dataUrl
  })
}

/** 居中裁剪：coverage 越小裁剪区域越小（更「放大」主体） */
export function computeCenterCropRect(
  imageWidth: number,
  imageHeight: number,
  aspectW: number,
  aspectH: number,
  coverage = 1,
): CropRect {
  const targetRatio = aspectW / aspectH
  const imageRatio = imageWidth / imageHeight

  let cropWidth = imageWidth
  let cropHeight = imageHeight

  if (imageRatio > targetRatio) {
    cropWidth = imageHeight * targetRatio
  } else {
    cropHeight = imageWidth / targetRatio
  }

  const scale = Math.max(0.2, Math.min(1, coverage))
  cropWidth *= scale
  cropHeight *= scale

  return {
    x: Math.round((imageWidth - cropWidth) / 2),
    y: Math.round((imageHeight - cropHeight) / 2),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  }
}

export async function cropImageDataUrl(
  sourceDataUrl: string,
  aspectW: number,
  aspectH: number,
  coverage = 1,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png',
): Promise<string> {
  const img = await loadImageElement(sourceDataUrl)
  const rect = computeCenterCropRect(img.naturalWidth, img.naturalHeight, aspectW, aspectH, coverage)

  const canvas = document.createElement('canvas')
  canvas.width = rect.width
  canvas.height = rect.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')

  ctx.drawImage(
    img,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height,
  )

  return canvas.toDataURL(mimeType, mimeType === 'image/jpeg' ? 0.92 : undefined)
}
