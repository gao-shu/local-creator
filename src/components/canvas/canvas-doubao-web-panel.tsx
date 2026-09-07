// Copyright (c) 2025 好的AI. All rights reserved.

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { ExternalLink, Sparkles, X } from 'lucide-react'
import {
  DOUBAO_PANEL_WIDTH,
  DOUBAO_WEB_PANEL_HINT,
  DOUBAO_WEB_PANEL_LABEL,
  DOUBAO_WEB_PANEL_LOADING,
} from '@/constants/doubao-web-panel'
import { cn } from '@/lib/utils'

interface CanvasDoubaoWebPanelProps {
  open: boolean
  onClose: () => void
}

function pushHostBounds(el: HTMLElement | null): void {
  const api = window.doubaoWebPanelAPI
  if (!api || !el) return
  const rect = el.getBoundingClientRect()
  const width = Math.max(0, Math.round(rect.width))
  const height = Math.max(0, Math.round(rect.height))
  if (width < 2 || height < 2) return
  void api.setBounds({
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width,
    height,
  })
}

/**
 * 画布右侧「豆包」网页壳：仅标题栏 + 占位；网页由主进程 BrowserView 绘制。
 */
export function CanvasDoubaoWebPanel({ open, onClose }: CanvasDoubaoWebPanelProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  const syncBounds = useCallback(() => {
    pushHostBounds(hostRef.current)
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    syncBounds()
  }, [open, syncBounds])

  useEffect(() => {
    if (!open) return
    const el = hostRef.current
    if (!el) return

    const ro = new ResizeObserver(() => syncBounds())
    ro.observe(el)
    window.addEventListener('resize', syncBounds)
    // 布局稳定后再推一次（侧栏动画 / 字体）
    const t = window.setTimeout(syncBounds, 50)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', syncBounds)
      window.clearTimeout(t)
    }
  }, [open, syncBounds])

  const handleClose = useCallback(async () => {
    await window.doubaoWebPanelAPI?.close()
    onClose()
  }, [onClose])

  const handleExternal = useCallback(() => {
    void window.doubaoWebPanelAPI?.openExternal()
  }, [])

  if (!open) return null

  return (
    <aside
      data-testid="canvas-doubao-web-panel"
      className={cn(
        'relative z-10 flex shrink-0 flex-col overflow-hidden',
        'border-l border-border/70 dark:border-white/18',
        'bg-card/98 dark:bg-[#101218]/98',
        'shadow-[-16px_0_40px_-12px_rgba(0,0,0,0.55)]',
        'backdrop-blur-xl',
      )}
      style={{ width: DOUBAO_PANEL_WIDTH }}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-muted/25 px-3 py-2.5 dark:border-white/14 dark:bg-white/[0.04]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-sky-500" />
            <h3 className="truncate text-sm font-semibold tracking-tight">
              {DOUBAO_WEB_PANEL_LABEL}
            </h3>
          </div>
          <p
            data-testid="canvas-doubao-web-hint"
            className="mt-0.5 truncate pl-6 text-[10px] leading-snug text-muted-foreground"
            title={DOUBAO_WEB_PANEL_HINT}
          >
            {DOUBAO_WEB_PANEL_HINT}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            data-testid="canvas-doubao-web-external"
            onClick={handleExternal}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            title="浏览器打开"
            aria-label="浏览器打开"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-testid="canvas-doubao-web-close"
            onClick={() => void handleClose()}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            title="关闭"
            aria-label="关闭豆包侧栏"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* BrowserView 对准此区域；勿再嵌 iframe */}
      <div
        ref={hostRef}
        data-testid="canvas-doubao-web-host"
        className="relative min-h-0 flex-1 bg-muted/20"
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">
          {DOUBAO_WEB_PANEL_LOADING}
        </div>
      </div>
    </aside>
  )
}
