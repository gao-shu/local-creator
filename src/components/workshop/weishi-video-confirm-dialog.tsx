// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useMemo, useState, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, Play, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { WeishiVideoRequestPreview } from '@/lib/models/weishi-video-client'
import {
  VIDEO_CONFIRM_BILLING_SECTION_TITLE,
  VIDEO_CONFIRM_PARAMS_SECTION_TITLE,
  buildVideoConfirmCapabilityFields,
} from '@/lib/models/video-confirm-sections'
import { useVideoBatchBillingPreview } from '@/hooks/use-video-batch-billing-preview'
import { useSettingsStore } from '@/stores/settings-store'
import type { ModelConfig } from '@/types/settings'

interface WeishiVideoConfirmDialogProps {
  open: boolean
  preview: WeishiVideoRequestPreview | null
  /** 不传则从已选视频模型列表按 upstream model 匹配 */
  videoModel?: ModelConfig | null
  /** 仅禁用「确认生成」，不影响取消与关闭 */
  confirmDisabled?: boolean
  onClose: () => void
  onConfirm: () => void
}

function resolveVideoModelFromPreview(
  preview: WeishiVideoRequestPreview | null | undefined,
  videoModel: ModelConfig | null | undefined,
  getMergedModels: (kind: 'video') => ModelConfig[],
): ModelConfig | null {
  if (videoModel) return videoModel
  if (!preview?.context) return null
  const videos = getMergedModels('video')
  const upstream = preview.context.modelId?.trim()
  if (upstream) {
    const byUpstream = videos.find((item) => item.model?.trim() === upstream)
    if (byUpstream) return byUpstream
  }
  const byName = videos.find((item) => item.name === preview.context.modelName)
  return byName ?? null
}

function formatPreviewPayload(preview: WeishiVideoRequestPreview): string {
  return JSON.stringify(
    {
      method: preview.method,
      url: preview.url,
      headers: preview.headers,
      body: preview.body,
    },
    null,
    2,
  )
}

