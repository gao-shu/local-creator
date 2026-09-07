// Copyright (c) local-creator contributors. All rights reserved.

import { ChevronUp } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  CANVAS_NODE_COMPACT_SELECT,
  CANVAS_NODE_CONSOLE,
} from '@/lib/canvas/canvas-node-theme'
import { useCanvasParamsPopoverPosition } from '@/lib/canvas/canvas-params-popover-position'
import { cn } from '@/lib/utils'

export interface CanvasVideoParamsPopoverOption {
  value: string
  label: string
  disabled?: boolean
}

interface CanvasVideoParamsPopoverProps {
  aspectRatio: string
  aspectOptions: ReadonlyArray<{ value: string; label: string }>
  onAspectRatioChange: (value: string) => void
  resolution: string
  resolutionOptions: CanvasVideoParamsPopoverOption[]
  showResolution?: boolean
  onResolutionChange: (value: string) => void
  durationSec: number
  durationOptions: CanvasVideoParamsPopoverOption[]
  onDurationChange: (value: string) => void
  referenceMode?: string
  referenceModeOptions?: ReadonlyArray<{ value: string; label: string }>
  onReferenceModeChange?: (value: string) => void
  /** 挂在 body 的弹层需带此属性，避免控制台 outside-dismiss 在点击选项前收起 */
  consoleAuxId?: string
  className?: string
}

function aspectRatioToCss(value: string): string {
  const parts = value.split(':').map(Number)
  if (parts.length === 2 && parts[0]! > 0 && parts[1]! > 0) {
    return `${parts[0]} / ${parts[1]}`
  }
  return '16 / 9'
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium text-foreground/75 dark:text-white/55">{children}</p>
  )
}

