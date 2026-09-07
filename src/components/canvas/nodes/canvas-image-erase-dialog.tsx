// Copyright (c) Haode AI. All rights reserved.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { CANVAS_INPUT_PLACEHOLDER } from '@/lib/canvas/canvas-node-theme'
import { cn } from '@/lib/utils'

interface CanvasImageEraseDialogProps {
  open: boolean
  running?: boolean
  onClose: () => void
  onConfirm: (instruction: string) => void
}

/** 局部擦除：描述要擦除/补全的区域（参考图画镜 inpaint 流程的简化版） */
export function CanvasImageEraseDialog({
  open,
  running,
  onClose,
  onConfirm,
}: CanvasImageEraseDialogProps) {
  const [instruction, setInstruction] = useState('')

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1b1f] p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14px] font-medium text-white">局部擦除</h3>
          <button type="button" className="text-white/50 hover:text-white" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-2 text-[12px] leading-relaxed text-white/55">
          描述需要擦除或自然补全的区域（例如：去掉路人、修复天空）。将基于当前图片进行图生图重绘。
        </p>
        <textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="例如：擦除画面右侧的路人，保持背景自然"
          rows={4}
          className={cn(
            'w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white outline-none focus:border-primary/50',
            CANVAS_INPUT_PLACEHOLDER,
          )}
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-[12px] text-white/65 hover:bg-white/[0.06]"
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/90 px-3 py-1.5 text-[12px] text-white hover:bg-primary disabled:opacity-50"
            onClick={() => onConfirm(instruction)}
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            开始擦除
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
