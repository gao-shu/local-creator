// Copyright (c) Haode AI. All rights reserved.

import { cn } from '@/lib/utils'

type VideoGenerationCostHintProps = {
  text?: string | null
  loading?: boolean
  className?: string
}

/** 生视频好豆预估（quote / 默认档 sync） */
export function VideoGenerationCostHint({
  text,
  loading = false,
  className,
}: VideoGenerationCostHintProps) {
  if (!loading && !text) return null

  return (
    <p className={cn('text-[10px] text-amber-600/90 dark:text-amber-400/90 truncate', className)}>
      {loading ? '询价中…' : text}
    </p>
  )
}
