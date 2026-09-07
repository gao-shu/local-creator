// Copyright (c) local-creator contributors. All rights reserved.

import { useEffect, useState, type RefObject } from 'react'

/** 视口外扩边距（px），减少刚滚出就卸载 / 刚滚入才加载的闪烁 */
export const CANVAS_NODE_NEAR_VIEWPORT_MARGIN_PX = 420

/**
 * 离开视口后仍保持已加载视频的时间，避免拖动画布时反复卸 src 重载。
 * 超时后再卸，减轻长期占解码器。
 */
export const CANVAS_VIDEO_KEEP_WARM_AFTER_LEAVE_MS = 45_000

export interface UseCanvasNodeNearViewportOptions {
  /** 视口四周外扩，默认 {@link CANVAS_NODE_NEAR_VIEWPORT_MARGIN_PX} */
  rootMarginPx?: number
  /**
   * 为 false 时不观察，恒为 true（不做门控）。
   * 默认 true。
   */
  enabled?: boolean
}

/**
 * 判断画布节点 DOM 是否接近浏览器可视区域。
 * 供视频/图片按需加载：Phase 3 将 `isNearViewport` 接到媒体 `enabled`。
 *
 * 使用 IntersectionObserver（相对视口），带 rootMargin，不依赖 React Flow store。
 * 传入节点根 `ref`（如控制台 dismiss 返回的 `nodeRootRef`）。
 */
export function useCanvasNodeNearViewport(
  targetRef: RefObject<Element | null>,
  options?: UseCanvasNodeNearViewportOptions,
): boolean {
  const enabled = options?.enabled !== false
  const rootMarginPx = options?.rootMarginPx ?? CANVAS_NODE_NEAR_VIEWPORT_MARGIN_PX
  const [isNearViewport, setIsNearViewport] = useState(!enabled ? true : false)

  useEffect(() => {
    if (!enabled) {
      setIsNearViewport(true)
      return
    }

    let cancelled = false
    let observer: IntersectionObserver | null = null
    let rafId = 0
    let tries = 0

    const attach = () => {
      if (cancelled) return
      const el = targetRef.current
      if (!el) {
        // 节点根 ref 可能晚一帧挂上
        if (tries++ < 30) {
          rafId = window.requestAnimationFrame(attach)
        } else {
          // 拿不到 DOM 时保守放行，避免永久不加载
          setIsNearViewport(true)
        }
        return
      }

      if (typeof IntersectionObserver === 'undefined') {
        setIsNearViewport(true)
        return
      }

      const margin = Math.max(0, Math.round(rootMarginPx))
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          if (!entry || cancelled) return
          setIsNearViewport(entry.isIntersecting)
        },
        {
          root: null,
          rootMargin: `${margin}px`,
          threshold: 0,
        },
      )
      observer.observe(el)
    }

    attach()

    return () => {
      cancelled = true
      if (rafId) window.cancelAnimationFrame(rafId)
      observer?.disconnect()
    }
  }, [enabled, rootMarginPx, targetRef])

  return isNearViewport
}
