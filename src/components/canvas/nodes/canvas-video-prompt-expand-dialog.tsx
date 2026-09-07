// Copyright (c) local-creator contributors. All rights reserved.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { MentionTextarea } from '@/components/workshop/mention-textarea'
import { Select, type SelectOption } from '@/components/ui/select'
import { CanvasGeneratePill } from '@/components/canvas/canvas-generate-pill'
import { CanvasVideoParamsPopover } from '@/components/canvas/nodes/canvas-video-params-popover'
import { CanvasVideoReferenceBar } from '@/components/canvas/nodes/canvas-video-reference-bar'
import type { CanvasUpstreamReferenceAsset } from '@/lib/canvas/canvas-graph-utils'
import type { MentionCandidate } from '@/lib/workflow/mention-utils'
import { CANVAS_NODE_COMPACT_SELECT, CANVAS_NODE_CONSOLE_TEXT } from '@/lib/canvas/canvas-node-theme'
import { cn } from '@/lib/utils'

export interface CanvasVideoPromptExpandFooterProps {
  referenceMode?: string
  referenceModeOptions?: SelectOption[]
  onReferenceModeChange?: (value: string) => void
  modelId: string
  modelOptions: SelectOption[]
  onModelChange: (value: string) => void
  durationValue: string
  durationOptions: SelectOption[]
  onDurationChange: (value: string) => void
  aspectRatio: string
  aspectOptions: SelectOption[]
  onAspectRatioChange: (value: string) => void
  resolutionValue?: string
  resolutionOptions?: SelectOption[]
  showResolution?: boolean
  onResolutionChange?: (value: string) => void
  generateTestId?: string
  running?: boolean
  generateDisabled?: boolean
  showGenerateCost?: boolean
  generateCost?: number | null
  generateCostLoading?: boolean
  onGenerate: () => void
  onStop?: () => void
}

interface CanvasVideoPromptExpandDialogProps {
  open: boolean
  value: string
  /** 二次验证空间锚点；有则只读展示，不可在此编辑 */
  spatialAnchor?: string
  placeholder?: string
  emptyHint?: string
  candidates: MentionCandidate[]
  canvasProjectId: string
  onChange: (value: string) => void
  onClose: () => void
  /** 参考图 / 自动@ / 已引用资产 */
  referenceAssets: CanvasUpstreamReferenceAsset[]
  mentionAssets: MentionCandidate[]
  autoMentionEnabled: boolean
  onAutoMentionChange: (enabled: boolean) => void
  onUploadReference?: () => void
  onRemoveUpload?: (index: number) => void
  footer: CanvasVideoPromptExpandFooterProps
}

const compactSelectClass = cn(
  'h-7 w-auto max-w-none shrink-0 border-0 px-1.5 text-[12px] shadow-none',
  CANVAS_NODE_COMPACT_SELECT,
)

