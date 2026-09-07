import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import * as React from 'react'

export function LoadingState({ label = '加载中...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-muted-foreground text-sm">{label}</span>
    </div>
  )
}

interface EmptyStateProps {
  icon?: React.ReactNode
  message: string
  onClick?: () => void
  className?: string
}

export function EmptyState({
  icon,
  message,
  onClick,
  className,
}: EmptyStateProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-dashed border-border/40 p-16',
        'flex flex-col items-center justify-center text-center',
        'bg-card/20 hover:border-border/60 transition-colors',
        onClick ? 'cursor-pointer' : '',
        className,
      )}
    >
      {icon}
      <p className="text-muted-foreground text-sm mt-4">{message}</p>
    </div>
  )
}
