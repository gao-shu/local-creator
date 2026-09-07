// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useMemo, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  STORYBOARD_TEMPLATE_IMPORT_DEFAULTS,
} from '@/lib/canvas/canvas-storyboard-template-spec'
import type { StoryboardTemplateNormalizedShot } from '@/lib/canvas/canvas-storyboard-template-spec'
import { cn } from '@/lib/utils'

export type CanvasStoryboardTemplateImportConfirmPayload = {
  createShotPromptNodes: boolean
  createVideoNodes: boolean
}

interface CanvasStoryboardTemplateImportDialogProps {
  open: boolean
  shots: StoryboardTemplateNormalizedShot[]
  warnings?: string[]
  loading?: boolean
  onClose: () => void
  onConfirm: (payload: CanvasStoryboardTemplateImportConfirmPayload) => void
}

function previewLine(shot: StoryboardTemplateNormalizedShot): string {
  const body = shot.prompt.replace(/\s+/g, ' ').trim()
  const title = `镜头 ${shot.shotNumber}`
  if (!body) return title
  const clipped = body.length > 72 ? `${body.slice(0, 72)}…` : body
  return `${title} · ${clipped}`
}

/** 导入分镜稿确认：预览镜头数 / 产物勾选 */
export function CanvasStoryboardTemplateImportDialog({
  open,
  shots,
  warnings = [],
  loading = false,
  onClose,
  onConfirm,
}: CanvasStoryboardTemplateImportDialogProps) {
  const [createShotPromptNodes, setCreateShotPromptNodes] = useState(
    STORYBOARD_TEMPLATE_IMPORT_DEFAULTS.createShotPromptNodes,
  )
  const [createVideoNodes, setCreateVideoNodes] = useState(
    STORYBOARD_TEMPLATE_IMPORT_DEFAULTS.createVideoNodes,
  )

  useEffect(() => {
    if (!open) return
    setCreateShotPromptNodes(STORYBOARD_TEMPLATE_IMPORT_DEFAULTS.createShotPromptNodes)
    setCreateVideoNodes(STORYBOARD_TEMPLATE_IMPORT_DEFAULTS.createVideoNodes)
  }, [open])

  const previewShots = useMemo(() => shots.slice(0, 3), [shots])
  const confirmDisabled = (!createShotPromptNodes && !createVideoNodes) || shots.length === 0

  return (
    <ConfirmDialog
      open={open}
      title="导入分镜稿"
      confirmLabel="确认导入"
      cancelLabel="取消"
      loading={loading}
      confirmDisabled={confirmDisabled}
      onClose={onClose}
      onConfirm={() =>
        onConfirm({
          createShotPromptNodes,
          createVideoNodes,
        })
      }
      content={
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            已识别 <span className="font-medium text-foreground">{shots.length}</span> 个镜头（本地解析，不调用
            LLM）。源文本节点会保留原文。
          </p>

          {previewShots.length ? (
            <ul className="max-h-[160px] space-y-1.5 overflow-y-auto rounded-xl border border-border/35 bg-muted/20 p-2.5">
              {previewShots.map((shot) => (
                <li
                  key={shot.shotNumber}
                  className="text-[12px] leading-relaxed text-foreground/80"
                  title={shot.prompt}
                >
                  {previewLine(shot)}
                </li>
              ))}
              {shots.length > previewShots.length ? (
                <li className="text-[11px] text-muted-foreground">
                  …还有 {shots.length - previewShots.length} 个镜头
                </li>
              ) : null}
            </ul>
          ) : null}

          <div className="space-y-2 rounded-xl border border-border/30 bg-background/50 px-3 py-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/90">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-border"
                checked={createShotPromptNodes}
                disabled={loading}
                onChange={(event) => setCreateShotPromptNodes(event.target.checked)}
              />
              生成分镜文本节点
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground/90">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-border"
                checked={createVideoNodes}
                disabled={loading}
                onChange={(event) => setCreateVideoNodes(event.target.checked)}
              />
              同步创建空视频节点（写入时长，不自动开跑）
            </label>
            {confirmDisabled ? (
              <p className={cn('text-[11px] text-amber-600 dark:text-amber-400')}>
                请至少勾选一项产物
              </p>
            ) : null}
          </div>

          {warnings.length ? (
            <p className="text-[11px] leading-snug text-amber-600/90 dark:text-amber-400/90">
              {warnings.slice(0, 3).join('；')}
              {warnings.length > 3 ? '…' : ''}
            </p>
          ) : null}
        </div>
      }
    />
  )
}
