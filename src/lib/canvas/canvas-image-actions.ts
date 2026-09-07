// Copyright (c) Haode AI. All rights reserved.

function guessImageExt(src: string, mime?: string): string {
  if (mime?.includes('jpeg') || mime?.includes('jpg') || src.startsWith('data:image/jpeg')) {
    return 'jpg'
  }
  if (mime?.includes('webp') || src.startsWith('data:image/webp')) return 'webp'
  if (mime?.includes('gif') || src.startsWith('data:image/gif')) return 'gif'
  return 'png'
}

/** 触发浏览器/Electron 下载当前预览图（支持 data URL / local-image / http(s)） */
export function downloadImagePreview(previewSrc: string, filename?: string): void {
  const src = String(previewSrc || '').trim()
  if (!src) return

  const trigger = (href: string, name: string) => {
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = name
    anchor.rel = 'noopener'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  if (src.startsWith('data:')) {
    trigger(src, filename || `canvas-image-${Date.now()}.${guessImageExt(src)}`)
    return
  }

  void (async () => {
    try {
      const res = await fetch(src)
      if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      try {
        trigger(
          objectUrl,
          filename || `canvas-image-${Date.now()}.${guessImageExt(src, blob.type)}`,
        )
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000)
      }
    } catch (error) {
      console.error('[canvas-image] download failed', error)
    }
  })()
}
