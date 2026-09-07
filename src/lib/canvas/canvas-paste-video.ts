// Copyright (c) Haode AI. All rights reserved.

import type { Node } from '@xyflow/react'
import { CANVAS_NODE_TYPES, type CanvasVideoNodeData } from '@/types/canvas-nodes'

export const CANVAS_PASTE_VIDEO_ACTION = '__paste_video__' as const

const VIDEO_EXT_PATTERN = /\.(mp4|webm|mov|m4v|mkv)(\?.*)?$/i
const IMAGE_EXT_PATTERN = /\.(jpe?g|png|webp|gif|bmp|svg)(\?.*)?$/i

export type CanvasPasteVideoSource =
  | { kind: 'remote'; url: string }
  | { kind: 'local'; path: string }
  | {
      kind: 'existing'
      outputPath: string
      outputOwnerKind?: CanvasVideoNodeData['outputOwnerKind']
      outputOwnerProjectId?: string
    }

export type CanvasPasteImageSource =
  | { kind: 'remote'; url: string }
  | { kind: 'local'; path: string }
  /** 截图 / 复制的位图（微信截图等） */
  | { kind: 'dataUrl'; dataUrl: string }

export type CanvasPasteFromSystem =
  | { media: 'video'; source: CanvasPasteVideoSource }
  | { media: 'image'; source: CanvasPasteImageSource }

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) {
        reject(new Error('无法读取剪贴板图片'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error('无法读取剪贴板图片'))
    reader.readAsDataURL(blob)
  })
}

/** 系统剪贴板位图 → data URL（截图 / 复制图片） */
export async function readSystemClipboardImageDataUrl(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.read) return null
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const mime = item.types.find((type) => type.startsWith('image/'))
      if (!mime) continue
      const blob = await item.getType(mime)
      if (!blob || blob.size <= 0) continue
      return await blobToDataUrl(blob)
    }
  } catch {
    return null
  }
  return null
}

function normalizeClipboardLine(text: string): string {
  return text.trim().split(/\r?\n/)[0]?.trim() || ''
}

/** file:///C:/path/video.mp4 → C:\path\video.mp4 */
function normalizeFileUri(text: string): string {
  if (!/^file:/i.test(text)) return text
  try {
    const url = new URL(text)
    let pathname = decodeURIComponent(url.pathname)
    if (/^\/[a-zA-Z]:/.test(pathname)) {
      pathname = pathname.slice(1)
    }
    return pathname.replace(/\//g, '\\')
  } catch {
    return text.replace(/^file:\/+/, '')
  }
}

function isHttpUrl(text: string): boolean {
  return /^https?:\/\//i.test(text)
}

function isLocalMediaPath(text: string, extPattern: RegExp): boolean {
  const normalized = normalizeFileUri(text)
  if (!extPattern.test(normalized)) return false
  if (/^[a-zA-Z]:\\/.test(normalized)) return true
  if (normalized.startsWith('\\\\')) return true
  if (normalized.startsWith('/') && !isHttpUrl(normalized)) return true
  return false
}

function isLocalVideoPath(text: string): boolean {
  return isLocalMediaPath(normalizeFileUri(text), VIDEO_EXT_PATTERN)
}

function isRemoteImageUrl(text: string): boolean {
  if (!isHttpUrl(text)) return false
  return IMAGE_EXT_PATTERN.test(text)
}

function isRemoteVideoUrl(text: string): boolean {
  if (!isHttpUrl(text)) return false
  if (VIDEO_EXT_PATTERN.test(text)) return true
  return /\/video/i.test(text) || /\/videos\//i.test(text) || /\/v1\/videos\//i.test(text)
}

export function resolvePasteVideoSourceFromText(text: string): CanvasPasteVideoSource | null {
  const raw = normalizeClipboardLine(text)
  if (!raw) return null

  const normalized = normalizeFileUri(raw)
  if (isRemoteVideoUrl(raw)) {
    return { kind: 'remote', url: raw }
  }
  if (isLocalVideoPath(normalized)) {
    return { kind: 'local', path: normalized }
  }
  return null
}

export function resolvePasteImageSourceFromText(text: string): CanvasPasteImageSource | null {
  const raw = normalizeClipboardLine(text)
  if (!raw) return null

  const normalized = normalizeFileUri(raw)
  if (isRemoteImageUrl(raw)) {
    return { kind: 'remote', url: raw }
  }
  if (isLocalMediaPath(normalized, IMAGE_EXT_PATTERN)) {
    return { kind: 'local', path: normalized }
  }
  return null
}

export function resolvePasteVideoSourceFromNodes(nodes: Node[]): CanvasPasteVideoSource | null {
  const videoNodes = nodes.filter((node) => node.type === CANVAS_NODE_TYPES.storyVideo)
  if (!videoNodes.length) return null

  const withOutput = videoNodes.filter((node) => {
    const path = String((node.data as CanvasVideoNodeData).outputPath || '').trim()
    return Boolean(path) && path !== 'preview:'
  })
  if (!withOutput.length) return null

  const pick = withOutput[0]
  const data = pick.data as CanvasVideoNodeData
  return {
    kind: 'existing',
    outputPath: String(data.outputPath || '').trim(),
    outputOwnerKind: data.outputOwnerKind,
    outputOwnerProjectId: data.outputOwnerProjectId,
  }
}

/** 系统剪贴板文本 → 视频来源；读不到时返回 null */
export async function readSystemClipboardText(): Promise<string> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return ''
  try {
    return await navigator.clipboard.readText()
  } catch {
    return ''
  }
}

export async function resolveCanvasPasteVideoSource(options?: {
  internalNodes?: Node[]
}): Promise<CanvasPasteVideoSource | null> {
  const fromText = resolvePasteVideoSourceFromText(await readSystemClipboardText())
  if (fromText) return fromText
  return resolvePasteVideoSourceFromNodes(options?.internalNodes ?? [])
}

/** 系统剪贴板 → 可粘贴的图片/视频（不含画布内部节点复制） */
export async function resolveCanvasPasteFromSystemClipboard(): Promise<CanvasPasteFromSystem | null> {
  const text = await readSystemClipboardText()
  const video = resolvePasteVideoSourceFromText(text)
  if (video) return { media: 'video', source: video }
  const image = resolvePasteImageSourceFromText(text)
  if (image) return { media: 'image', source: image }
  const dataUrl = await readSystemClipboardImageDataUrl()
  if (dataUrl) return { media: 'image', source: { kind: 'dataUrl', dataUrl } }
  return null
}
