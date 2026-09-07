// Copyright (c) Haode AI. All rights reserved.

import { cn } from '@/lib/utils'

/** 好豆货币图标（侧栏余额、账户页、画布生成按钮等） */
export function HaodouIcon({
  className,
  size = 14,
}: {
  className?: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <ellipse cx="8" cy="8.5" rx="5.5" ry="6" className="fill-amber-500/90" />
      <path
        d="M5.5 6.5c1.2-1.4 4.3-1.4 5.5 0"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        className="text-amber-200/80"
      />
    </svg>
  )
}
