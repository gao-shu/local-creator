import { ShieldCheck } from 'lucide-react'
import type { AssetReviewVisualState } from '@/lib/workflow/asset-review-status'
import { cn } from '@/lib/utils'

interface ReviewShieldBadgeProps {
  state: AssetReviewVisualState
  title?: string
  /** overlay：大图角标；chip：列表头像角标；inline：带文案行内徽章；ribbon：大图左上角醒目条 */
  variant?: 'overlay' | 'chip' | 'inline' | 'ribbon'
  size?: 'default' | 'compact'
  className?: string
  label?: string
}

const STATE_CLASS: Record<Exclude<AssetReviewVisualState, 'none'>, string> = {
  approved: 'bg-emerald-500 text-white border-emerald-400/50 shadow-emerald-500/30',
  processing: 'bg-amber-500 text-white border-amber-400/50 shadow-amber-500/30 animate-pulse',
  failed: 'bg-red-500 text-white border-red-400/50 shadow-red-500/30',
}

const COMPACT_STATE_CLASS: Record<Exclude<AssetReviewVisualState, 'none'>, string> = {
  approved: 'bg-emerald-500/12 text-emerald-500 border-emerald-500/35',
  processing: 'bg-amber-500/12 text-amber-500 border-amber-500/35 animate-pulse',
  failed: 'bg-red-500/12 text-red-400 border-red-500/35',
}

export function ReviewShieldBadge({
  state,
  title,
  variant = 'overlay',
  size = 'default',
  className,
  label,
}: ReviewShieldBadgeProps) {
  if (state === 'none') return null

  const displayLabel = label ?? ''
  const compact = size === 'compact'

  if (variant === 'inline') {
    return (
      <span
        title={title}
        className={cn(
          'inline-flex items-center shrink-0 rounded-full border',
          compact
            ? displayLabel
              ? 'gap-0.5 text-[10px] font-medium px-1.5 py-0.5 leading-none'
              : 'p-0.5 leading-none'
            : 'gap-1.5 text-xs font-semibold px-2.5 py-1 shadow-sm',
          compact ? COMPACT_STATE_CLASS[state] : STATE_CLASS[state],
          className,
        )}
      >
        <ShieldCheck
          className={cn('shrink-0', compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5')}
          strokeWidth={2.5}
        />
        {displayLabel ? <span className="whitespace-nowrap">{displayLabel}</span> : null}
      </span>
    )
  }

  if (variant === 'ribbon') {
    return (
      <span
        title={title}
        className={cn(
          'absolute left-2 top-2 z-[12] inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-lg ring-2 ring-background/80 pointer-events-none',
          STATE_CLASS[state],
          className,
        )}
      >
        <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2.5} />
        {displayLabel ? <span className="whitespace-nowrap">{displayLabel}</span> : null}
      </span>
    )
  }

  if (variant === 'chip') {
    return (
      <span
        title={title}
        className={cn(
          'absolute -bottom-0.5 -right-0.5 z-[5] inline-flex items-center justify-center rounded-full border-2 border-background shadow-sm',
          compact ? 'h-4 w-4' : 'h-6 w-6 shadow-md',
          STATE_CLASS[state],
          className,
        )}
      >
        <ShieldCheck
          className={cn('shrink-0', compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5')}
          strokeWidth={2.5}
        />
      </span>
    )
  }

  return (
    <span
      title={title}
      className={cn(
        'absolute right-2 top-2 z-[12] inline-flex h-7 w-7 items-center justify-center rounded-lg border-2 border-background shadow-lg',
        STATE_CLASS[state],
        className,
      )}
    >
      <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={2.5} />
    </span>
  )
}
