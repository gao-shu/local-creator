// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  bumpCanvasVideoPreviewLoadPriority,
  CANVAS_VIDEO_PREVIEW_LOAD_TIMEOUT_MS,
  CANVAS_VIDEO_PREVIEW_SLOT_SOFT_RELEASE_MS,
  releaseCanvasVideoPreviewLoadSlot,
  requestCanvasVideoPreviewLoadSlot,
} from '@/lib/canvas/canvas-video-preview-load-queue'

export type CanvasVideoElementLoadPhase =
  | 'idle'
  | 'queued'
  | 'loading'
  | 'ready'
  | 'error'

export interface CanvasVideoElementLoadState {
  /** 真正挂到 `<video src>` 的地址；排队中为空 */
  displaySrc: string
  phase: CanvasVideoElementLoadPhase
  errorMessage?: string
  markReady: () => void
  markError: (message?: string) => void
  retry: () => void
  /** 点击节点时可提升排队优先级 */
  boostPriority: () => void
}

/**
 * 将已解析的预览 URL 经限流后再挂到 `<video>`。
 * 同一 src 在 enabled 期间不会重复进队，避免拖动画布时闪断重载。
 */
export function useCanvasVideoElementLoad(options: {
  nodeId: string
  resolvedSrc: string
  enabled?: boolean
  /** 越高越先加载，默认 0 */
  priority?: number
}): CanvasVideoElementLoadState {
  const { nodeId, resolvedSrc, enabled = true, priority = 0 } = options
  const [displaySrc, setDisplaySrc] = useState('')
  const [phase, setPhase] = useState<CanvasVideoElementLoadPhase>('idle')
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [retryToken, setRetryToken] = useState(0)

  const holdingSlotRef = useRef(false)
  const phaseRef = useRef(phase)
  const priorityRef = useRef(priority)
  const displaySrcRef = useRef(displaySrc)
  const activeSrcRef = useRef('')
  phaseRef.current = phase
  priorityRef.current = priority
  displaySrcRef.current = displaySrc

  const releaseSlot = useCallback(() => {
    if (!holdingSlotRef.current) return
    holdingSlotRef.current = false
    releaseCanvasVideoPreviewLoadSlot(nodeId)
  }, [nodeId])

  const markReady = useCallback(() => {
    if (phaseRef.current === 'ready') return
    setPhase('ready')
    setErrorMessage(undefined)
    releaseSlot()
  }, [releaseSlot])

  const markError = useCallback(
    (message?: string) => {
      setPhase('error')
      setErrorMessage(message?.trim() || '视频预览加载失败')
      setDisplaySrc('')
      displaySrcRef.current = ''
      activeSrcRef.current = ''
      releaseSlot()
    },
    [releaseSlot],
  )

  const markErrorRef = useRef(markError)
  markErrorRef.current = markError

  const retry = useCallback(() => {
    setErrorMessage(undefined)
    setDisplaySrc('')
    displaySrcRef.current = ''
    activeSrcRef.current = ''
    setPhase('idle')
    setRetryToken((value) => value + 1)
  }, [])

  const boostPriority = useCallback(() => {
    bumpCanvasVideoPreviewLoadPriority(nodeId, Math.max(priorityRef.current, 10))
  }, [nodeId])

  useEffect(() => {
    let cancelled = false
    let softReleaseId: number | null = null
    let timeoutId: number | null = null
    const src = String(resolvedSrc || '').trim()

    if (!enabled || !src) {
      releaseSlot()
      activeSrcRef.current = ''
      setDisplaySrc('')
      displaySrcRef.current = ''
      setErrorMessage(undefined)
      setPhase('idle')
      return () => {
        cancelled = true
        releaseSlot()
      }
    }

    // 已 ready 且仍是同一地址：不重进队（避免父级重渲把正在播的视频卸掉）
    if (
      activeSrcRef.current === src &&
      displaySrcRef.current === src &&
      phaseRef.current === 'ready'
    ) {
      return () => {
        cancelled = true
      }
    }

    activeSrcRef.current = src
    releaseSlot()
    setDisplaySrc('')
    displaySrcRef.current = ''
    setErrorMessage(undefined)
    setPhase('queued')

    ;(async () => {
      await requestCanvasVideoPreviewLoadSlot(nodeId, priorityRef.current)
      if (cancelled) {
        releaseCanvasVideoPreviewLoadSlot(nodeId)
        return
      }
      holdingSlotRef.current = true
      setPhase('loading')
      setDisplaySrc(src)
      displaySrcRef.current = src

      // 限流只约束「启动」节奏：元数据或短时后即放行
      softReleaseId = window.setTimeout(() => {
        if (cancelled) return
        releaseSlot()
      }, CANVAS_VIDEO_PREVIEW_SLOT_SOFT_RELEASE_MS)

      timeoutId = window.setTimeout(() => {
        if (cancelled) return
        if (phaseRef.current === 'loading' || phaseRef.current === 'queued') {
          markErrorRef.current('视频加载超时，请点击重试')
        }
      }, CANVAS_VIDEO_PREVIEW_LOAD_TIMEOUT_MS)
    })()

    return () => {
      cancelled = true
      if (softReleaseId != null) window.clearTimeout(softReleaseId)
      if (timeoutId != null) window.clearTimeout(timeoutId)
      // 仅在真正切换 src / 关闭 / 重试时由下次 effect 清理；
      // 若 cleanup 因「同 src 跳过」的前一次加载触发，不要清 activeSrc
      releaseSlot()
    }
  }, [enabled, nodeId, releaseSlot, resolvedSrc, retryToken])

  return {
    displaySrc,
    phase,
    errorMessage,
    markReady,
    markError,
    retry,
    boostPriority,
  }
}
