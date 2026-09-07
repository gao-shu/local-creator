// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, FolderOutput, Loader2, X, Film } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VideoDragChip } from '@/components/workshop/video-drag-chip'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'
import { exportClipsToCapcutDraft } from '@/lib/capcut/capcut-export-service'
import {
  copyCanvasEpisodeVideosToDirectory,
  resolveCanvasEpisodeVideoDeliverables,
  revealCanvasEpisodeVideoDeliverable,
} from '@/lib/canvas/canvas-episode-deliverables'
import { useSettingsStore } from '@/stores/settings-store'
import type { CanvasProjectMeta } from '@/types/canvas'
import { cn } from '@/lib/utils'

export interface CanvasEpisodeExportDialogProps {
  open: boolean
  onClose: () => void
  canvasProjectId: string
  meta?: CanvasProjectMeta | null
}

/** 画布成片导出：仅列出 success 视频，无预检/连续性提示 */
export function CanvasEpisodeExportDialog({
  open,
  onClose,
  canvasProjectId,
  meta,
}: CanvasEpisodeExportDialogProps) {
  const { nodes } = useCanvasEditor()
  const settings = useSettingsStore((s) => s.settings)
  const appDataDir = useSettingsStore((s) => s.appDataDir)
  const loadSettings = useSettingsStore((s) => s.load)

  const [loading, setLoading] = useState(false)
  const [exportingCapcut, setExportingCapcut] = useState(false)
  const [copyingToDir, setCopyingToDir] = useState(false)
  const [deliverables, setDeliverables] = useState<
    Awaited<ReturnType<typeof resolveCanvasEpisodeVideoDeliverables>>
  >([])

  const canExport = !loading && deliverables.length > 0

  const episodeLabel = useMemo(() => {
    const title = meta?.title?.trim()
    return title || undefined
  }, [meta?.title])

  useEffect(() => {
    if (!open) return
    void loadSettings()
  }, [loadSettings, open])

  useEffect(() => {
    if (!open || !settings) return
    let cancelled = false
    setLoading(true)
    void resolveCanvasEpisodeVideoDeliverables({
      nodes,
      canvasProjectId,
      settings,
      appDataDir,
    })
      .then((items) => {
        if (!cancelled) setDeliverables(items)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [appDataDir, canvasProjectId, nodes, open, settings])

  const handleExportCapcutDraft = useCallback(async () => {
    if (!deliverables.length) return
    setExportingCapcut(true)
    try {
      const clips = deliverables
        .map((item) => ({
          label: item.label,
          absolutePath: item.absolutePath || item.storedPath,
        }))
        .filter((item) => item.absolutePath && !item.absolutePath.startsWith('preview:'))
      const projectName = [meta?.title, episodeLabel].filter(Boolean).join(' · ') || '画布导出'
      await exportClipsToCapcutDraft({ projectName, clips })
    } finally {
      setExportingCapcut(false)
    }
  }, [deliverables, episodeLabel, meta?.title])

  const handleCopyToDirectory = useCallback(async () => {
    if (!deliverables.length || copyingToDir || !settings) return
    setCopyingToDir(true)
    try {
      await copyCanvasEpisodeVideosToDirectory(deliverables, {
        canvasProjectId,
        settings,
        appDataDir,
      })
    } finally {
      setCopyingToDir(false)
    }
  }, [appDataDir, canvasProjectId, copyingToDir, deliverables, settings])

  if (!open) return null

  return createPortal(
    <>
      <button
        type="button"
        aria-label="关闭导出面板"
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            'pointer-events-auto flex max-h-[min(80vh,640px)] w-full max-w-lg flex-col overflow-hidden',
            'rounded-2xl border border-border/40 bg-card shadow-2xl',
          )}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border/30 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4 shrink-0 text-violet-500" />
                <h3 className="text-sm font-semibold">导出成片</h3>
              </div>
              {episodeLabel ? (
                <p className="mt-1 text-[11px] text-muted-foreground">{episodeLabel}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-[220px] flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在整理成片清单…
              </div>
            ) : deliverables.length === 0 ? (
              <div className="flex h-[180px] items-center justify-center px-4 text-center">
                <p className="text-sm text-muted-foreground">
                  暂无可导出视频，生成成功后会出现在这里
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {deliverables.map((item) => (
                  <li
                    key={item.nodeId}
                    className="rounded-xl border border-border/30 bg-background/40 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{item.label}</p>
                        <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
                          {item.absolutePath || item.storedPath}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <VideoDragChip
                          storedPath={item.absolutePath || item.storedPath}
                          filename={`${item.label.replace(/[^\w\u4e00-\u9fa5.-]+/g, '_')}.mp4`}
                          label="拖到剪映"
                          className="relative top-0 right-0 inline-flex h-7 items-center rounded-md bg-cyan-600/90 px-2 text-[10px] font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 px-2 text-[10px]"
                          onClick={() => void revealCanvasEpisodeVideoDeliverable(item)}
                        >
                          定位
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/30 px-4 py-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              data-testid="canvas-export-capcut"
              disabled={!canExport || exportingCapcut}
              onClick={() => void handleExportCapcutDraft()}
            >
              {exportingCapcut ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FolderOutput className="mr-1.5 h-3.5 w-3.5" />
              )}
              导出剪映草稿
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={!canExport || copyingToDir}
              onClick={() => void handleCopyToDirectory()}
            >
              {copyingToDir ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Copy className="mr-1.5 h-3.5 w-3.5" />
              )}
              复制到指定目录
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
