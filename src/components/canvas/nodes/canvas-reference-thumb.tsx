// Copyright (c) Haode AI. All rights reserved.

import { X } from 'lucide-react'
import { useCanvasImagePreview } from '@/hooks/use-canvas-media-preview'
import type { CanvasMediaSource } from '@/lib/canvas/canvas-graph-utils'
import { cn } from '@/lib/utils'
import { CANVAS_NODE_SUBTEXT } from '@/lib/canvas/canvas-node-theme'

interface CanvasReferenceThumbProps {
  source: CanvasMediaSource
  projectId: string
  accentClass?: string
  onRemove: () => void
}

export function CanvasReferenceThumb({
  source,
  projectId,
  accentClass,
  onRemove,
}: CanvasReferenceThumbProps) {
  const { src: previewSrc } = useCanvasImagePreview(
    source.path,
    projectId,
    source.ownerKind,
    source.ownerProjectId,
  )

  return (
    <div
      className={cn(
        'relative h-7 w-7 shrink-0 overflow-hidden rounded-md border bg-muted/30 dark:bg-[#1a1b1f]',
        accentClass || 'border-border/40 dark:border-white/10',
      )}
    >
      {previewSrc ? (
        <img src={previewSrc} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className={cn('flex h-full w-full items-center justify-center text-[9px]', CANVAS_NODE_SUBTEXT)}>
          …
        </div>
      )}
      <button
        type="button"
        title="移除参考图"
        className={cn(
          'nodrag nopan absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full',
          'border border-border/50 bg-black/75 text-white/90 shadow-sm',
          'hover:bg-red-500 hover:border-red-400',
        )}
        onClick={(event) => {
          event.stopPropagation()
          onRemove()
        }}
      >
        <X className="h-2.5 w-2.5" strokeWidth={2.5} />
      </button>
    </div>
  )
}
