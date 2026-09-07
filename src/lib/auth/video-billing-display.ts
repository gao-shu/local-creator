// Copyright (c) Haode AI. All rights reserved.

import { getBillingPath, type BillingPath } from '@/lib/auth/billing-routing'
import { hasPersistedRealToken, isLoginRequired } from '@/lib/auth/login-mode'
import {
  resolveVideoHaodouCost,
  resolveVideoHaodouCostSync,
} from '@/lib/models/video-model-pricing'
import { useAuthStore } from '@/stores/auth-store'
import type { ModelConfig } from '@/types/settings'

export type VideoGenerationBillingEstimate = {
  billingPath: BillingPath
  modelName: string
  durationSec: number
  haodouCost: number | null
  consumesHaodou: boolean
}

export function estimateVideoHaodouCostSync(options: {
  model: ModelConfig | null | undefined
  resolution?: string | null
  durationSec?: number
}): VideoGenerationBillingEstimate {
  const model = options.model
  const modelName = model?.name?.trim() || '当前视频模型'
  const durationSec = Math.max(1, Math.trunc(options.durationSec ?? 5))
  const billingPath = getBillingPath(model)
  const canChargeHaodou =
    isLoginRequired() && hasPersistedRealToken(useAuthStore.getState().token)
  const haodouCost =
    billingPath === 'haodou' && model
      ? resolveVideoHaodouCostSync(model, {
          resolution: options.resolution,
          durationSec,
        })
      : 0

  return {
    billingPath,
    modelName,
    durationSec,
    haodouCost: haodouCost > 0 ? haodouCost : null,
    consumesHaodou: billingPath === 'haodou' && haodouCost > 0 && canChargeHaodou,
  }
}

export async function estimateVideoHaodouCost(options: {
  model: ModelConfig | null | undefined
  resolution?: string | null
  durationSec?: number
  apiBase?: string
}): Promise<VideoGenerationBillingEstimate> {
  const model = options.model
  const modelName = model?.name?.trim() || '当前视频模型'
  const durationSec = Math.max(1, Math.trunc(options.durationSec ?? 5))
  const billingPath = getBillingPath(model)
  const canChargeHaodou =
    isLoginRequired() && hasPersistedRealToken(useAuthStore.getState().token)

  if (billingPath !== 'haodou' || !model) {
    return {
      billingPath,
      modelName,
      durationSec,
      haodouCost: null,
      consumesHaodou: false,
    }
  }

  const haodouCost = await resolveVideoHaodouCost(model, {
    resolution: options.resolution,
    durationSec,
    apiBase: options.apiBase,
  })

  return {
    billingPath,
    modelName,
    durationSec,
    haodouCost: haodouCost > 0 ? haodouCost : null,
    consumesHaodou: haodouCost > 0 && canChargeHaodou,
  }
}

export function formatVideoHaodouPreviewText(
  estimate: Pick<VideoGenerationBillingEstimate, 'haodouCost' | 'consumesHaodou' | 'durationSec'>,
): string | null {
  if (estimate.haodouCost == null || estimate.haodouCost <= 0) return null
  const loginHint = estimate.consumesHaodou ? '' : '（登录后扣费）'
  return `预计 ${estimate.haodouCost} 好豆（${estimate.durationSec}秒）${loginHint}`
}
