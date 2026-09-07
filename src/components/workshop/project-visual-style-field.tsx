// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useState } from 'react'
import { Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ProjectVisualStylePicker } from '@/components/workshop/project-visual-style-picker'
import type { AppSettings } from '@/types/settings'
import {
  buildProjectVisualStylePatch,
  resolveProjectStylePresetKey,
  resolveProjectVisualStyleSummary,
} from '@/lib/workflow/project-visual-style'

interface ProjectVisualStyleFieldProps {
  settings: AppSettings | null | undefined
  presetKey: string
  onApply: (patch: ReturnType<typeof buildProjectVisualStylePatch>) => void
  compact?: boolean
}

/** Step1 内嵌 / Step2 摘要 + 更改 */
export function ProjectVisualStyleField({
  settings,
  presetKey,
  onApply,
  compact = false,
}: ProjectVisualStyleFieldProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draftKey, setDraftKey] = useState(presetKey)
  const resolvedKey = resolveProjectStylePresetKey({ projectStylePresetKey: presetKey }, settings)
  const summary = resolveProjectVisualStyleSummary({ projectStylePresetKey: resolvedKey }, settings)

  useEffect(() => {
    if (!dialogOpen) setDraftKey(resolvedKey)
  }, [dialogOpen, resolvedKey])

  if (compact) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-muted/5 px-3 py-2">
          <Palette className="h-3.5 w-3.5 text-primary/75 shrink-0" />
          <span className="text-xs text-muted-foreground">项目风格</span>
          <span className="text-xs font-medium text-foreground">
            {summary.categoryLabel} · {summary.presetLabel}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-[11px] ml-auto"
            data-testid="workshop-project-style-change"
            onClick={() => setDialogOpen(true)}
          >
            更改
          </Button>
        </div>

        <ConfirmDialog
          open={dialogOpen}
          title="更改作品视觉风格"
          content={
            <ProjectVisualStylePicker
              settings={settings}
              presetKey={draftKey}
              compact
              onChange={setDraftKey}
            />
          }
          confirmLabel="保存"
          cancelLabel="取消"
          contentClassName="!items-start !pt-8"
          panelClassName="max-w-3xl"
          onClose={() => setDialogOpen(false)}
          onConfirm={() => {
            onApply(buildProjectVisualStylePatch(draftKey))
            setDialogOpen(false)
          }}
        />
      </>
    )
  }

  return (
    <div className="rounded-xl border border-border/55 bg-card/45 px-4 py-4">
      <ProjectVisualStylePicker
        settings={settings}
        presetKey={resolvedKey}
        onChange={(nextKey) => onApply(buildProjectVisualStylePatch(nextKey))}
      />
    </div>
  )
}
