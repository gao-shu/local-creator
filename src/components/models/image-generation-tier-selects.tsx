// Copyright (c) local-creator contributors. All rights reserved.

import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  normalizeImageGenerationTierParams,
  resolveImageQualityOptions,
  resolveImageResolutionOptions,
  shouldShowImageGenerationTierControls,
  shouldShowImageQualitySelector,
  shouldShowImageResolutionSelector,
  type ImageGenerationTierParams,
} from '@/lib/models/image-generation-tier-params'
import type { ModelConfig, ImageQuality } from '@/types/settings'

export type ImageGenerationTierSelectsProps = {
  model: ModelConfig | null | undefined
  value: ImageGenerationTierParams
  onChange: (next: ImageGenerationTierParams) => void
  compactSelectClass?: string
  resolutionWidthClass?: string
  qualityWidthClass?: string
  className?: string
}

/** 生图计价档：分辨率 / 质量选择（按模型能力显隐） */
export function ImageGenerationTierSelects({
  model,
  value,
  onChange,
  compactSelectClass,
  resolutionWidthClass = '!w-[56px]',
  qualityWidthClass = '!w-[52px]',
  className,
}: ImageGenerationTierSelectsProps) {
  if (!shouldShowImageGenerationTierControls(model)) return null

  const resolutionOptions = resolveImageResolutionOptions(model)
  const qualityOptions = resolveImageQualityOptions(model)
  const showResolution = shouldShowImageResolutionSelector(model)
  const showQuality = shouldShowImageQualitySelector(model)
  const normalized = normalizeImageGenerationTierParams(model, value)

  const patch = (next: Partial<ImageGenerationTierParams>) => {
    onChange(
      normalizeImageGenerationTierParams(model, {
        resolution: next.resolution ?? normalized.resolution,
        quality: next.quality ?? normalized.quality,
      }),
    )
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {showResolution && normalized.resolution ? (
        <Select
          value={normalized.resolution}
          onChange={(next) => patch({ resolution: next })}
          options={resolutionOptions}
          placeholder="分辨率"
          className={cn(compactSelectClass, resolutionWidthClass)}
        />
      ) : null}
      {showQuality && normalized.quality ? (
        <Select
          value={normalized.quality}
          onChange={(next) => patch({ quality: next as ImageQuality })}
          options={qualityOptions}
          placeholder="质量"
          className={cn(compactSelectClass, qualityWidthClass)}
        />
      ) : null}
    </div>
  )
}
