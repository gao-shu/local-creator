// Copyright (c) Haode AI. All rights reserved.

import { isSupportedScriptFile } from '@/lib/script/script-file-import'

const IMAGE_EXT_PATTERN = /\.(jpe?g|png|webp|gif|bmp|svg)(\?.*)?$/i
const VIDEO_EXT_PATTERN = /\.(mp4|webm|mov|m4v|mkv)(\?.*)?$/i

export const CANVAS_DROP_NODE_COL_GAP = 320
export const CANVAS_DROP_NODE_ROW_GAP = 380

export type CanvasDroppedMediaKind = 'image' | 'video'

export interface CanvasDroppedMediaItem {
  kind: CanvasDroppedMediaKind
  file: File
  /** Electron 从资源管理器拖入时通常带绝对路径 */
  localPath?: string
  displayName: string
}

export interface CanvasDroppedScriptItem {
  file: File
  localPath?: string
  displayName: string
}

type ElectronFile = File & { path?: string }

export function resolveElectronFilePath(file: File): string | undefined {
  const path = (file as ElectronFile).path
  return typeof path === 'string' && path.trim() ? path.trim() : undefined
}

export function deriveMediaBaseName(pathOrName: string): string {
  const base = String(pathOrName || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop() || ''
  return base.replace(/\.[^.]+$/, '').trim()
}

function isImageFile(file: File): boolean {
  if (file.type?.startsWith('image/')) return true
  const path = resolveElectronFilePath(file) || file.name
  return IMAGE_EXT_PATTERN.test(path)
}

function isVideoFile(file: File): boolean {
  if (file.type?.startsWith('video/')) return true
  const path = resolveElectronFilePath(file) || file.name
  return VIDEO_EXT_PATTERN.test(path)
}

function isScriptDropFile(file: File): boolean {
  const name = resolveElectronFilePath(file) || file.name
  return isSupportedScriptFile(name)
}

/** 从拖放 DataTransfer 收集可导入的画布图片 / 视频 */
export function collectCanvasDroppedMedia(dataTransfer: DataTransfer | null): CanvasDroppedMediaItem[] {
  if (!dataTransfer?.files?.length) return []

  const items: CanvasDroppedMediaItem[] = []
  for (const file of Array.from(dataTransfer.files)) {
    const localPath = resolveElectronFilePath(file)
    const label = deriveMediaBaseName(localPath || file.name) || file.name
    if (isImageFile(file)) {
      items.push({ kind: 'image', file, localPath, displayName: label })
      continue
    }
    if (isVideoFile(file)) {
      items.push({ kind: 'video', file, localPath, displayName: label })
    }
  }
  return items
}

/** 从拖放收集剧本/分镜稿文本文件（md/txt/docx）；不自动拆镜 */
export function collectCanvasDroppedScripts(
  dataTransfer: DataTransfer | null,
): CanvasDroppedScriptItem[] {
  if (!dataTransfer?.files?.length) return []

  const items: CanvasDroppedScriptItem[] = []
  for (const file of Array.from(dataTransfer.files)) {
    if (isImageFile(file) || isVideoFile(file)) continue
    if (!isScriptDropFile(file)) continue
    const localPath = resolveElectronFilePath(file)
    const label = deriveMediaBaseName(localPath || file.name) || file.name
    items.push({ file, localPath, displayName: label })
  }
  return items
}

export function dataTransferMayContainCanvasMedia(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false
  const types = Array.from(dataTransfer.types || [])
  return types.includes('Files')
}

export function resolveCanvasDropNodePosition(
  anchor: { x: number; y: number },
  index: number,
): { x: number; y: number } {
  const col = index % 3
  const row = Math.floor(index / 3)
  return {
    x: anchor.x + col * CANVAS_DROP_NODE_COL_GAP,
    y: anchor.y + row * CANVAS_DROP_NODE_ROW_GAP,
  }
}

export async function readDroppedImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '').trim()
      if (!result) {
        reject(new Error('无法读取图片文件'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('无法读取图片文件'))
    reader.readAsDataURL(file)
  })
}
