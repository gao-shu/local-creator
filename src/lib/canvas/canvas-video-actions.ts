// Copyright (c) local-creator contributors. All rights reserved.

import { toast } from 'sonner'
import { resolveCanvasMediaProjectRoot } from '@/lib/canvas/canvas-media-resolve'
import { revealPathInExplorer } from '@/lib/storage/fs-service'
import {
  isRemoteMediaReference,
  resolveProjectMediaPath,
} from '@/lib/storage/media-path-resolver'
import type { CanvasMediaOwnerKind } from '@/types/canvas-nodes'

/** 触发浏览器/Electron 下载当前预览视频 */
export function downloadVideoPreview(previewSrc: string, filename?: string): void {
  const src = String(previewSrc || '').trim()
  if (!src) return

  const name = filename || `canvas-video-${Date.now()}.mp4`

  const anchor = document.createElement('a')
  anchor.href = src
  anchor.download = name
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

/** 在系统文件管理器中定位画布视频文件 */
export async function revealCanvasVideoInExplorer(options: {
  storedPath?: string
  canvasProjectId: string
  ownerKind?: CanvasMediaOwnerKind
  ownerProjectId?: string
}): Promise<void> {
  const storedPath = String(options.storedPath || '').trim()
  if (!storedPath || storedPath.startsWith('preview:')) {
    toast.error('当前没有可打开的视频文件')
    return
  }

  const projectRoot = await resolveCanvasMediaProjectRoot(options.canvasProjectId, {
    ownerKind: options.ownerKind,
    ownerProjectId: options.ownerProjectId,
  })

  const absolutePath = projectRoot
    ? resolveProjectMediaPath(storedPath, projectRoot)
    : storedPath
  if (!absolutePath || isRemoteMediaReference(absolutePath)) {
    toast.error('远程视频暂不支持打开本地文件夹')
    return
  }

  const result = await revealPathInExplorer(absolutePath, { revealFile: true })
  if (!result.success) {
    toast.error(result.error || '打开文件位置失败')
  }
}
