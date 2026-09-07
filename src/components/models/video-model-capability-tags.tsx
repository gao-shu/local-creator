// Copyright (c) Haode AI. All rights reserved.

import { cn } from '@/lib/utils'
import { getVideoModelDisplayTags } from '@/lib/models/video-model-display'
import type { ModelConfig } from '@/types/settings'

type VideoModelCapabilityTagsProps = {
  model: ModelConfig
  className?: string
  tagClassName?: string
}

/** 视频模型能力 Tag（分辨率 / 计价模式） */
export function VideoModelCapabilityTags({
  model,
  className,
  tagClassName,
}: VideoModelCapabilityTagsProps) {
  const tags = getVideoModelDisplayTags(model)
  if (tags.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground',
            tagClassName,
          )}
        >
          {tag}
        </span>
      ))}
    </div>
  )
}