/** 视频节点 Prompt 全屏编辑（含自动@、引用资产与生成参数） */
export function CanvasVideoPromptExpandDialog({
  open,
  value,
  spatialAnchor,
  placeholder,
  emptyHint,
  candidates,
  canvasProjectId,
  onChange,
  onClose,
  referenceAssets,
  mentionAssets,
  autoMentionEnabled,
  onAutoMentionChange,
  onUploadReference,
  onRemoveUpload,
  footer,
}: CanvasVideoPromptExpandDialogProps) {
  const editorAreaRef = useRef<HTMLDivElement>(null)
  const [editorAreaHeight, setEditorAreaHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setEditorAreaHeight(null)
      return
    }
    const el = editorAreaRef.current
    if (!el) return

    const updateHeight = () => {
      const next = Math.floor(el.getBoundingClientRect().height)
      if (next > 0) setEditorAreaHeight(next)
    }

    updateHeight()
    const observer = new ResizeObserver(() => updateHeight())
    observer.observe(el)
    return () => observer.disconnect()
  }, [open, spatialAnchor])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="canvas-video-prompt-mask"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-sm"
            onClick={onClose}
          />
          <div
            key="canvas-video-prompt-dialog-root"
            className="fixed inset-0 z-[121] flex items-center justify-center p-4 pointer-events-none"
          >
            <motion.div
              key="canvas-video-prompt-dialog"
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.18 }}
              data-testid="canvas-video-prompt-expand-dialog"
              className="pointer-events-auto flex h-[min(88vh,860px)] w-[min(92vw,1100px)] flex-col overflow-hidden rounded-2xl border border-border/40 bg-card shadow-2xl shadow-black/40 dark:border-white/10 dark:bg-[#141416]"
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-4 py-2.5 dark:border-white/10">
                <p className="text-sm font-medium text-foreground dark:text-white/90">
                  {footer.running ? '查看视频描述' : '编辑视频描述'}
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground dark:text-white/40">
                    Esc 关闭 · 支持 @ 引用
                  </span>
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="shrink-0 border-b border-border/20 px-4 py-2 dark:border-white/8">
                <CanvasVideoReferenceBar
                  assets={referenceAssets}
                  mentionAssets={mentionAssets}
                  canvasProjectId={canvasProjectId}
                  autoMentionEnabled={autoMentionEnabled}
                  onAutoMentionChange={onAutoMentionChange}
                  onUploadReference={onUploadReference}
                  onRemoveUpload={onRemoveUpload}
                  embedded
                  disabled={Boolean(footer.running)}
                />
              </div>

              {spatialAnchor?.trim() ? (
                <div className="shrink-0 border-b border-border/20 px-4 py-2 dark:border-white/8">
                  <p className="text-[10px] font-medium text-muted-foreground dark:text-white/40">
                    空间锚点（只读）
                  </p>
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground dark:text-white/55">
                    {spatialAnchor.trim()}
                  </p>
                </div>
              ) : null}

              <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
                <div ref={editorAreaRef} className="min-h-0 flex-1">
                  <MentionTextarea
                    value={value}
                    onChange={onChange}
                    candidates={candidates}
                    canvasProjectId={canvasProjectId}
                    embedded
                    tone="canvas"
                    rows={12}
                    scrollBoxHeight={editorAreaHeight ?? undefined}
                    maxHeight={editorAreaHeight ?? undefined}
                    emptyHint={emptyHint}
                    placeholder={placeholder}
                    disabled={Boolean(footer.running)}
                    className={cn(
                      'h-full rounded-xl border border-border/35 bg-muted/20 px-3 py-2.5 text-[14px] leading-relaxed dark:border-white/10 dark:bg-white/[0.03]',
                      CANVAS_NODE_CONSOLE_TEXT,
                    )}
                  />
                </div>
              </div>

              <div className="shrink-0 border-t border-border/30 px-4 py-3 dark:border-white/10">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                    {footer.modelOptions.length ? (
                      <Select
                        value={footer.modelId}
                        onChange={footer.onModelChange}
                        options={footer.modelOptions}
                        placeholder="模型"
                        compactMenu
                        hideSuffixInTrigger
                        hideSuffixInMenu
                        disabled={Boolean(footer.running)}
                        className={cn(compactSelectClass, '!w-[140px]')}
                        title="视频模型"
                      />
                    ) : (
                      <span className="px-1 text-[11px] text-red-400">请配置模型</span>
                    )}
                    <CanvasVideoParamsPopover
                      aspectRatio={footer.aspectRatio}
                      aspectOptions={footer.aspectOptions}
                      onAspectRatioChange={footer.onAspectRatioChange}
                      resolution={footer.resolutionValue ?? ''}
                      resolutionOptions={footer.resolutionOptions ?? []}
                      showResolution={Boolean(footer.showResolution)}
                      onResolutionChange={footer.onResolutionChange ?? (() => {})}
                      durationSec={Number(footer.durationValue) || 5}
                      durationOptions={footer.durationOptions}
                      onDurationChange={footer.onDurationChange}
                      referenceMode={footer.referenceMode}
                      referenceModeOptions={footer.referenceModeOptions}
                      onReferenceModeChange={footer.onReferenceModeChange}
                      consoleAuxId="video-prompt-expand"
                    />
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <CanvasGeneratePill
                      testId={footer.generateTestId}
                      variant="dark"
                      running={footer.running}
                      disabled={
                        Boolean(footer.running) ||
                        (footer.generateDisabled ?? !footer.modelOptions.length)
                      }
                      showGenerateCost={footer.showGenerateCost}
                      generateCost={footer.generateCost}
                      generateCostLoading={footer.generateCostLoading}
                      onClick={footer.onGenerate}
                    />
                    {footer.running && footer.onStop ? (
                      <button
                        type="button"
                        title="停止生视频"
                        aria-label="停止生视频"
                        onClick={footer.onStop}
                        className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-red-500/35 bg-red-500/10 px-3 text-xs font-medium text-red-400 hover:bg-red-500/15"
                      >
                        停止
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
