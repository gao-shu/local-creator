// Copyright (c) Haode AI. All rights reserved.

import { ChevronUp } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  CANVAS_NODE_COMPACT_SELECT,
  CANVAS_NODE_CONSOLE,
} from '@/lib/canvas/canvas-node-theme'
import { useCanvasParamsPopoverPosition } from '@/lib/canvas/canvas-params-popover-position'
import {
  buildCanvasImageSizePreset,
  CANVAS_IMAGE_ASPECT_UI,
  formatCanvasImageParamsSummary,
  parseCanvasImageAspectRatio,
  resolveCanvasImageActiveTier,
  resolveCanvasImageResolutionTierOptions,
  shouldShowCanvasImageResolutionSelector,
  type CanvasImageAspectRatio,
} from '@/lib/canvas/canvas-image-params-utils'
import {
  normalizeImageGenerationTierParams,
  resolveImageQualityOptions,
  shouldShowImageQualitySelector,
  shouldShowImageResolutionSelector,
  type ImageGenerationTierParams,
} from '@/lib/models/image-generation-tier-params'
import type { ImageQuality, ModelConfig } from '@/types/settings'
import { cn } from '@/lib/utils'

interface CanvasImageParamsPopoverProps {
  imageSize: string
  onImageSizeChange: (value: string) => void
  model: ModelConfig | null | undefined
  tierParams: ImageGenerationTierParams
  onTierParamsChange: (next: ImageGenerationTierParams) => void
  /** 挂在 body 的弹层需带此属性，避免控制台 outside-dismiss 在点击选项前收起 */
  consoleAuxId?: string
  className?: string
  /** 触发器额外样式（如参数面板全宽） */
  triggerClassName?: string
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

/** 图片节点控制台：比例 + 后台分辨率/质量，合并为单一悬浮面板 */
export function CanvasImageParamsPopover({
  imageSize,
  onImageSizeChange,
  model,
  tierParams,
  onTierParamsChange,
  consoleAuxId,
  className,
  triggerClassName,
}: CanvasImageParamsPopoverProps) {
  const [open, setOpen] = useState(false)
  const { rootRef, menuRef, menuStyle } = useCanvasParamsPopoverPosition(open, 280)

  const normalizedTier = normalizeImageGenerationTierParams(model, tierParams)
  const aspectRatio = parseCanvasImageAspectRatio(imageSize)
  const qualityOptions = resolveImageQualityOptions(model)
  const showResolution = shouldShowCanvasImageResolutionSelector(model, aspectRatio)
  const resolutionTierOptions = resolveCanvasImageResolutionTierOptions(model, aspectRatio)
  const showQuality = shouldShowImageQualitySelector(model)
  const activeTier = resolveCanvasImageActiveTier(model, imageSize, normalizedTier)
  const summaryLabel = formatCanvasImageParamsSummary(imageSize, model, normalizedTier)

  const syncImageSizeForAspect = useCallback(
    (nextAspect: CanvasImageAspectRatio) => {
      const tier = resolveCanvasImageActiveTier(model, imageSize, normalizedTier)
      onImageSizeChange(buildCanvasImageSizePreset(tier, nextAspect))
    },
    [imageSize, model, normalizedTier, onImageSizeChange],
  )

  const syncImageSizeForResolution = useCallback(
    (resolution: string) => {
      onImageSizeChange(buildCanvasImageSizePreset(resolution, aspectRatio))
      if (shouldShowImageResolutionSelector(model)) {
        onTierParamsChange(
          normalizeImageGenerationTierParams(model, {
            ...normalizedTier,
            resolution,
          }),
        )
      }
    },
    [aspectRatio, model, normalizedTier, onImageSizeChange, onTierParamsChange],
  )

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
          title="图片尺寸"
          data-testid="canvas-image-params-trigger"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            setOpen((prev) => !prev)
          }}
          className={cn(
            'flex h-7 max-w-[140px] items-center gap-1 rounded-md px-2 text-[11px] tabular-nums',
            CANVAS_NODE_COMPACT_SELECT,
            open && 'ring-1 ring-primary/25',
            triggerClassName,
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
              aria-label="图片尺寸"
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
                <div className="space-y-2">
                  <SectionTitle>比例</SectionTitle>
                  <div className="grid grid-cols-3 gap-2">
                    {CANVAS_IMAGE_ASPECT_UI.map((item) => {
                      const active = item.value === aspectRatio
                      return (
                        <button
                          key={item.value}
                          type="button"
                          title={item.label}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => syncImageSizeForAspect(item.value)}
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

                {showResolution && resolutionTierOptions.length > 0 ? (
                  <div className="space-y-2">
                    <SectionTitle>清晰度</SectionTitle>
                    <div className="flex flex-wrap gap-1.5">
                      {resolutionTierOptions.map((tier) => (
                        <SegmentedOption
                          key={tier}
                          active={tier === activeTier}
                          onClick={() => syncImageSizeForResolution(tier)}
                        >
                          {tier}
                        </SegmentedOption>
                      ))}
                    </div>
                  </div>
                ) : null}

                {showQuality && qualityOptions.length > 0 && normalizedTier.quality ? (
                  <div className="space-y-2">
                    <SectionTitle>质量</SectionTitle>
                    <div className="flex flex-wrap gap-1.5">
                      {qualityOptions.map((item) => (
                        <SegmentedOption
                          key={item.value}
                          active={item.value === normalizedTier.quality}
                          onClick={() =>
                            onTierParamsChange(
                              normalizeImageGenerationTierParams(model, {
                                ...normalizedTier,
                                quality: item.value as ImageQuality,
                              }),
                            )
                          }
                        >
                          {item.label}
                        </SegmentedOption>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
