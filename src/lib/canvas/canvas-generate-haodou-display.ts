// Copyright (c) Haode AI. All rights reserved.

import { shouldChargeHaodou } from '@/lib/auth/billing-routing'
import { resolveModelHaodouCost } from '@/lib/auth/haodou-consume-service'
import { shouldShowImageCostHint } from '@/hooks/use-image-generation-cost-preview'
import { shouldShowVideoCostHint } from '@/hooks/use-video-generation-cost-preview'
import type { ModelConfig } from '@/types/settings'

type HaodouEstimate = {
  haodouCost?: number | null
} | null

/** 画布生成钮：外部 API 模型一律展示「数字 + 好豆图标」，替代「生成」文案 */
export function shouldShowCanvasGenerateHaodou(
  kind: 'image' | 'video' | 'llm',
  model: ModelConfig | null | undefined,
  estimate: HaodouEstimate,
): boolean {
  const showByBilling =
    kind === 'llm'
      ? shouldChargeHaodou(model)
      : kind === 'image'
        ? shouldShowImageCostHint(model)
        : shouldShowVideoCostHint(model)
  if (showByBilling) return true
  return (estimate?.haodouCost ?? 0) > 0
}

export function resolveCanvasGenerateHaodouCost(estimate: HaodouEstimate): number | null {
  if (estimate?.haodouCost == null) return null
  return estimate.haodouCost
}

/** LLM 轻量预估：unitPrice / haodouCost（单次调用 quantity=1；扣费以服务端为准） */
export function estimateLlmCanvasGenerateHaodou(
  model: ModelConfig | null | undefined,
): HaodouEstimate {
  if (!model || !shouldChargeHaodou(model)) return null
  return { haodouCost: resolveModelHaodouCost(model, 'llm') }
}
