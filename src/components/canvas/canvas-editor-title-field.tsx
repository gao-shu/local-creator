// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { updateCanvasProject } from '@/lib/storage/canvas-service'
import { useCanvasProjectStore } from '@/stores/canvas-project-store'
import { cn } from '@/lib/utils'

interface CanvasEditorTitleFieldProps {
  projectId: string
  className?: string
}

export function CanvasEditorTitleField({ projectId, className }: CanvasEditorTitleFieldProps) {
  const meta = useCanvasProjectStore((s) => s.activeEditorMeta)
  const setActiveEditorMeta = useCanvasProjectStore((s) => s.setActiveEditorMeta)
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  useEffect(() => {
    setTitleDraft(meta?.title || '')
    setEditing(false)
  }, [meta?.id, meta?.title])

  const commitTitle = useCallback(async () => {
    setEditing(false)
    const nextTitle = titleDraft.trim()
    if (!nextTitle || !meta || nextTitle === meta.title) return
    try {
      const updated = await updateCanvasProject(projectId, { title: nextTitle })
      setActiveEditorMeta(updated)
    } catch {
      setTitleDraft(meta.title)
    }
  }, [meta, projectId, setActiveEditorMeta, titleDraft])

  const displayTitle = meta?.title || '画布项目'

  return (
    <div className={cn('flex min-w-0 max-w-[min(240px,40vw)] items-center gap-1', className)}>
      {editing ? (
        <Input
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={() => void commitTitle()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void commitTitle()
            if (event.key === 'Escape') {
              setTitleDraft(displayTitle)
              setEditing(false)
            }
          }}
          className="h-7 w-[180px] max-w-full rounded-lg border-border/40 bg-card/60 px-2 text-sm font-semibold focus-visible:ring-1"
          autoFocus
        />
      ) : (
        <>
          <span className="truncate text-sm font-semibold">{displayTitle}</span>
          <button
            type="button"
            title="修改名称"
            aria-label="修改名称"
            onClick={() => setEditing(true)}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  )
}
