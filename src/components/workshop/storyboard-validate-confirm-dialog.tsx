// Copyright (c) Haode AI. All rights reserved.

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  ParsedValidateIssue,
  StoryboardValidateMode,
} from '@/lib/workflow/storyboard-prompt'
import type { WorkflowShot } from '@/types/workflow'

export interface StoryboardValidateConfirmDialogProps {
  open: boolean
  beforeShots: WorkflowShot[]
  afterShots: WorkflowShot[]
  passed?: boolean
  summary?: string
  issues?: ParsedValidateIssue[]
  mode?: StoryboardValidateMode
  onClose: () => void
  onConfirm: () => void
}

type ValidateRow = {
  shotNumber: number
  shotId: string
  prompt: string
  beforeAnchor: string
  afterAnchor: string
  changed: boolean
}

function buildRows(beforeShots: WorkflowShot[], afterShots: WorkflowShot[]): ValidateRow[] {
  const beforeById = new Map(beforeShots.map((shot) => [shot.id, shot]))
  return afterShots.map((after) => {
    const before = beforeById.get(after.id)
    const beforeAnchor = (before?.spatialAnchor || '').trim()
    const afterAnchor = (after.spatialAnchor || '').trim()
    return {
      shotNumber: after.shotNumber,
      shotId: after.id,
      prompt: (before?.prompt || after.prompt || '').trim(),
      beforeAnchor,
      afterAnchor,
      changed: Boolean(afterAnchor) && afterAnchor !== beforeAnchor,
    }
  })
}

export function StoryboardValidateConfirmDialog({
  open,
  beforeShots,
  afterShots,
  passed,
  summary,
  issues = [],
  mode,
  onClose,
  onConfirm,
}: StoryboardValidateConfirmDialogProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const rows = useMemo(() => buildRows(beforeShots, afterShots), [afterShots, beforeShots])
  const changedCount = useMemo(() => rows.filter((row) => row.changed).length, [rows])
  const hasIssues = issues.length > 0
  /** 有 issues 或显式 passed=false → 警告态；否则视为通过（含旧格式缺字段） */
  const statusOk = passed !== false && !hasIssues
  const modeLabel = mode === 'quick' ? '快速补锚点' : mode === 'deep' ? '深度连续性审查' : null

  const toggleExpanded = (shotId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(shotId)) next.delete(shotId)
      else next.add(shotId)
      return next
    })
  }

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
              <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-border/40 bg-card shadow-2xl shadow-black/30">
                <div className="flex shrink-0 items-start gap-3 px-6 pb-4 pt-6">
                  <div
                    className={cn(
                      'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      hasIssues || passed === false ? 'bg-amber-500/15' : 'bg-primary/10',
                    )}
                  >
                    {hasIssues || passed === false ? (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-base font-semibold leading-snug">
                          空间锚点结果
                          {modeLabel ? (
                            <span className="ml-2 align-middle text-[11px] font-normal text-muted-foreground">
                              · {modeLabel}
                            </span>
                          ) : null}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {changedCount > 0
                            ? `共 ${rows.length} 镜，${changedCount} 镜待写入空间锚点。与镜头「审核」分镜图无关；应用后只改空间锚点，不改 prompt。`
                            : `共 ${rows.length} 镜，空间锚点无明显变化。`}
                        </p>
                        {summary || passed !== undefined ? (
                          <p
                            className={cn(
                              'mt-2 rounded-lg border px-2.5 py-1.5 text-xs leading-relaxed',
                              statusOk
                                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200',
                            )}
                            data-testid="workshop-step4-validate-summary"
                          >
                            {statusOk
                              ? '连续性检查通过'
                              : hasIssues
                                ? '连续性有提示，仍可应用锚点'
                                : '连续性检查未完全通过'}
                            {summary ? ` · ${summary}` : ''}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-muted"
                        aria-label="关闭"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className="min-h-0 space-y-2 overflow-y-auto px-6 pb-4"
                  data-testid="workshop-step4-validate-result-list"
                >
                  {hasIssues ? (
                    <div
                      className="space-y-1.5 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5"
                      data-testid="workshop-step4-validate-issues"
                    >
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                        发现问题（{issues.length}）
                      </p>
                      <ul className="space-y-1.5">
                        {issues.map((issue, index) => (
                          <li
                            key={`${issue.shotNumber ?? 'x'}-${issue.type}-${index}`}
                            className="rounded-lg bg-background/50 px-2.5 py-2 text-xs leading-relaxed"
                          >
                            <div className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
                              {issue.shotNumber != null ? (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                                  镜 #{issue.shotNumber}
                                </span>
                              ) : null}
                              <span className="text-[10px] text-muted-foreground">{issue.type}</span>
                            </div>
                            <p className="mt-1 text-foreground/90">{issue.problem}</p>
                            {issue.suggestion ? (
                              <p className="mt-0.5 text-muted-foreground">建议：{issue.suggestion}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {rows.map((row) => {
                    const expanded = expandedIds.has(row.shotId)
                    return (
                      <div
                        key={row.shotId}
                        className={cn(
                          'rounded-xl border px-3 py-2.5',
                          row.changed
                            ? 'border-primary/25 bg-primary/5'
                            : 'border-border/30 bg-muted/10',
                        )}
                      >
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 text-left"
                          onClick={() => toggleExpanded(row.shotId)}
                        >
                          {expanded ? (
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">镜 #{row.shotNumber}</span>
                              {row.changed ? (
                                <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                  已更新
                                </span>
                              ) : (
                                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  无变化
                                </span>
                              )}
                            </div>
                            <p className="line-clamp-2 text-xs leading-relaxed text-foreground/90">
                              {row.afterAnchor || '（无空间锚点）'}
                            </p>
                          </div>
                        </button>

                        {expanded ? (
                          <div className="mt-2 space-y-2 border-t border-border/20 pt-2 pl-6 text-xs">
                            <div>
                              <p className="mb-0.5 text-muted-foreground">原空间锚点</p>
                              <p className="whitespace-pre-wrap leading-relaxed text-foreground/80">
                                {row.beforeAnchor || '（空）'}
                              </p>
                            </div>
                            <div>
                              <p className="mb-0.5 text-muted-foreground">新空间锚点</p>
                              <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                                {row.afterAnchor || '（空）'}
                              </p>
                            </div>
                            {row.prompt ? (
                              <div>
                                <p className="mb-0.5 text-muted-foreground">当前 prompt（只读，不会被改写）</p>
                                <p className="line-clamp-4 whitespace-pre-wrap leading-relaxed text-muted-foreground">
                                  {row.prompt}
                                </p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>

                <div className="flex shrink-0 justify-end gap-3 border-t border-border/20 px-6 py-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                    data-testid="workshop-step4-validate-dismiss"
                  >
                    暂不应用
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
                    data-testid="workshop-step4-validate-apply"
                  >
                    应用修改
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
