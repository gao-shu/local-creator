// Copyright (c) local-creator. All rights reserved.

import type { ModelConfig } from '@/types/settings'

export type VideoBatchBillingEstimate = {
  perShotCostEstimate: number | null
  totalCostEstimate: number | null
  shotCount: number
}

export type CanvasVideoBatchCostEstimate = VideoBatchBillingEstimate & {
  perShotCost: number | null
  totalCost: number | null
}

export type VideoBatchBillingLine = { text: string }

export function estimateVideoBatchBilling(_options: {
  videoModel: ModelConfig | null | undefined
  shotCount: number
  durationSec?: number
  resolution?: string | null
}): VideoBatchBillingEstimate {
  return { perShotCostEstimate: null, totalCostEstimate: null, shotCount: _options.shotCount }
}

export function buildVideoBatchBillingLines(_estimate: VideoBatchBillingEstimate): VideoBatchBillingLine[] {
  return []
}

export function estimateCanvasVideoBatchCost(options: {
  videoModel: ModelConfig | null | undefined
  shotCount: number
  durationSec?: number
  resolution?: string | null
}): CanvasVideoBatchCostEstimate {
  const estimate = estimateVideoBatchBilling(options)
  return {
    ...estimate,
    perShotCost: null,
    totalCost: null,
  }
}

export function formatCanvasVideoBatchCostLine(_estimate: CanvasVideoBatchCostEstimate): string {
  return ''
}
