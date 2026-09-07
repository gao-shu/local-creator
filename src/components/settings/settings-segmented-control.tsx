/**
 * Copyright (c) local-creator contributors. All rights reserved.
 */

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SettingsSegmentItem = {
  id: string
  label: string
  icon?: LucideIcon
  suffix?: string
}

export function SettingsSegmentedControl({
  items,
  value,
  onChange,
  className,
}: {
  items: SettingsSegmentItem[]
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-2xl border border-border/40 bg-foreground/3 p-1.5',
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = value === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors sm:px-5 sm:py-2.5',
              active
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5',
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
            <span>{item.label}</span>
            {item.suffix ? (
              <span className={cn('text-xs', active ? 'text-background/70' : 'opacity-60')}>
                {item.suffix}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
