// Copyright (c) local-creator contributors. All rights reserved.

import { cn } from '@/lib/utils'
import { getImageModelDisplayTags } from '@/lib/models/image-model-display'
import type { ModelConfig } from '@/types/settings'

type ImageModelCapabilityTagsProps = {
  model: ModelConfig
  className?: string
  tagClassName?: string
}

/** 图片模型能力 Tag（分辨率 / 计价模式 / 质量档 / 比例数） */
export function ImageModelCapabilityTags({
  model,
  className,
  tagClassName,
}: ImageModelCapabilityTagsProps) {
  const tags = getImageModelDisplayTags(model)
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
