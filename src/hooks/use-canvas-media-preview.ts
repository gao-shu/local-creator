// Copyright (c) local-creator contributors. All rights reserved.

import { useEffect, useState } from 'react'
import type { CanvasMediaOwnerKind } from '@/types/canvas-nodes'
import {
  resolveCanvasAudioMediaProjectRoot,
  resolveCanvasMediaProjectRoot,
} from '@/lib/canvas/canvas-media-resolve'
import { resolveImagePreviewSrc } from '@/lib/storage/fs-service'

export interface CanvasMediaPreviewState {
  src: string
  /** storedPath 有值但本地预览加载失败 */
  mediaMissing: boolean
}

const EMPTY_PREVIEW: CanvasMediaPreviewState = { src: '', mediaMissing: false }

export function useCanvasImagePreview(
  storedPath?: string,
  canvasProjectId?: string,
  ownerKind?: CanvasMediaOwnerKind,
  ownerProjectId?: string,
): CanvasMediaPreviewState {
  const [state, setState] = useState<CanvasMediaPreviewState>(EMPTY_PREVIEW)

  useEffect(() => {
    let cancelled = false
    const path = String(storedPath || '').trim()
    if (!path) {
      setState(EMPTY_PREVIEW)
      return
    }
    if (path.startsWith('data:')) {
      setState({ src: path, mediaMissing: false })
      return
    }
    if (/^https?:\/\//i.test(path)) {
      setState({ src: path, mediaMissing: false })
      return
    }

    ;(async () => {
      try {
        const projectRoot = canvasProjectId
          ? await resolveCanvasMediaProjectRoot(canvasProjectId, {
              ownerKind,
              ownerProjectId,
            })
          : undefined

        // 预览走 local-image://，避免整图 Data URL 占内存拖慢大画布
        const preview = await resolveImagePreviewSrc(path, projectRoot)
        if (!cancelled) {
          setState({
            src: preview || '',
            mediaMissing: !preview,
          })
        }
      } catch {
        if (!cancelled) setState({ src: '', mediaMissing: true })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [storedPath, canvasProjectId, ownerKind, ownerProjectId])

  return state
}

export function useCanvasVideoPreview(
  storedPath?: string,
  canvasProjectId?: string,
  ownerKind?: CanvasMediaOwnerKind,
  ownerProjectId?: string,
): CanvasMediaPreviewState {
  const [state, setState] = useState<CanvasMediaPreviewState>(EMPTY_PREVIEW)

  useEffect(() => {
    let cancelled = false
    const path = String(storedPath || '').trim()
    if (!path) {
      setState(EMPTY_PREVIEW)
      return
    }
    if (path.startsWith('data:') || path.startsWith('http')) {
      setState({ src: path, mediaMissing: false })
      return
    }

    ;(async () => {
      try {
        const projectRoot = canvasProjectId
          ? await resolveCanvasMediaProjectRoot(canvasProjectId, {
              ownerKind,
              ownerProjectId,
            })
          : undefined
        const { resolveVideoPreviewSrc } = await import('@/lib/storage/fs-service')
        const preview = await resolveVideoPreviewSrc(path, projectRoot)
        if (!cancelled) {
          setState({
            src: preview || '',
            mediaMissing: !preview,
          })
        }
      } catch {
        if (!cancelled) setState({ src: '', mediaMissing: true })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [storedPath, canvasProjectId, ownerKind, ownerProjectId])

  return state
}

/** 画布音频节点：解析项目内 mp3 等为 local-image 可播放地址 */
export function useCanvasAudioPreview(
  storedPath?: string,
  canvasProjectId?: string,
  ownerKind?: CanvasMediaOwnerKind,
  ownerProjectId?: string,
): CanvasMediaPreviewState {
  const [state, setState] = useState<CanvasMediaPreviewState>(EMPTY_PREVIEW)

  useEffect(() => {
    let cancelled = false
    const path = String(storedPath || '').trim()
    if (!path) {
      setState(EMPTY_PREVIEW)
      return
    }
    if (path.startsWith('data:') || path.startsWith('http')) {
      setState({ src: path, mediaMissing: false })
      return
    }

    ;(async () => {
      try {
        const projectRoot = canvasProjectId
          ? await resolveCanvasAudioMediaProjectRoot(canvasProjectId, path, {
              ownerKind,
              ownerProjectId,
            })
          : undefined
        const { resolveAudioPreviewSrc } = await import('@/lib/storage/fs-service')
        const preview = await resolveAudioPreviewSrc(path, projectRoot)
        if (!cancelled) {
          setState({
            src: preview || '',
            mediaMissing: !preview,
          })
        }
      } catch {
        if (!cancelled) setState({ src: '', mediaMissing: true })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [storedPath, canvasProjectId, ownerKind, ownerProjectId])

  return state
}
