// Copyright (c) Haode AI. All rights reserved.

import {
  buildVideoBatchBillingLines,
  estimateVideoBatchBilling,
  type VideoBatchBillingEstimate,
  type VideoBatchBillingLine,
} from '@/lib/auth/billing-display'
import type { ModelConfig } from '@/types/settings'

/** @deprecated 使用 VideoBatchBillingEstimate */
export type CanvasVideoBatchCostEstimate = VideoBatchBillingEstimate & {
  /** @deprecated 使用 perShotHaodou */
  perShotCost: number | null
  /** @deprecated 使用 totalHaodou */
  totalCost: number | null
}

function toLegacyEstimate(estimate: VideoBatchBillingEstimate): CanvasVideoBatchCostEstimate {
  return {
    ...estimate,
    perShotCost: estimate.perShotHaodou,
    totalCost: estimate.totalHaodou,
  }
}

/** 估算画布批量视频生成计费（好豆 / 项目统计） */
export function estimateCanvasVideoBatchCost(options: {
  videoModel: ModelConfig | null | undefined
  shotCount: number
  durationSec?: number
  resolution?: string | null
}): CanvasVideoBatchCostEstimate {
  return toLegacyEstimate(estimateVideoBatchBilling(options))
}

export function formatCanvasVideoBatchCostLine(estimate: CanvasVideoBatchCostEstimate): string {
  return buildVideoBatchBillingLines(estimate)
    .map((line) => line.text)
    .join(' ')
}

export { buildVideoBatchBillingLines, type VideoBatchBillingLine }
