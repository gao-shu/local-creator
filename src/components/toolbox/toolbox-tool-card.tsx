// Copyright (c) local-creator contributors. All rights reserved.

import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToolboxToolCardProps {
  title: string
  description: string
  icon: LucideIcon
  iconClassName?: string
  badge?: string
  onClick: () => void
}

export function ToolboxToolCard({
  title,
  description,
  icon: Icon,
  iconClassName,
  badge,
  onClick,
}: ToolboxToolCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex min-h-[148px] w-full flex-col items-start gap-4 rounded-2xl border border-border/30',
        'bg-card/40 p-5 text-left backdrop-blur-sm transition-all',
        'hover:border-primary/30 hover:bg-card/60 hover:shadow-lg hover:shadow-black/10',
      )}
    >
      <div className="flex w-full items-start justify-between gap-2 pr-6">
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/40',
            iconClassName,
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        {badge ? (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <ChevronRight
        className={cn(
          'absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/50',
          'transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground',
        )}
      />
    </button>
  )
}
