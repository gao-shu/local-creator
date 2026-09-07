import { resolveVideoPreviewSrc } from '@/lib/storage/fs-service'
import { resolveVideoThumbnailSrc } from '@/lib/video/capture-video-frame'

const previewUrlCache = new Map<string, string>()
const thumbnailCache = new Map<string, string>()

function storedPathKey(storedPath: string, projectRoot?: string): string {
  return `${projectRoot || ''}::${storedPath}`
}

export async function getCachedVideoPreviewSrc(
  storedPath: string,
  projectRoot?: string,
): Promise<string | null> {
  const key = storedPathKey(storedPath, projectRoot)
  const cached = previewUrlCache.get(key)
  if (cached) return cached
  const url = await resolveVideoPreviewSrc(storedPath, projectRoot)
  if (url) previewUrlCache.set(key, url)
  return url
}

export async function getCachedVideoThumbnail(previewSrc: string): Promise<string | null> {
  const key = String(previewSrc || '').trim()
  if (!key) return null
  const cached = thumbnailCache.get(key)
  if (cached) return cached
  const thumb = await resolveVideoThumbnailSrc(key)
  if (thumb) thumbnailCache.set(key, thumb)
  return thumb
}

/** 同步读取已缓存封面（不触发解码） */
export function peekVideoThumbnailCache(previewSrc: string): string | null {
  const key = String(previewSrc || '').trim()
  if (!key) return null
  return thumbnailCache.get(key) || null
}

export function primeVideoPreviewCache(
  storedPath: string,
  projectRoot: string | undefined,
  previewSrc: string,
): void {
  previewUrlCache.set(storedPathKey(storedPath, projectRoot), previewSrc)
}

export function primeVideoThumbnailCache(previewSrc: string, thumbnail: string): void {
  const key = String(previewSrc || '').trim()
  if (key && thumbnail) thumbnailCache.set(key, thumbnail)
}
