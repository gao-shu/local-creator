// Copyright (c) local-creator contributors. All rights reserved.

import { loadImageElement } from '@/lib/toolbox/image-crop'

/** 画布图片一键压缩默认上限：5MB */
export const DEFAULT_CANVAS_IMAGE_COMPRESS_TARGET_MB = 5

export const CANVAS_IMAGE_COMPRESS_TARGET_MB_PRESETS = [3, 5, 10] as const

export type CanvasImageCompressTargetMb = (typeof CANVAS_IMAGE_COMPRESS_TARGET_MB_PRESETS)[number]

export const CANVAS_IMAGE_COMPRESS_TARGET_BYTES =
  DEFAULT_CANVAS_IMAGE_COMPRESS_TARGET_MB * 1024 * 1024

export function normalizeCanvasImageCompressTargetMb(
  value: unknown,
): CanvasImageCompressTargetMb {
  const numeric = Number(value)
  if (CANVAS_IMAGE_COMPRESS_TARGET_MB_PRESETS.includes(numeric as CanvasImageCompressTargetMb)) {
    return numeric as CanvasImageCompressTargetMb
  }
  return DEFAULT_CANVAS_IMAGE_COMPRESS_TARGET_MB
}

export function resolveCanvasImageCompressTargetBytes(targetMb?: number): number {
  return normalizeCanvasImageCompressTargetMb(targetMb) * 1024 * 1024
}

export function formatCanvasImageCompressTargetLabel(targetMb: number): string {
  return `${normalizeCanvasImageCompressTargetMb(targetMb)}MB`
}

export interface CompressImageDataUrlResult {
  dataUrl: string
  beforeBytes: number
  afterBytes: number
  /** 是否实际做了压缩（原图已低于上限时为 false） */
  compressed: boolean
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const trimmed = String(dataUrl || '').trim()
  if (!trimmed.startsWith('data:')) return 0
  const base64 = trimmed.split(',')[1] || ''
  if (!base64) return 0
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

export function formatImageByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function sampleImageHasAlpha(img: HTMLImageElement): boolean {
  const width = Math.min(48, img.naturalWidth)
  const height = Math.min(48, img.naturalHeight)
  if (width <= 0 || height <= 0) return false

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  ctx.drawImage(img, 0, 0, width, height)
  const pixels = ctx.getImageData(0, 0, width, height).data
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < 250) return true
  }
  return false
}

function renderScaledImage(
  img: HTMLImageElement,
  scale: number,
  mimeType: 'image/jpeg' | 'image/webp',
  quality: number,
): string {
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')

  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL(mimeType, quality)
}

/** data URL / local-image / http(s) 均可估大小（非 data 时 fetch blob） */
async function resolveSourceImageBytes(src: string): Promise<number> {
  const dataBytes = estimateDataUrlBytes(src)
  if (dataBytes > 0) return dataBytes
  try {
    const res = await fetch(src)
    if (!res.ok) return 0
    const blob = await res.blob()
    return blob.size > 0 ? blob.size : 0
  } catch {
    return 0
  }
}

/**
 * 将预览图压缩到指定字节上限（默认 5MB）。
 * 支持 data URL、local-image://、http(s)；产出仍为 data URL。
 * 策略：优先调整 JPEG/WebP 质量，仍超限则逐步缩小尺寸。
 */
export async function compressImageDataUrlToMaxBytes(
  sourceDataUrl: string,
  maxBytes: number = CANVAS_IMAGE_COMPRESS_TARGET_BYTES,
): Promise<CompressImageDataUrlResult> {
  const trimmed = String(sourceDataUrl || '').trim()
  if (!trimmed) {
    throw new Error('缺少可压缩的图片数据')
  }
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new Error('压缩目标大小无效')
  }

  const beforeBytes = await resolveSourceImageBytes(trimmed)
  if (beforeBytes > 0 && beforeBytes <= maxBytes) {
    return {
      dataUrl: trimmed.startsWith('data:') ? trimmed : '',
      beforeBytes,
      afterBytes: beforeBytes,
      compressed: false,
    }
  }

  const img = await loadImageElement(trimmed)
  const mimeType: 'image/jpeg' | 'image/webp' = sampleImageHasAlpha(img) ? 'image/webp' : 'image/jpeg'

  let bestDataUrl = ''
  let bestBytes = beforeBytes > 0 ? beforeBytes : Number.POSITIVE_INFINITY

  for (let scale = 1; scale >= 0.35; scale *= 0.88) {
    for (let quality = 0.92; quality >= 0.45; quality -= 0.07) {
      const candidate = renderScaledImage(img, scale, mimeType, quality)
      const candidateBytes = estimateDataUrlBytes(candidate)
      if (candidateBytes <= 0) continue

      if (candidateBytes < bestBytes) {
        bestBytes = candidateBytes
        bestDataUrl = candidate
      }
      if (candidateBytes <= maxBytes) {
        return {
          dataUrl: candidate,
          beforeBytes: beforeBytes || candidateBytes,
          afterBytes: candidateBytes,
          compressed: true,
        }
      }
    }
  }

  if (bestDataUrl && bestBytes <= maxBytes) {
    return {
      dataUrl: bestDataUrl,
      beforeBytes: beforeBytes || bestBytes,
      afterBytes: bestBytes,
      compressed: true,
    }
  }

  throw new Error(`无法压缩到 ${formatImageByteSize(maxBytes)} 以内，请尝试裁剪后再压缩`)
}
