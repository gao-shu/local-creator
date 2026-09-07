// Copyright (c) local-creator contributors. All rights reserved.

import { resolveCanvasMediaProjectRoot } from '@/lib/canvas/canvas-media-resolve'
import {
  readStoredMediaAsDataUrl,
  resolveImagePreviewSrc,
} from '@/lib/storage/fs-service'
import type { MentionCandidate } from '@/lib/workflow/mention-utils'

async function resolveStoredMediaPreviewUrl(
  rawPath: string,
  options: {
    projectRoot?: string
    canvasProjectId?: string
    canvasOwnerKind?: MentionCandidate['canvasOwnerKind']
    canvasOwnerProjectId?: string
  },
): Promise<string | null> {
  const path = rawPath.trim()
  if (!path) return null
  if (path.startsWith('data:') || /^https?:\/\//i.test(path)) return path

  let projectRoot = options.projectRoot
  if (options.canvasProjectId) {
    projectRoot = await resolveCanvasMediaProjectRoot(options.canvasProjectId, {
      ownerKind: options.canvasOwnerKind,
      ownerProjectId: options.canvasOwnerProjectId,
    })
  }

  const dataUrl = await readStoredMediaAsDataUrl(path, projectRoot)
  if (dataUrl) return dataUrl
  return (await resolveImagePreviewSrc(path, projectRoot)) || null
}

/** 解析 @ 引用悬停预览图（工坊 + 画布） */
export async function resolveMentionPreviewUrl(
  candidate: MentionCandidate,
  options?: {
    projectRoot?: string
    canvasProjectId?: string
  },
): Promise<string | null> {
  if (candidate.kind === 'voice') return null

  const paths = candidate.previewPaths?.length
    ? candidate.previewPaths
    : candidate.thumbnailPath
      ? [candidate.thumbnailPath]
      : []

  for (const path of paths) {
    const url = await resolveStoredMediaPreviewUrl(path, {
      projectRoot: options?.projectRoot,
      canvasProjectId: options?.canvasProjectId,
      canvasOwnerKind: candidate.canvasOwnerKind,
      canvasOwnerProjectId: candidate.canvasOwnerProjectId,
    })
    if (url) return url
  }
  return null
}
