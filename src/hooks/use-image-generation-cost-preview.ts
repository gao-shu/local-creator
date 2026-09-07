// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useState } from 'react'
import { getBillingPath } from '@/lib/auth/billing-routing'
import {
  estimateImageHaodouCost,
  formatImageHaodouPreviewText,
  type ImageGenerationBillingEstimate,
} from '@/lib/auth/image-billing-display'
import {
  shouldShowImageGenerationTierControls,
  type ImageGenerationTierParams,
} from '@/lib/models/image-generation-tier-params'
import type { ModelConfig } from '@/types/settings'

export function useImageGenerationCostPreview(options: {
  model: ModelConfig | null | undefined
  tierParams: ImageGenerationTierParams
  apiBase?: string
  enabled?: boolean
}): {
  estimate: ImageGenerationBillingEstimate | null
  previewText: string | null
  loading: boolean
} {
  const enabled = options.enabled !== false
  const model = options.model
  const tierParams = options.tierParams
  const resolution = tierParams.resolution
  const quality = tierParams.quality

  const [estimate, setEstimate] = useState<ImageGenerationBillingEstimate | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !model || !shouldShowImageCostHint(model)) {
      setEstimate(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void estimateImageHaodouCost({
      model,
      resolution,
      quality,
      apiBase: options.apiBase,
    })
      .then((next) => {
        if (!cancelled) setEstimate(next)
      })
      .catch(() => {
        if (!cancelled) setEstimate(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    enabled,
    model?.id,
    model?.modelKey,
    model?.imagePricing?.pricingMode,
    resolution,
    quality,
    options.apiBase,
  ])

  const previewText = estimate ? formatImageHaodouPreviewText(estimate) : null

  return { estimate, previewText, loading }
}

export function shouldShowImageCostHint(model: ModelConfig | null | undefined): boolean {
  if (!model) return false
  return getBillingPath(model) === 'haodou'
}

export function shouldPreviewImageGenerationCost(model: ModelConfig | null | undefined): boolean {
  if (!model) return false
  return shouldShowImageGenerationTierControls(model) || shouldShowImageCostHint(model)
}
