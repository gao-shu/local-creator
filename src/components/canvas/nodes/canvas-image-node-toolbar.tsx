// Copyright (c) local-creator contributors. All rights reserved.

import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CanvasImageShieldBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm',
        className,
      )}
    >
      <Shield className="h-3.5 w-3.5 text-white/90" strokeWidth={1.8} />
    </div>
  )
}
