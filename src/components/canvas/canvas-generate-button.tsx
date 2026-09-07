// Copyright (c) Haode AI. All rights reserved.

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CanvasGenerateButtonProps {
  label?: string
  running?: boolean
  disabled?: boolean
  className?: string
  onClick: () => void
}

export function CanvasGenerateButton({
  label = '生成',
  running = false,
  disabled = false,
  className,
  onClick,
}: CanvasGenerateButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || running}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-5',
        'bg-[#ececee] text-[#111827] text-sm font-semibold',
        'shadow-sm shadow-black/10 hover:bg-white active:scale-[0.99]',
        'transition-all disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
    >
      {running ? <Loader2 className="h-4 w-4 animate-spin text-[#111827]" /> : <span>{label}</span>}
    </button>
  )
}
