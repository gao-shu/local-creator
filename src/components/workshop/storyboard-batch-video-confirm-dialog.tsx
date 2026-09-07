// Copyright (c) Haode AI. All rights reserved.

import { Fragment, useMemo } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
import { VIDEO_BATCH_CONCURRENCY } from '@/constants/batch-concurrency'

interface StoryboardBatchVideoConfirmDialogProps {
  open: boolean
  targetCount: number
  videoModel?: ModelConfig | null
  durationSec?: number
  resolution?: string | null
  aspectRatio?: string | null
  referenceMode?: string | null
  loading?: boolean
  onClose: () => void
  onConfirm: () => void
}

/** Step4 批量生视频确认：参数区 / 费用区分栏（H1） */
export function StoryboardBatchVideoConfirmDialog({
  open,
  targetCount,
  videoModel,
  durationSec,
  resolution,
  aspectRatio,
  referenceMode,
  loading = false,
  onClose,
  onConfirm,
}: StoryboardBatchVideoConfirmDialogProps) {
  const billingLines: Array<{ text: string }> = []
  const billingLoading = false

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

  return (
    <ConfirmDialog
      open={open}
      title="确认批量生成视频？"
      confirmLabel="确认生成"
      cancelLabel="取消"
      loading={loading}
      confirmDisabled={targetCount <= 0}
      onClose={onClose}
      onConfirm={onConfirm}
      content={
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            将对 {targetCount} 个分镜加入生成队列，最多 {VIDEO_BATCH_CONCURRENCY}{' '}
            路并发，其余排队等待；已有视频的分镜会跳过。
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
              <p className="text-xs text-muted-foreground">将使用当前分镜视频参数</p>
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
                  line.kind === 'cost' && 'text-amber-600/90 dark:text-amber-400/90',
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
