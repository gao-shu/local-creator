// Copyright (c) Haode AI. All rights reserved.

import { getBillingPath, type BillingPath } from '@/lib/auth/billing-routing'
import { hasPersistedRealToken, isLoginRequired } from '@/lib/auth/login-mode'
import { resolveImageHaodouCost, resolveImageHaodouCostSync } from '@/lib/models/image-model-pricing'
import { useAuthStore } from '@/stores/auth-store'
import type { ModelConfig } from '@/types/settings'

export type ImageGenerationBillingEstimate = {
  billingPath: BillingPath
  modelName: string
  haodouCost: number | null
  /** 已登录且将走 external 代理扣豆 */
  consumesHaodou: boolean
}

export function estimateImageHaodouCostSync(options: {
  model: ModelConfig | null | undefined
  resolution?: string | null
  quality?: string | null
  quantity?: number
}): ImageGenerationBillingEstimate {
  const model = options.model
  const modelName = model?.name?.trim() || '当前图片模型'
  const billingPath = getBillingPath(model)
  const canChargeHaodou =
    isLoginRequired() && hasPersistedRealToken(useAuthStore.getState().token)
  const haodouCost =
    billingPath === 'haodou' && model
      ? resolveImageHaodouCostSync(model, {
          resolution: options.resolution,
          quality: options.quality,
          quantity: options.quantity,
        })
      : 0

  return {
    billingPath,
    modelName,
    haodouCost: haodouCost > 0 ? haodouCost : null,
    consumesHaodou: billingPath === 'haodou' && haodouCost > 0 && canChargeHaodou,
  }
}

export async function estimateImageHaodouCost(options: {
  model: ModelConfig | null | undefined
  resolution?: string | null
  quality?: string | null
  quantity?: number
  apiBase?: string
}): Promise<ImageGenerationBillingEstimate> {
  const model = options.model
  const modelName = model?.name?.trim() || '当前图片模型'
  const billingPath = getBillingPath(model)
  const canChargeHaodou =
    isLoginRequired() && hasPersistedRealToken(useAuthStore.getState().token)

  if (billingPath !== 'haodou' || !model) {
    return {
      billingPath,
      modelName,
      haodouCost: null,
      consumesHaodou: false,
    }
  }

  const haodouCost = await resolveImageHaodouCost(model, {
    resolution: options.resolution,
    quality: options.quality,
    quantity: options.quantity,
    apiBase: options.apiBase,
  })

  return {
    billingPath,
    modelName,
    haodouCost: haodouCost > 0 ? haodouCost : null,
    consumesHaodou: haodouCost > 0 && canChargeHaodou,
  }
}

export function formatImageHaodouPreviewText(
  estimate: Pick<ImageGenerationBillingEstimate, 'haodouCost' | 'consumesHaodou' | 'modelName'>,
): string | null {
  if (estimate.haodouCost == null || estimate.haodouCost <= 0) return null
  const loginHint = estimate.consumesHaodou ? '' : '（登录后扣费）'
  return `预计 ${estimate.haodouCost} 好豆${loginHint}`
}