function SegmentedOption({
  active,
  disabled,
  onClick,
  children,
  className,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      className={cn(
        'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
        active
          ? 'border-foreground/35 bg-muted/55 text-foreground dark:border-white/35 dark:bg-white/10 dark:text-white/90'
          : 'border-border/35 bg-transparent text-muted-foreground hover:bg-muted/35 dark:border-white/10 dark:text-white/55 dark:hover:bg-white/[0.06]',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent dark:hover:bg-transparent',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** 视频节点控制台：模式 / 比例 / 清晰度 / 时长 合并悬浮面板 */
export function CanvasVideoParamsPopover({
  aspectRatio,
  aspectOptions,
  onAspectRatioChange,
  resolution,
  resolutionOptions,
  showResolution = true,
  onResolutionChange,
  durationSec,
  durationOptions,
  onDurationChange,
  referenceMode,
  referenceModeOptions,
  onReferenceModeChange,
  consoleAuxId,
  className,
}: CanvasVideoParamsPopoverProps) {
  const [open, setOpen] = useState(false)
  const { rootRef, menuRef, menuStyle } = useCanvasParamsPopoverPosition(open, 300)

  const durationValue = String(durationSec)
  // 微视 4–15、OpenAI 兼容 1–30：选项数 > 5 时用滑轨
  const useDurationSlider = durationOptions.length > 5
  const durationMin = useDurationSlider ? Number(durationOptions[0]?.value) || 1 : undefined
  const durationMax = useDurationSlider
    ? Number(durationOptions[durationOptions.length - 1]?.value) || 30
    : undefined

  const showReferenceMode =
    Boolean(referenceModeOptions?.length) && typeof onReferenceModeChange === 'function'
  const referenceModeLabel =
    referenceModeOptions?.find((item) => item.value === referenceMode)?.label || ''

  const resolutionSummary = (() => {
    const raw = resolution.trim()
    if (!raw) return '720P'
    if (raw.toUpperCase() === '4K') return '4K'
    if (/p$/i.test(raw)) return raw.toUpperCase()
    return `${raw}P`
  })()
  // 单档时不展示清晰度选择器，但摘要仍带清晰度（有什么展示什么）
  const summaryParts = [
    showReferenceMode && referenceModeLabel ? referenceModeLabel : null,
    aspectRatio,
    resolution.trim() || resolutionOptions.length >= 1 ? resolutionSummary : null,
    `${durationSec}s`,
  ].filter(Boolean)
  const summaryLabel = summaryParts.join(' · ')

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <div ref={rootRef} className={cn('relative shrink-0 nodrag nopan', className)}>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          title="视频参数"
          data-testid="canvas-video-params-trigger"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            setOpen((prev) => !prev)
          }}
          className={cn(
            'flex h-7 max-w-[200px] items-center gap-1 rounded-md px-2 text-[11px] tabular-nums',
            CANVAS_NODE_COMPACT_SELECT,
            open && 'ring-1 ring-primary/25',
          )}
        >
          <span className="min-w-0 truncate text-foreground/90 dark:text-white/85">{summaryLabel}</span>
          <ChevronUp
            className={cn('h-3 w-3 shrink-0 opacity-60 transition-transform', !open && 'rotate-180')}
          />
        </button>
      </div>

      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="dialog"
              aria-label="视频参数"
              data-canvas-console-aux={consoleAuxId}
              className={cn(
                'fixed z-[260] nodrag nopan rounded-2xl border border-border/40 p-3.5 shadow-2xl',
                CANVAS_NODE_CONSOLE,
              )}
              style={{
                left: menuStyle.left,
                top: menuStyle.top,
                width: menuStyle.width,
                transform: menuStyle.transform,
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="space-y-3.5">
                {showReferenceMode ? (
                  <div className="space-y-2">
                    <SectionTitle>模式</SectionTitle>
                    <div className="flex flex-wrap gap-1.5">
                      {referenceModeOptions!.map((item) => (
                        <SegmentedOption
                          key={item.value}
                          active={item.value === referenceMode}
                          onClick={() => onReferenceModeChange!(item.value)}
                        >
                          {item.label}
                        </SegmentedOption>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <SectionTitle>画面比例</SectionTitle>
                  <div className="grid grid-cols-3 gap-2">
                    {aspectOptions.map((item) => {
                      const active = item.value === aspectRatio
                      return (
                        <button
                          key={item.value}
                          type="button"
                          title={item.label}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => onAspectRatioChange(item.value)}
                          className={cn(
                            'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2 transition-colors',
                            active
                              ? 'border-foreground/35 bg-muted/50 dark:border-white/35 dark:bg-white/10'
                              : 'border-border/30 hover:bg-muted/30 dark:border-white/10 dark:hover:bg-white/[0.05]',
                          )}
                        >
                          <span
                            className={cn(
                              'block w-8 rounded-[3px] border-2',
                              active
                                ? 'border-foreground/70 dark:border-white/70'
                                : 'border-muted-foreground/45 dark:border-white/35',
                            )}
                            style={{ aspectRatio: aspectRatioToCss(item.value) }}
                          />
                          <span className="text-[10px] text-foreground/80 dark:text-white/75">
                            {item.value}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {showResolution && resolutionOptions.length >= 2 ? (
                  <div className="space-y-2">
                    <SectionTitle>清晰度</SectionTitle>
                    <div className="flex flex-wrap gap-1.5">
                      {resolutionOptions.map((item) => (
                        <SegmentedOption
                          key={item.value}
                          active={item.value === resolution}
                          disabled={item.disabled}
                          onClick={() => onResolutionChange(item.value)}
                        >
                          {item.label.replace(/p$/i, 'P')}
                        </SegmentedOption>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <SectionTitle>视频时长</SectionTitle>
                    <span className="text-[11px] tabular-nums text-foreground/85 dark:text-white/80">
                      {durationSec} s
                    </span>
                  </div>
                  {useDurationSlider && durationMin != null && durationMax != null ? (
                    <input
                      type="range"
                      min={durationMin}
                      max={durationMax}
                      step={1}
                      value={durationSec}
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={(event) => onDurationChange(event.target.value)}
                      className="h-1.5 w-full cursor-pointer accent-primary"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {durationOptions.map((item) => (
                        <SegmentedOption
                          key={item.value}
                          active={item.value === durationValue}
                          disabled={item.disabled}
                          onClick={() => onDurationChange(item.value)}
                        >
                          {item.label}
                        </SegmentedOption>
                      ))}
                    </div>
                  )}
                  {useDurationSlider ? (
                    <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground dark:text-white/40">
                      <span>{durationMin}s</span>
                      <span>{durationMax}s</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
