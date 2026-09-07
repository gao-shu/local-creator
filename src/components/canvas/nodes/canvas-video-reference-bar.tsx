// Copyright (c) local-creator contributors. All rights reserved.

import { useState } from 'react'
import { AtSign, ImagePlus, Maximize2, Upload, X } from 'lucide-react'
import { ImagePreviewModal } from '@/components/ui/image-preview-modal'
import { useCanvasImagePreview } from '@/hooks/use-canvas-media-preview'
import type { CanvasUpstreamReferenceAsset } from '@/lib/canvas/canvas-graph-utils'
import { mentionKindLabel, type MentionCandidate } from '@/lib/workflow/mention-utils'
import { cn } from '@/lib/utils'

const THUMB_CLASS = 'relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border'

function ReferenceThumb({
  asset,
  canvasProjectId,
  onRemove,
}: {
  asset: CanvasUpstreamReferenceAsset
  canvasProjectId: string
  onRemove?: () => void
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const { src: previewSrc } = useCanvasImagePreview(
    asset.path,
    canvasProjectId,
    asset.ownerKind,
    asset.ownerProjectId,
  )
  const previewTitle = asset.mentionName
    ? `${asset.label} @${asset.mentionName}`
    : asset.label

  return (
    <>
      <button
        type="button"
        title={previewSrc ? `点击放大 · ${previewTitle}` : previewTitle}
        aria-label={previewSrc ? `放大预览 ${previewTitle}` : previewTitle}
        disabled={!previewSrc}
        onClick={(event) => {
          event.stopPropagation()
          if (previewSrc) setPreviewOpen(true)
        }}
        className={cn(
          THUMB_CLASS,
          'text-left',
          previewSrc &&
            'cursor-zoom-in transition-shadow hover:ring-2 hover:ring-cyan-500/35 dark:hover:ring-cyan-400/30',
          asset.isMarkedAsset
            ? 'border-violet-500/40 bg-violet-500/[0.08] dark:border-violet-400/35 dark:bg-violet-500/10'
            : 'border-border/40 bg-muted/40 dark:border-white/10 dark:bg-white/[0.04]',
          !previewSrc && 'cursor-default',
        )}
      >
        {previewSrc ? (
          <img src={previewSrc} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
            <ImagePlus className="h-3.5 w-3.5" />
          </div>
        )}

        {asset.isMarkedAsset ? (
          <span
            className="pointer-events-none absolute bottom-0.5 right-0.5 flex h-[16px] w-[16px] items-center justify-center rounded-full bg-violet-600/95 text-[9px] font-bold leading-none text-white shadow-sm dark:bg-violet-500"
            aria-hidden
          >
            @
          </span>
        ) : null}

        {asset.removable && onRemove ? (
          <span
            role="button"
            tabIndex={0}
            title="移除"
            aria-label="移除参考图"
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                event.stopPropagation()
                onRemove()
              }
            }}
            className="absolute top-0.5 right-0.5 z-10 rounded bg-black/65 p-0.5 text-white hover:bg-black/85"
          >
            <X className="h-2.5 w-2.5" />
          </span>
        ) : null}
      </button>

      {previewOpen && previewSrc ? (
        <ImagePreviewModal
          imageUrl={previewSrc}
          alt={previewTitle}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  )
}

