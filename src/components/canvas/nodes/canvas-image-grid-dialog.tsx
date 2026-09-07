// Copyright (c) local-creator contributors. All rights reserved.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import {
  CANVAS_IMAGE_GRID_PRESETS,
  type CanvasImageGridPreset,
} from '@/types/canvas-image-tools'
import { cn } from '@/lib/utils'

interface CanvasImageGridDialogProps {
  open: boolean
  busy?: boolean
  onClose: () => void
  onConfirm: (preset: CanvasImageGridPreset) => void
}

/** 宫格切图：选择切分规格 */
export function CanvasImageGridDialog({ open, busy, onClose, onConfirm }: CanvasImageGridDialogProps) {
  const [preset, setPreset] = useState<CanvasImageGridPreset>('2x2')

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1b1f] p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14px] font-medium text-white">宫格切图</h3>
          <button type="button" className="text-white/50 hover:text-white" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-[12px] text-white/55">将当前图片切分为多个子图，并在画布右侧生成对应图片节点。</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(CANVAS_IMAGE_GRID_PRESETS) as CanvasImageGridPreset[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={cn(
                'rounded-lg border px-3 py-2 text-[13px] transition-colors',
                preset === key
                  ? 'border-primary/60 bg-primary/15 text-white'
                  : 'border-white/10 text-white/70 hover:bg-white/[0.05]',
              )}
            >
              {CANVAS_IMAGE_GRID_PRESETS[key].label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-[12px] text-white/65 hover:bg-white/[0.06]"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/90 px-3 py-1.5 text-[12px] text-white hover:bg-primary disabled:opacity-50"
            onClick={() => onConfirm(preset)}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            开始切分
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
