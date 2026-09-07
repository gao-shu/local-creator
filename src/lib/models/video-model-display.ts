// Copyright (c) Haode AI. All rights reserved.

import type { ModelConfig } from '@/types/settings'
import {
  buildVideoCapabilityDisplay,
  formatVideoModelListPriceLabel,
  formatVideoPricingModeLabel,
} from '@/lib/models/video-model-pricing'
import {
  formatModelSelectOptionLabels,
  getSystemModelBillingBadge,
  type ModelSelectOptionLabels,
} from '@/lib/models/system-model-display'

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
  const badge = getSystemModelBillingBadge(model)

  return {
    label: model.name,
    ...(priceLabel ? { suffix: priceLabel } : {}),
    ...(badge ? { systemBadgeTone: badge.tone } : {}),
  }
}
