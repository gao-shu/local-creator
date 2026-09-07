// Copyright (c) Haode AI. All rights reserved.

import { Loader2, Send } from 'lucide-react'
import { HaodouIcon } from '@/components/ui/haodou-icon'
import { cn } from '@/lib/utils'

interface CanvasGeneratePillProps {
  testId?: string
  running?: boolean
  disabled?: boolean
  variant?: 'light' | 'dark'
  className?: string
  onClick: () => void
  /** 展示好豆扣费（替代「生成」文案） */
  showHaodou?: boolean
  haodouCost?: number | null
  haodouLoading?: boolean
}

function formatHaodouCost(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function GeneratePillContent({
  running,
  showHaodou,
  haodouCost,
  haodouLoading,
  iconClassName,
  costClassName,
}: {
  running: boolean
  showHaodou: boolean
  haodouCost?: number | null
  haodouLoading?: boolean
  iconClassName?: string
  costClassName?: string
}) {
  if (running || (showHaodou && haodouLoading)) {
    return <Loader2 className={cn('h-4 w-4 animate-spin', iconClassName)} />
  }

  if (showHaodou) {
    const cost =
      haodouCost != null && haodouCost > 0 ? formatHaodouCost(haodouCost) : '0'
    return (
      <>
        <span className={cn('text-[13px] font-semibold tabular-nums', costClassName)}>{cost}</span>
        <HaodouIcon />
        <Send className={cn('h-3.5 w-3.5', iconClassName)} strokeWidth={2.25} />
      </>
    )
  }

  return <Send className={cn('h-3.5 w-3.5', iconClassName)} strokeWidth={2.25} />
}

/** 画布节点生成按钮：light 为浅色胶囊，dark 融入暗色控制台 */
export function CanvasGeneratePill({
  testId,
  running = false,
  disabled = false,
  variant = 'light',
  className,
  onClick,
  showHaodou = false,
  haodouCost,
  haodouLoading = false,
}: CanvasGeneratePillProps) {
  const busy = running || haodouLoading

  if (variant === 'dark') {
    return (
      <button
        type="button"
        data-testid={testId}
        disabled={disabled || busy}
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
        <GeneratePillContent
          running={running}
          showHaodou={showHaodou}
          haodouCost={haodouCost}
          haodouLoading={haodouLoading}
          iconClassName="text-white/75"
          costClassName="text-[12px] font-medium"
        />
      </button>
    )
  }

  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled || busy}
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
      <GeneratePillContent
        running={running}
        showHaodou={showHaodou}
        haodouCost={haodouCost}
        haodouLoading={haodouLoading}
        iconClassName="text-[#111827]/70"
      />
    </button>
  )
}
