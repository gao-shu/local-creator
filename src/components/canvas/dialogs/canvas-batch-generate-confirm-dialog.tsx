// Copyright (c) Haode AI. All rights reserved.

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useVideoBatchBillingPreview } from '@/hooks/use-video-batch-billing-preview'
import { useSettingsStore } from '@/stores/settings-store'
import type { PendingStoryboardShotItem } from '@/lib/canvas/canvas-shot-utils'
import {
  VIDEO_CONFIRM_BILLING_SECTION_TITLE,
  VIDEO_CONFIRM_PARAMS_SECTION_TITLE,
  buildVideoConfirmCapabilityFields,
} from '@/lib/models/video-confirm-sections'
import {
  VIDEO_REFERENCE_MODE_LABELS,
  type VideoReferenceMode,
} from '@/lib/workflow/storyboard-video-presets'
import type { ModelConfig } from '@/types/settings'
import { cn } from '@/lib/utils'

interface CanvasBatchGenerateConfirmDialogProps {
  open: boolean
  items: PendingStoryboardShotItem[]
  videoModel?: ModelConfig | null
  durationSec?: number
  resolution?: string | null
  aspectRatio?: string | null
  referenceMode?: string | null
  loading?: boolean
  onClose: () => void
  onConfirm: (nodeIds: string[]) => void
}

export function CanvasBatchGenerateConfirmDialog({
  open,
  items,
  videoModel,
  durationSec,
  resolution,
  aspectRatio,
  referenceMode,
  loading = false,
  onClose,
  onConfirm,
}: CanvasBatchGenerateConfirmDialogProps) {
  const settings = useSettingsStore((state) => state.settings)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setSelectedNodeIds(items.map((item) => item.nodeId))
  }, [items, open])

  const selectedItems = selectedNodeIds
    .map((nodeId) => items.find((item) => item.nodeId === nodeId))
    .filter((item): item is PendingStoryboardShotItem => Boolean(item))

  const { lines: billingLines, loading: billingLoading } = useVideoBatchBillingPreview({
    videoModel,
    shotCount: selectedNodeIds.length,
    durationSec,
    resolution,
    apiBase: settings?.apiBaseUrl,
    enabled: open && selectedNodeIds.length > 0,
  })

  const capabilityFields = useMemo(() => {
    const modeKey = String(referenceMode || '').trim() as VideoReferenceMode
    const referenceModeLabel =
      modeKey && modeKey in VIDEO_REFERENCE_MODE_LABELS
        ? VIDEO_REFERENCE_MODE_LABELS[modeKey]
        : modeKey || undefined
    return buildVideoConfirmCapabilityFields({
      referenceModeLabel,
      durationSec,
      aspectRatio,
      resolution,
    })
  }, [aspectRatio, durationSec, referenceMode, resolution])

  const handleRemove = useCallback((nodeId: string) => {
    setSelectedNodeIds((current) => current.filter((id) => id !== nodeId))
  }, [])

  const handleConfirm = useCallback(() => {
    if (!selectedNodeIds.length) return
    onConfirm(selectedNodeIds)
  }, [onConfirm, selectedNodeIds])

  return (
    <ConfirmDialog
      open={open}
      title="确认生成全部待处理视频？"
      confirmLabel="确认生成"
      cancelLabel="取消"
      loading={loading}
      confirmDisabled={selectedNodeIds.length === 0}
      onClose={onClose}
      onConfirm={handleConfirm}
      content={
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground/90">需要生成的内容</p>
            {selectedItems.length ? (
              <ul className="mt-2 max-h-[220px] space-y-1.5 overflow-y-auto rounded-xl border border-border/35 bg-muted/20 p-2">
                {selectedItems.map((item) => (
                  <li
                    key={item.nodeId}
                    className="flex items-center justify-between gap-2 rounded-lg bg-background/60 px-2.5 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground/85" title={item.label}>
                      {item.label}
                    </span>
                    <button
                      type="button"
                      data-testid={`canvas-batch-generate-remove-${item.shotNumber ?? item.nodeId}`}
                      aria-label={`移除 ${item.label}`}
                      disabled={loading}
                      onClick={() => handleRemove(item.nodeId)}
                      className={cn(
                        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                        'text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                        'disabled:cursor-not-allowed disabled:opacity-45',
                      )}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 rounded-xl border border-dashed border-border/35 px-3 py-4 text-center text-sm text-muted-foreground">
                请至少保留 1 个镜头
              </p>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            将按列表顺序依次生成，包含智能分镜镜号与手动添加的视频节点。
          </p>

          <section
            data-testid="video-confirm-params-section"
            className="rounded-xl border border-border/40 bg-muted/15 px-3 py-2.5 space-y-2"
          >
            <p className="text-[11px] font-semibold text-foreground/90">
              {VIDEO_CONFIRM_PARAMS_SECTION_TITLE}
            </p>
            {videoModel?.name ? (
              <p className="text-xs text-muted-foreground">
                模型 · <span className="text-foreground">{videoModel.name}</span>
              </p>
            ) : null}
            {capabilityFields.length ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {capabilityFields.map((field) => (
                  <Fragment key={field.key}>
                    <dt className="text-muted-foreground">{field.label}</dt>
                    <dd className="text-foreground">{field.value}</dd>
                  </Fragment>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-muted-foreground">将使用当前画布视频参数</p>
            )}
          </section>

          <section
            data-testid="video-confirm-billing-section"
            className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 space-y-1.5"
          >
            <p className="text-[11px] font-semibold text-amber-700/90 dark:text-amber-300/90">
              {VIDEO_CONFIRM_BILLING_SECTION_TITLE}
            </p>
            {billingLoading ? (
              <p className="text-sm font-medium text-amber-600/90 dark:text-amber-400/90">询价中…</p>
            ) : null}
            {!billingLoading && billingLines.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无费用信息</p>
            ) : null}
            {billingLines.map((line) => (
              <p
                key={line.kind}
                className={cn(
                  'text-sm font-medium',
                  line.kind === 'haodou' && 'text-amber-600/90 dark:text-amber-400/90',
                  line.kind === 'project' && 'text-cyan-600/90 dark:text-cyan-400/90',
                  line.kind === 'info' && 'text-muted-foreground font-normal',
                )}
              >
                {line.text}
              </p>
            ))}
          </section>

          <p className="text-sm text-muted-foreground">确认继续吗？</p>
        </div>
      }
    />
  )
}
