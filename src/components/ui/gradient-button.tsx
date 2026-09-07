import { cn } from '@/lib/utils'
import * as React from 'react'

interface GradientButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export function GradientButton({
  className,
  children,
  ...props
}: GradientButtonProps) {
  return (
    <button
      className={cn(
        'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium',
        'bg-linear-to-r from-blue-600 to-purple-600',
        'text-white shadow-lg shadow-blue-500/20',
        'hover:shadow-blue-500/30 hover:scale-[1.02]',
        'active:scale-[0.98] transition-all duration-200',
        'disabled:opacity-50 disabled:pointer-events-none',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
