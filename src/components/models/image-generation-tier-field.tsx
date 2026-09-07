// Copyright (c) local-creator contributors. All rights reserved.

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  shouldShowImageGenerationTierControls,
  type ImageGenerationTierParams,
} from '@/lib/models/image-generation-tier-params'
import { ImageGenerationTierSelects } from '@/components/models/image-generation-tier-selects'
import type { ModelConfig } from '@/types/settings'

export type ImageGenerationTierFieldProps = {
  model: ModelConfig | null | undefined
  value: ImageGenerationTierParams
  onChange: (next: ImageGenerationTierParams) => void
  label?: string
  labelClassName?: string
  className?: string
  selectClassName?: string
}

/** 带标签的生图计价档表单项（Step3 / 分镜 / 画布参数） */
export function ImageGenerationTierField({
  model,
  value,
  onChange,
  label = '计价档',
  labelClassName,
  className,
  selectClassName = 'h-8 text-xs px-2',
}: ImageGenerationTierFieldProps) {
  if (!shouldShowImageGenerationTierControls(model)) return null

  return (
    <div className={cn('space-y-1', className)}>
      {label ? (
        <Label className={cn('text-[10px] text-muted-foreground', labelClassName)}>{label}</Label>
      ) : null}
      <ImageGenerationTierSelects
        model={model}
        value={value}
        onChange={onChange}
        compactSelectClass={selectClassName}
        resolutionWidthClass="!w-[72px]"
        qualityWidthClass="!w-[68px]"
      />
    </div>
  )
}
