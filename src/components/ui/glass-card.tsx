import { cn } from '@/lib/utils'
import * as React from 'react'

export function GlassCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm',
        className,
      )}
      {...props}
    />
  )
}
