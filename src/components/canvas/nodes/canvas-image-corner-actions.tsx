// Copyright (c) local-creator contributors. All rights reserved.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Maximize2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { downloadImagePreview } from '@/lib/canvas/canvas-image-actions'
import {
  CANVAS_NODE_OVERLAY_ACTION,
  CANVAS_NODE_OVERLAY_ACTION_DANGER,
  CANVAS_NODE_OVERLAY_ACTION_PRIMARY,
} from '@/lib/canvas/canvas-node-theme'
import { useCanvasNodeSharpScale } from '@/hooks/use-canvas-node-sharp-scale'
import { cn } from '@/lib/utils'

interface CanvasImageCornerActionsProps {
  previewSrc: string
  onDelete: () => void
}

export function CanvasImageCornerActions({
  previewSrc,
  onDelete,
}: CanvasImageCornerActionsProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const sharpScale = useCanvasNodeSharpScale({ transformOrigin: 'top right' })

  if (!previewSrc) return null

  return (
    <>
      <div
        style={sharpScale.style}
        className={cn(
          'absolute right-2 top-2 z-[3] flex items-center gap-1.5 nodrag nopan',
          'pointer-events-none opacity-0 transition-opacity duration-150',
          'group-hover/preview:pointer-events-auto group-hover/preview:opacity-100',
        )}
      >
        <button
          type="button"
          title="下载"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            try {
              downloadImagePreview(previewSrc)
            } catch {
              toast.error('下载失败')
            }
          }}
          className={CANVAS_NODE_OVERLAY_ACTION_PRIMARY}
        >
          <Download className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          title="放大预览"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            setPreviewOpen(true)
          }}
          className={CANVAS_NODE_OVERLAY_ACTION}
        >
          <Maximize2 className="h-4 w-4" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          title="删除图片"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          className={CANVAS_NODE_OVERLAY_ACTION_DANGER}
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>

      {previewOpen
        ? createPortal(
            <button
              type="button"
              aria-label="关闭预览"
              className="fixed inset-0 z-[220] flex items-center justify-center bg-black/88 p-6"
              onClick={() => setPreviewOpen(false)}
            >
              <img
                src={previewSrc}
                alt=""
                className="max-h-[92vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              />
            </button>,
            document.body,
          )
        : null}
    </>
  )
}
