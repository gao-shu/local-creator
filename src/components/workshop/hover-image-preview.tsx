import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ReviewShieldBadge } from '@/components/workshop/review-shield-badge'
import { cn } from '@/lib/utils'

const PREVIEW_MAX_W = 480
const PREVIEW_MAX_H = 420
const PREVIEW_MARGIN = 8

export interface HoverImagePreviewOverlay {
  reviewTitle?: string
  reviewLabel?: string
}

export interface HoverImagePreviewState {
  url: string
  x: number
  y: number
  overlay?: HoverImagePreviewOverlay
  /** 画镜风格：名称 + 类型标签 */
  meta?: {
    name: string
    handle?: string
    kindLabel?: string
  }
}

export function clampHoverPreviewPosition(
  rect: DOMRect,
  size: { width: number; height: number } = { width: PREVIEW_MAX_W, height: PREVIEW_MAX_H },
): { x: number; y: number } {
  let x = rect.left
  let y = rect.bottom + 8
  if (x + size.width > window.innerWidth - PREVIEW_MARGIN) {
    x = Math.max(PREVIEW_MARGIN, window.innerWidth - size.width - PREVIEW_MARGIN)
  }
  if (y + size.height > window.innerHeight - PREVIEW_MARGIN) {
    y = Math.max(PREVIEW_MARGIN, rect.top - size.height - 8)
  }
  return { x, y }
}

export function HoverImagePreviewPortal({
  preview,
  zIndex = 10000,
}: {
  preview: HoverImagePreviewState | null
  zIndex?: number
}) {
  if (!preview) return null
  const overlay = preview.overlay
  const meta = preview.meta
  const compact = Boolean(meta)
  return createPortal(
    <div
      className={cn(
        'fixed pointer-events-none overflow-hidden border border-white/10 bg-[#1c1c1f] shadow-[0_8px_24px_rgba(0,0,0,0.45)]',
        compact ? 'rounded-[10px]' : 'rounded-lg bg-black/95 shadow-2xl',
      )}
      style={{ left: preview.x, top: preview.y, zIndex }}
    >
      {compact ? (
        <div className="flex flex-col items-center gap-2 p-2.5">
          <div className="relative overflow-hidden rounded-lg">
            <img
              src={preview.url}
              alt=""
              className="block h-[120px] w-[120px] object-cover"
            />
            {overlay?.reviewLabel ? (
              <ReviewShieldBadge
                variant="ribbon"
                state="approved"
                title={overlay.reviewTitle}
                label={overlay.reviewLabel}
              />
            ) : null}
          </div>
          <div className="flex max-w-[140px] flex-col items-center gap-0.5 text-center">
            <p className="truncate text-[13px] font-semibold text-white/92">{meta!.name}</p>
            {meta!.kindLabel ? (
              <span className="mt-0.5 rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold text-white/55">
                {meta!.kindLabel}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="relative">
          <img
            src={preview.url}
            alt=""
            className="block max-h-[420px] max-w-[480px] h-auto w-auto object-contain"
          />
          {overlay?.reviewLabel ? (
            <ReviewShieldBadge
              variant="ribbon"
              state="approved"
              title={overlay.reviewTitle}
              label={overlay.reviewLabel}
            />
          ) : null}
        </div>
      )}
    </div>,
    document.body,
  )
}

export function useHoverImagePreview(delayMs = 150) {
  const [preview, setPreview] = useState<HoverImagePreviewState | null>(null)
  const timerRef = useRef<number | null>(null)

  const show = useCallback(
    (
      url: string,
      rect: DOMRect,
      overlay?: HoverImagePreviewOverlay,
      meta?: HoverImagePreviewState['meta'],
    ) => {
      window.clearTimeout(timerRef.current ?? undefined)
      const anchor = clampHoverPreviewPosition(
        rect,
        meta ? { width: 156, height: 196 } : undefined,
      )
      timerRef.current = window.setTimeout(() => {
        setPreview({ url, ...anchor, overlay, meta })
      }, delayMs)
    },
    [delayMs],
  )

  const hide = useCallback(() => {
    window.clearTimeout(timerRef.current ?? undefined)
    setPreview(null)
  }, [])

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current ?? undefined)
    }
  }, [])

  return { preview, show, hide }
}
