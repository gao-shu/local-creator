// Copyright (c) local-creator. All rights reserved.

import type { ModelConfig } from '@/types/settings'
import {
  buildVideoCapabilityDisplay,
  formatVideoModelListPriceLabel,
  formatVideoPricingModeLabel,
} from '@/lib/models/video-model-pricing'
import type { ModelSelectOptionLabels } from '@/lib/models/image-model-display'

export function getVideoModelDisplayTags(model: ModelConfig | null | undefined): string[] {
  if (!model?.videoPricing) return []
  const tags: string[] = []
  const capability = buildVideoCapabilityDisplay(model)
  if (capability.resolutionLabel) tags.push(capability.resolutionLabel)
  const modeLabel = formatVideoPricingModeLabel(model.videoPricing.pricingMode)
  if (modeLabel) tags.push(modeLabel)
  return tags
}

export function formatVideoModelSelectOptionLabels(model: ModelConfig): ModelSelectOptionLabels {
  const priceLabel = formatVideoModelListPriceLabel(model)
  return {
    label: model.name,
    ...(priceLabel ? { suffix: priceLabel } : {}),
  }
}