export function WeishiVideoConfirmDialog({
  open,
  preview,
  videoModel,
  confirmDisabled = false,
  onClose,
  onConfirm,
}: WeishiVideoConfirmDialogProps) {
  const [copied, setCopied] = useState(false)
  const settings = useSettingsStore((state) => state.settings)
  const getMergedModels = useSettingsStore((state) => state.getMergedModels)
  const videoModelsVersion = useSettingsStore((state) => state.settings?.videoModels)

  const resolvedVideoModel = useMemo(
    () => resolveVideoModelFromPreview(preview, videoModel, getMergedModels),
    [getMergedModels, preview, videoModel, videoModelsVersion],
  )
  const shotCount = Math.max(1, preview?.context?.batchCount ?? 1)
  const { lines: billingLines, loading: billingLoading } = useVideoBatchBillingPreview({
    videoModel: resolvedVideoModel,
    shotCount,
    durationSec: preview?.context?.durationSec,
    resolution: preview?.context?.resolution,
    apiBase: settings?.apiBaseUrl,
    enabled: open && Boolean(preview?.context),
  })

  const handleCopyPayload = useCallback(async () => {
    if (!preview) return
    try {
      await navigator.clipboard.writeText(formatPreviewPayload(preview))
      setCopied(true)
      toast.success('已复制到剪贴板')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败')
    }
  }, [preview])

  if (!preview?.context) return null

  const { context } = preview
  const batchHint =
    context.batchCount && context.batchCount > 1
      ? `批量共 ${context.batchCount} 个分镜，以下以镜号 ${context.shotNumber ?? '-'} 为例。`
      : undefined
  const capabilityFields = buildVideoConfirmCapabilityFields({
    referenceModeLabel: context.referenceModeLabel,
    durationSec: context.durationSec,
    aspectRatio: context.aspectRatio,
    resolution: context.resolution,
  })

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto w-full max-w-2xl"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="rounded-2xl border border-border/40 bg-card shadow-2xl shadow-black/30 flex flex-col overflow-hidden max-h-[85vh]">
                <div className="flex items-start gap-3 px-6 pt-6 pb-4 shrink-0">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15">
                    <Play className="h-5 w-5 text-cyan-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-base font-semibold leading-snug">确认生成视频</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          请核对生成参数与费用预估，点击「确认生成」后才会创建视频任务。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-muted"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-4 space-y-3 overflow-y-auto min-h-0">
                  {batchHint ? (
                    <p className="text-xs text-amber-500/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      {batchHint}
                    </p>
                  ) : null}

                  <section
                    data-testid="video-confirm-params-section"
                    className="rounded-xl border border-border/40 bg-muted/15 px-3 py-3 space-y-2.5"
                  >
                    <p className="text-[11px] font-semibold tracking-wide text-foreground/90">
                      {VIDEO_CONFIRM_PARAMS_SECTION_TITLE}
                    </p>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      {context.shotNumber != null ? (
                        <>
                          <dt className="text-muted-foreground">镜号</dt>
                          <dd className="text-foreground font-medium">#{context.shotNumber}</dd>
                        </>
                      ) : null}
                      <dt className="text-muted-foreground">模型</dt>
                      <dd className="text-foreground">{context.modelName}</dd>
                      <dt className="text-muted-foreground">model</dt>
                      <dd className="text-foreground font-mono">{context.modelId}</dd>
                      {capabilityFields.map((field) => (
                        <Fragment key={field.key}>
                          <dt className="text-muted-foreground">{field.label}</dt>
                          <dd className="text-foreground">{field.value}</dd>
                        </Fragment>
                      ))}
                      {context.referenceImageItems?.length ? (
                        <>
                          <dt className="text-muted-foreground col-span-2">参考图</dt>
                          <dd className="text-foreground col-span-2">
                            <ul className="space-y-2.5">
                              {context.referenceImageItems.map((item, index) => (
                                <li
                                  key={`${item.path}-${index}`}
                                  className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2 space-y-1"
                                >
                                  <p className="font-sans text-[11px] leading-snug text-foreground/90">
                                    {context.referenceImageItems!.length > 1 ? `${index + 1}. ` : ''}
                                    {item.label}
                                    {item.kind === 'storyboard'
                                      ? ' · first_frame'
                                      : item.kind === 'end_frame'
                                        ? ' · last_frame'
                                        : item.kind === 'mention'
                                          ? ' · reference_image'
                                          : item.kind === 'shot_reference'
                                            ? ' · reference_image'
                                            : ''}
                                  </p>
                                  <p
                                    className="font-mono text-[10px] leading-relaxed text-muted-foreground break-all line-clamp-2"
                                    title={item.path}
                                  >
                                    {item.path}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </>
                      ) : context.referenceImagePaths?.length ? (
                        <>
                          <dt className="text-muted-foreground">参考图</dt>
                          <dd className="text-foreground">
                            <ul className="space-y-1.5 font-mono text-[11px]">
                              {context.referenceImagePaths.map((path, index) => (
                                <li
                                  key={`${path}-${index}`}
                                  className="break-all leading-relaxed"
                                  title={path}
                                >
                                  {context.referenceImagePaths!.length > 1 ? `${index + 1}. ` : ''}
                                  {path}
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </>
                      ) : context.referenceImagePath ? (
                        <>
                          <dt className="text-muted-foreground">参考图</dt>
                          <dd className="text-foreground break-all font-mono text-[11px]">
                            {context.referenceImagePath}
                          </dd>
                        </>
                      ) : null}
                      {context.referenceAudioItems?.length ? (
                        <>
                          <dt className="text-muted-foreground col-span-2">参考音频</dt>
                          <dd className="text-foreground col-span-2">
                            <ul className="space-y-2.5">
                              {context.referenceAudioItems.map((item, index) => (
                                <li
                                  key={`${item.path}-${index}`}
                                  className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2 space-y-1"
                                >
                                  <p className="font-sans text-[11px] leading-snug text-foreground/90">
                                    {context.referenceAudioItems!.length > 1 ? `${index + 1}. ` : ''}
                                    {item.label}
                                  </p>
                                  <p
                                    className="font-mono text-[10px] leading-relaxed text-muted-foreground break-all line-clamp-2"
                                    title={item.path}
                                  >
                                    {item.path}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </>
                      ) : null}
                    </dl>
                    {context.referenceNote ? (
                      <p className="text-[11px] text-muted-foreground leading-relaxed pt-0.5">
                        {context.referenceNote}
                      </p>
                    ) : null}
                  </section>

                  <section
                    data-testid="video-confirm-billing-section"
                    className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-3 space-y-2"
                  >
                    <p className="text-[11px] font-semibold tracking-wide text-amber-700/90 dark:text-amber-300/90">
                      {VIDEO_CONFIRM_BILLING_SECTION_TITLE}
                    </p>
                    {billingLoading ? (
                      <p className="text-xs text-amber-600/90 dark:text-amber-400/90">询价中…</p>
                    ) : null}
                    {!billingLoading && billingLines.length === 0 ? (
                      <p className="text-xs text-muted-foreground">暂无费用信息</p>
                    ) : null}
                    {billingLines.map((line) => (
                      <p
                        key={line.kind}
                        className={cn(
                          'text-xs rounded-lg px-3 py-2 border',
                          line.kind === 'haodou' &&
                            'text-amber-600/95 dark:text-amber-400/95 bg-amber-500/10 border-amber-500/20',
                          line.kind === 'project' &&
                            'text-cyan-600/95 dark:text-cyan-400/95 bg-cyan-500/10 border-cyan-500/20',
                          line.kind === 'info' &&
                            'text-muted-foreground bg-muted/20 border-border/35',
                        )}
                      >
                        {line.text}
                      </p>
                    ))}
                  </section>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-medium text-foreground">请求传参</p>
                      <button
                        type="button"
                        aria-label="复制请求传参"
                        title="一键复制"
                        onClick={() => void handleCopyPayload()}
                        className={cn(
                          'inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-medium',
                          'border border-border/40 bg-background/80 text-muted-foreground backdrop-blur-sm',
                          'transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50',
                        )}
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                            已复制
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            一键复制
                          </>
                        )}
                      </button>
                    </div>
                    <pre
                      className={cn(
                        'max-h-64 overflow-auto rounded-xl border border-border/50',
                        'bg-muted/30 p-3 text-[11px] leading-relaxed font-mono text-foreground/90',
                      )}
                    >
                      {formatPreviewPayload(preview)}
                    </pre>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-border/20 px-6 py-4 shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={confirmDisabled}
                    onClick={onConfirm}
                    className={cn(
                      'rounded-xl px-5 py-2 text-sm font-medium transition-all',
                      'bg-cyan-600 text-white hover:bg-cyan-500',
                      'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  >
                    确认生成
                  </button>
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
