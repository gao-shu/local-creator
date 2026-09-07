// Copyright (c) Haode AI. All rights reserved.

import type { ModelConfig } from '@/types/settings'
import {
  buildImageCapabilityDisplay,
  formatImageModelListPriceLabel,
  formatImagePricingModeLabel,
} from '@/lib/models/image-model-pricing'
import { formatVideoModelSelectOptionLabels } from '@/lib/models/video-model-display'
import {
  formatModelSelectOptionLabels,
  getSystemModelBillingBadge,
  type ModelSelectOptionLabels,
} from '@/lib/models/system-model-display'

/** 设置页 / 下拉菜单用的能力 Tag 文案 */
export function getImageModelDisplayTags(model: ModelConfig | null | undefined): string[] {
  if (!model?.imagePricing) return []
  const tags: string[] = []
  const capability = buildImageCapabilityDisplay(model)
  if (capability.resolutionLabel) tags.push(capability.resolutionLabel)
  const modeLabel = formatImagePricingModeLabel(model.imagePricing.pricingMode)
  if (modeLabel) tags.push(modeLabel)
  if (model.imagePricing.supportsQualityModes) tags.push('质量档')
  if (capability.aspectRatioLabel) tags.push(capability.aspectRatioLabel)
  return tags
}

export function formatImageModelSelectOptionLabels(model: ModelConfig): ModelSelectOptionLabels {
  const priceLabel = formatImageModelListPriceLabel(model)
  const badge = getSystemModelBillingBadge(model)

  return {
    label: model.name,
    ...(priceLabel ? { suffix: priceLabel } : {}),
    ...(badge ? { systemBadgeTone: badge.tone } : {}),
  }
}

/** 无分档元数据时回退通用标签逻辑 */
export function formatModelSelectOptionLabelsForKind(
  model: ModelConfig,
  kind: 'llm' | 'image' | 'video',
): ModelSelectOptionLabels {
  if (kind === 'image' && model.imagePricing) {
    return formatImageModelSelectOptionLabels(model)
  }
  if (kind === 'video' && model.videoPricing) {
    return formatVideoModelSelectOptionLabels(model)
  }
  return formatModelSelectOptionLabels(model)
}
