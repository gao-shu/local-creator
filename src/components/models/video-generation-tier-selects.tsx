// Copyright (c) Haode AI. All rights reserved.

import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  normalizeVideoGenerationTierParams,
  resolveVideoResolutionOptions,
  shouldShowVideoResolutionSelector,
  type VideoGenerationTierParams,
} from '@/lib/models/video-generation-tier-params'
import type { ModelConfig } from '@/types/settings'

export type VideoGenerationTierSelectsProps = {
  model: ModelConfig | null | undefined
  value: VideoGenerationTierParams
  onChange: (next: VideoGenerationTierParams) => void
  compactSelectClass?: string
  resolutionWidthClass?: string
  className?: string
}

/** 生视频计价档：分辨率选择（按模型开放列表显隐） */
export function VideoGenerationTierSelects({
  model,
  value,
  onChange,
  compactSelectClass,
  resolutionWidthClass = '!w-[72px]',
  className,
}: VideoGenerationTierSelectsProps) {
  if (!shouldShowVideoResolutionSelector(model)) return null

  const resolutionOptions = resolveVideoResolutionOptions(model)
  const normalized = normalizeVideoGenerationTierParams(model, value)

  return (
    <Select
      value={normalized.resolution ?? undefined}
      onChange={(next) =>
        onChange(
          normalizeVideoGenerationTierParams(model, {
            resolution: next,
          }),
        )
      }
      options={resolutionOptions}
      placeholder="分辨率"
      className={cn(compactSelectClass, resolutionWidthClass, className)}
    />
  )
}

export { shouldShowVideoResolutionSelector as shouldShowVideoGenerationTierControls }
