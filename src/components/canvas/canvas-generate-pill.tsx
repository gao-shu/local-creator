// Copyright (c) local-creator. All rights reserved.

import { Loader2, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CanvasGeneratePillProps {
  testId?: string
  running?: boolean
  disabled?: boolean
  variant?: 'light' | 'dark'
  className?: string
  onClick: () => void
  /** @deprecated ignored */
  showGenerateCost?: boolean
  /** @deprecated ignored */
  generateCost?: number | null
  /** @deprecated ignored */
  generateCostLoading?: boolean
}

export function CanvasGeneratePill({
  testId,
  running = false,
  disabled = false,
  variant = 'light',
  className,
  onClick,
}: CanvasGeneratePillProps) {
  if (variant === 'dark') {
    return (
      <button
        type="button"
        data-testid={testId}
        disabled={disabled || running}
        onClick={(event) => {
          event.stopPropagation()
          onClick()
        }}
        title="生成"
        aria-label="生成"
        className={cn(
          'nodrag nopan inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 transition-all',
          'border border-white/12 bg-white/[0.08] text-white/90',
          'hover:bg-white/[0.14] hover:border-white/20 active:scale-[0.98]',
          'disabled:cursor-not-allowed disabled:opacity-45',
          className,
        )}
      >
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin text-white/75" />
        ) : (
          <Send className="h-3.5 w-3.5 text-white/75" strokeWidth={2.25} />
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled || running}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      title="生成"
      aria-label="生成"
      className={cn(
        'inline-flex h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3.5',
        'bg-[#ececee] text-[#111827] shadow-sm shadow-black/10',
        'hover:bg-white active:scale-[0.99] transition-all',
        'disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
    >
      {running ? (
        <Loader2 className="h-4 w-4 animate-spin text-[#111827]/70" />
      ) : (
        <Send className="h-3.5 w-3.5 text-[#111827]/70" strokeWidth={2.25} />
      )}
    </button>
  )
}
