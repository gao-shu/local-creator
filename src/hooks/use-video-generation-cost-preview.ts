// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useState } from 'react'
import { getBillingPath } from '@/lib/auth/billing-routing'
import {
  estimateVideoHaodouCost,
  formatVideoHaodouPreviewText,
  type VideoGenerationBillingEstimate,
} from '@/lib/auth/video-billing-display'
import type { VideoGenerationTierParams } from '@/lib/models/video-generation-tier-params'
import { shouldShowVideoResolutionSelector } from '@/lib/models/video-generation-tier-params'
import type { ModelConfig } from '@/types/settings'

export function useVideoGenerationCostPreview(options: {
  model: ModelConfig | null | undefined
  tierParams: VideoGenerationTierParams
  durationSec?: number
  apiBase?: string
  enabled?: boolean
}): {
  estimate: VideoGenerationBillingEstimate | null
  previewText: string | null
  loading: boolean
} {
  const enabled = options.enabled !== false
  const model = options.model
  const resolution = options.tierParams.resolution
  const durationSec = options.durationSec

  const [estimate, setEstimate] = useState<VideoGenerationBillingEstimate | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !model || !shouldShowVideoCostHint(model)) {
      setEstimate(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void estimateVideoHaodouCost({
      model,
      resolution,
      durationSec,
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
    model?.videoPricing?.pricingMode,
    model?.unitPrice,
    model?.haodouCost,
    resolution,
    durationSec,
    options.apiBase,
  ])

  const previewText = estimate ? formatVideoHaodouPreviewText(estimate) : null

  return { estimate, previewText, loading }
}

export function shouldShowVideoCostHint(model: ModelConfig | null | undefined): boolean {
  if (!model) return false
  return getBillingPath(model) === 'haodou'
}

export function shouldPreviewVideoGenerationCost(model: ModelConfig | null | undefined): boolean {
  if (!model) return false
  return shouldShowVideoResolutionSelector(model) || shouldShowVideoCostHint(model)
}
