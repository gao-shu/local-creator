// Copyright (c) local-creator contributors. All rights reserved.

import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { Film, ImageIcon, X } from 'lucide-react'
import {
  HoverImagePreviewPortal,
  useHoverImagePreview,
} from '@/components/workshop/hover-image-preview'
import { useCanvasImagePreview, useCanvasVideoPreview } from '@/hooks/use-canvas-media-preview'
import { resolveCanvasAgentNodeTypeLabel } from '@/lib/canvas/canvas-agent-service'
import type { CanvasAgentNodeSummary } from '@/lib/canvas/canvas-agent-types'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import { cn } from '@/lib/utils'

interface CanvasAgentReferenceChipProps {
  summary: CanvasAgentNodeSummary
  projectId: string
  onRemove: () => void
}

export function CanvasAgentReferenceChip({
  summary,
  projectId,
  onRemove,
}: CanvasAgentReferenceChipProps) {
  const chipRef = useRef<HTMLDivElement>(null)
  const isVideo = summary.type === CANVAS_NODE_TYPES.storyVideo
  const name = summary.displayName || summary.label
  const typeLabel = resolveCanvasAgentNodeTypeLabel(summary.type)

  const { src: imageSrc } = useCanvasImagePreview(
    isVideo ? undefined : summary.previewPath,
    projectId,
    summary.previewOwnerKind,
    summary.previewOwnerProjectId,
  )
  const { src: videoSrc } = useCanvasVideoPreview(
    isVideo ? summary.previewPath : undefined,
    projectId,
    summary.previewOwnerKind,
    summary.previewOwnerProjectId,
  )
  const previewSrc = isVideo ? videoSrc : imageSrc
  const { preview, show, hide } = useHoverImagePreview(160)

  const showPreview = () => {
    if (!previewSrc || !chipRef.current) return
    show(previewSrc, chipRef.current.getBoundingClientRect())
  }

  return (
    <>
      <div
        ref={chipRef}
        className={cn(
          'group relative inline-flex max-w-[148px] shrink-0 items-center gap-1.5 rounded-full',
          'border border-violet-400/35 bg-background/90 py-1 pl-1 pr-2 shadow-sm',
          'hover:border-violet-400/55 hover:bg-violet-500/5',
        )}
        title={`${typeLabel} · ${name}`}
        onMouseEnter={showPreview}
        onMouseLeave={hide}
      >
        <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-muted/50">
          {previewSrc ? (
            isVideo ? (
              <video
                src={previewSrc}
                className="h-full w-full object-cover"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <img src={previewSrc} alt="" className="h-full w-full object-cover" draggable={false} />
            )
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted-foreground">
              {isVideo ? <Film className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
            </span>
          )}
        </span>
        <span className="min-w-0 truncate text-[11px] font-medium text-foreground">{name}</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            hide()
            onRemove()
          }}
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
            'text-muted-foreground opacity-70 transition-opacity',
            'hover:bg-red-500/15 hover:text-red-500 group-hover:opacity-100',
          )}
          aria-label="移除引用"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {isVideo && preview
        ? createPortal(
            <div
              className="pointer-events-none fixed overflow-hidden rounded-lg border border-white/10 bg-black/95 shadow-2xl"
              style={{ left: preview.x, top: preview.y, zIndex: 10000 }}
            >
              <video
                src={preview.url}
                className="block max-h-[200px] max-w-[280px] object-contain"
                muted
                playsInline
                autoPlay
                preload="metadata"
              />
            </div>,
            document.body,
          )
        : null}
      {!isVideo ? <HoverImagePreviewPortal preview={preview} /> : null}
    </>
  )
}
