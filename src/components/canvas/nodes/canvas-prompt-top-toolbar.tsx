// Copyright (c) Haode AI. All rights reserved.

import { Loader2, Upload } from 'lucide-react'
import { supportedScriptFormatsLabel } from '@/lib/canvas/canvas-prompt-text-import'
import { CANVAS_NODE_TOOLBAR } from '@/lib/canvas/canvas-node-theme'
import { cn } from '@/lib/utils'

interface CanvasPromptTopToolbarProps {
  uploading?: boolean
  disabled?: boolean
  onUpload: () => void
}

export function CanvasPromptTopToolbar({
  uploading = false,
  disabled = false,
  onUpload,
}: CanvasPromptTopToolbarProps) {
  return (
    <div
      className={cn('nodrag nopan flex w-full items-center gap-1 px-1.5 py-1', CANVAS_NODE_TOOLBAR)}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        title={`导入文本（${supportedScriptFormatsLabel()}）`}
        disabled={disabled || uploading}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onUpload()
        }}
        className={cn(
          'nodrag nopan inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5',
          'text-[12px] transition-colors',
          'text-foreground/75 hover:bg-muted/60 hover:text-foreground',
          'dark:text-white/75 dark:hover:bg-white/[0.08] dark:hover:text-white',
          'disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" strokeWidth={2} />
        )}
        <span className="whitespace-nowrap">{uploading ? '导入中…' : '上传'}</span>
      </button>
    </div>
  )
}