function MentionAssetChip({
  item,
  canvasProjectId,
}: {
  item: MentionCandidate
  canvasProjectId: string
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const path = (item.thumbnailPath || item.previewPaths?.[0])?.trim()
  const { src: previewSrc } = useCanvasImagePreview(
    path,
    canvasProjectId,
    item.canvasOwnerKind,
    item.canvasOwnerProjectId,
  )

  const kindClass =
    item.kind === 'character'
      ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : item.kind === 'scene'
        ? 'border-cyan-500/35 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
        : 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300'

  return (
    <>
      <span
        className={cn(
          'inline-flex max-w-[140px] items-center gap-1.5 rounded-full border px-1.5 py-0.5',
          kindClass,
        )}
        title={`${mentionKindLabel(item.kind)} · @${item.mentionName}`}
      >
        <button
          type="button"
          title={previewSrc ? `点击放大 · @${item.mentionName}` : `@${item.mentionName}`}
          aria-label={previewSrc ? `放大预览 @${item.mentionName}` : `@${item.mentionName}`}
          disabled={!previewSrc}
          onClick={(event) => {
            event.stopPropagation()
            if (previewSrc) setPreviewOpen(true)
          }}
          className={cn(
            'h-5 w-5 shrink-0 overflow-hidden rounded-full border border-white/20 bg-black/20',
            previewSrc && 'cursor-zoom-in hover:ring-1 hover:ring-white/40',
          )}
        >
          {previewSrc ? (
            <img src={previewSrc} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[9px] opacity-60">@</span>
          )}
        </button>
        <span className="truncate text-[11px] font-medium">{item.mentionName}</span>
        <AtSign className="h-3 w-3 shrink-0 opacity-70" />
      </span>

      {previewOpen && previewSrc ? (
        <ImagePreviewModal
          imageUrl={previewSrc}
          alt={`@${item.mentionName}`}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  )
}

interface CanvasVideoReferenceBarProps {
  assets: CanvasUpstreamReferenceAsset[]
  mentionAssets: MentionCandidate[]
  canvasProjectId: string
  autoMentionEnabled: boolean
  onAutoMentionChange: (enabled: boolean) => void
  onUploadReference?: () => void
  onRemoveUpload?: (index: number) => void
  onExpandPrompt?: () => void
  /** 嵌入提示词编辑器顶部时去掉外框，由父级统一卡片样式 */
  embedded?: boolean
  /** 生成中只读：可预览/展开查看，不可改参考与自动@ */
  disabled?: boolean
}

export function CanvasVideoReferenceBar({
  assets,
  mentionAssets,
  canvasProjectId,
  autoMentionEnabled,
  onAutoMentionChange,
  onUploadReference,
  onRemoveUpload,
  onExpandPrompt,
  embedded = false,
  disabled = false,
}: CanvasVideoReferenceBarProps) {
  return (
    <div
      className={cn(
        'nodrag nopan space-y-1.5',
        !embedded &&
          'mb-2 rounded-lg border border-border/35 bg-muted/15 px-2 py-1.5 dark:border-white/10 dark:bg-white/[0.03]',
      )}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex min-h-[44px] items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            title={disabled ? '生成中不可上传参考图' : '上传参考图'}
            aria-label={disabled ? '生成中不可上传参考图' : '上传参考图'}
            disabled={disabled || !onUploadReference}
            onClick={(event) => {
              event.stopPropagation()
              if (disabled) return
              onUploadReference?.()
            }}
            className={cn(
              THUMB_CLASS,
              'flex items-center justify-center border-dashed border-border/50 text-muted-foreground/55',
              !disabled &&
                'hover:border-cyan-500/45 hover:bg-cyan-500/5 hover:text-cyan-600 dark:border-white/20 dark:hover:border-cyan-400/40 dark:hover:text-cyan-300',
              disabled && 'cursor-not-allowed opacity-45 dark:border-white/15',
            )}
          >
            <Upload className="h-3.5 w-3.5" />
          </button>

          {assets.map((asset) => (
            <ReferenceThumb
              key={`${asset.nodeId}-${asset.path}-${asset.uploadIndex ?? ''}`}
              asset={asset}
              canvasProjectId={canvasProjectId}
              onRemove={
                !disabled &&
                asset.removable &&
                asset.uploadIndex != null &&
                onRemoveUpload
                  ? () => onRemoveUpload(asset.uploadIndex!)
                  : undefined
              }
            />
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 border-l border-border/30 pl-2 dark:border-white/10">
          <button
            type="button"
            role="switch"
            aria-checked={autoMentionEnabled}
            aria-label="自动插入 @ 引用"
            title={
              disabled
                ? '生成中不可改自动@'
                : autoMentionEnabled
                  ? '已开启：自动根据参考资产插入 @ 引用（点击关闭）'
                  : '已关闭：点击开启自动 @ 引用'
            }
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation()
              if (disabled) return
              onAutoMentionChange(!autoMentionEnabled)
            }}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
              'border-border/40 bg-muted/40 dark:border-white/10 dark:bg-[#1a1a1e]',
              autoMentionEnabled
                ? 'text-violet-500 dark:text-violet-400'
                : 'text-muted-foreground dark:text-white/45',
              !disabled && 'hover:border-border/55 dark:hover:border-white/18',
              disabled && 'cursor-not-allowed opacity-45',
            )}
          >
            <span>自动@</span>
            <span
              aria-hidden
              className={cn(
                'relative inline-flex h-[14px] w-[24px] shrink-0 items-center rounded-full transition-colors',
                autoMentionEnabled
                  ? 'bg-violet-500 dark:bg-violet-500'
                  : 'bg-muted-foreground/35 dark:bg-white/20',
              )}
            >
              <span
                className={cn(
                  'absolute top-[2px] h-[10px] w-[10px] rounded-full bg-white shadow-sm transition-transform',
                  autoMentionEnabled ? 'left-[12px]' : 'left-[2px]',
                )}
              />
            </span>
          </button>
          {onExpandPrompt ? (
            <button
              type="button"
              title={disabled ? '展开查看' : '展开编辑'}
              aria-label={disabled ? '展开查看视频描述' : '展开编辑视频描述'}
              onClick={(event) => {
                event.stopPropagation()
                onExpandPrompt()
              }}
              className={cn(
                'inline-flex h-7 w-7 items-center justify-center rounded-md',
                'text-muted-foreground/70 hover:bg-muted/50 hover:text-foreground',
                'dark:text-white/45 dark:hover:bg-white/[0.08] dark:hover:text-white/85',
              )}
            >
              <Maximize2 className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          'flex min-h-[28px] flex-wrap items-center gap-1.5',
          !embedded && 'border-t border-border/25 pt-1.5 dark:border-white/10',
          embedded && 'border-t border-border/20 pt-1.5 dark:border-white/8',
        )}
      >
        <span className="shrink-0 text-[10px] text-muted-foreground/80 dark:text-white/40">
          引用
        </span>
        {mentionAssets.length ? (
          mentionAssets.map((item) => (
            <MentionAssetChip key={item.id} item={item} canvasProjectId={canvasProjectId} />
          ))
        ) : (
          <span className="text-[10px] text-muted-foreground/70 dark:text-white/35">
            描述里的 @人物/@场景/@道具会显示在这里
          </span>
        )}
      </div>
    </div>
  )
}
