// Copyright (c) Haode AI. All rights reserved.

import { resolveApiBase } from '@/lib/auth/api-base'
import type { HaodouConsumeReason } from '@/lib/auth/haodou-labels'
import { shouldChargeHaodou } from '@/lib/auth/billing-routing'
import { hasPersistedRealToken } from '@/lib/auth/login-mode'
import { noteClientSessionFailure } from '@/lib/auth/session-expired'
import {
  computeHaodouChargeAmount,
  resolveHaodouBillingQuantity,
} from '@/lib/models/system-model-unit-price'
import { resolveImageHaodouCostSync } from '@/lib/models/image-model-pricing'
import { resolveVideoHaodouCostSync } from '@/lib/models/video-model-pricing'
import { useAuthStore } from '@/stores/auth-store'
import type { ModelConfig, ModelKind } from '@/types/settings'

export type HaodouConsumeResult = {
  consumed: number
  balance: number
  model_key: string
}

export class HaodouInsufficientError extends Error {
  readonly code = 1070

  constructor(message = '好豆余额不足，请充值后重试') {
    super(message)
    this.name = 'HaodouInsufficientError'
  }
}

function applyHaodouBalance(balance: number): void {
  const { user } = useAuthStore.getState()
  if (!user) return
  useAuthStore.setState({
    user: {
      ...user,
      bells: balance,
      remaining_quota: balance,
      free_quota: balance,
    },
  })
}

async function authPost<T>(path: string, body: unknown, apiBase?: string): Promise<T> {
  const token = useAuthStore.getState().token
  if (!token || !hasPersistedRealToken(token)) {
    throw new Error('未登录')
  }
  const base = resolveApiBase(apiBase).replace(/\/+$/, '')
  const url = base.startsWith('/') ? `${base}${path}` : `${base}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as { code?: number; message?: string; data?: T; detail?: string }
  if (!res.ok) {
    const hint = json.message || (typeof json.detail === 'string' ? json.detail : undefined)
    noteClientSessionFailure(res.status, hint, json.code)
    throw new Error(hint || `好豆请求失败 (${res.status})`)
  }
  if (json.code === 1070) {
    throw new HaodouInsufficientError(json.message || '好豆余额不足，请充值后重试')
  }
  if (json.code !== 0) {
    noteClientSessionFailure(res.status, json.message, json.code)
    throw new Error(json.message || '好豆扣费失败')
  }
  if (!json.data) throw new Error('好豆扣费失败')
  return json.data
}

/** 客户端展示用：external 系统模型预估好豆（扣费以服务端 consume 为准） */
export function resolveModelHaodouCost(
  model: ModelConfig | null | undefined,
  kind: ModelKind,
  options?: { durationSec?: number; resolution?: string | null; quality?: string | null },
): number {
  if (!model || !shouldChargeHaodou(model)) return 0
  const quantity = resolveHaodouBillingQuantity(kind, options)
  if (quantity <= 0) return 0

  if (kind === 'image' && model.imagePricing) {
    return resolveImageHaodouCostSync(model, {
      resolution: options?.resolution,
      quality: options?.quality,
      quantity,
    })
  }

  if (kind === 'video' && model.videoPricing) {
    return resolveVideoHaodouCostSync(model, {
      resolution: options?.resolution,
      durationSec: quantity,
    })
  }

  if (typeof model.unitPrice === 'number' && model.unitPrice > 0) {
    return computeHaodouChargeAmount(model.unitPrice, quantity)
  }
  if (typeof model.haodouCost === 'number' && model.haodouCost > 0) {
    return kind === 'video' && quantity > 1
      ? computeHaodouChargeAmount(model.haodouCost, quantity)
      : model.haodouCost
  }
  return 0
}

export function resolveHaodouConsumeQuantity(
  kind: ModelKind,
  options?: { durationSec?: number },
): number {
  return resolveHaodouBillingQuantity(kind, options)
}

export function defaultHaodouReasonForKind(kind: ModelKind): HaodouConsumeReason {
  if (kind === 'image') return 'consume_image'
  if (kind === 'video') return 'consume_video'
  return 'consume_script'
}

/** 是否应在代理前调用 consume */
export function shouldCallHaodouConsume(model?: ModelConfig | null): boolean {
  if (!shouldChargeHaodou(model)) return false
  if (!model?.modelKey?.trim()) return false
  return hasPersistedRealToken(useAuthStore.getState().token)
}

export async function consumeHaodou(options: {
  model: ModelConfig
  reason: HaodouConsumeReason
  quantity: number
  apiBase?: string
}): Promise<HaodouConsumeResult> {
  const modelKey = options.model.modelKey!.trim()
  const quantity = Math.max(1, Math.trunc(options.quantity) || 1)
  const data = await authPost<HaodouConsumeResult>(
    '/client/haodou/consume',
    {
      model_key: modelKey,
      reason: options.reason,
      quantity,
    },
    options.apiBase,
  )
  if (typeof data.balance === 'number') {
    applyHaodouBalance(data.balance)
  }
  return data
}

/** external 系统模型：代理前扣豆；免费模型服务端返回 consumed=0 */
export async function consumeHaodouIfNeeded(options: {
  model: ModelConfig
  kind: ModelKind
  reason?: HaodouConsumeReason
  durationSec?: number
  apiBase?: string
}): Promise<HaodouConsumeResult | null> {
  if (!shouldCallHaodouConsume(options.model)) return null
  let quantity = resolveHaodouConsumeQuantity(options.kind, {
    durationSec: options.durationSec,
  })
  if (quantity <= 0) {
    quantity =
      options.kind === 'video'
        ? Math.max(1, Math.trunc(options.durationSec ?? 5))
        : 1
  }
  return consumeHaodou({
    model: options.model,
    reason: options.reason ?? defaultHaodouReasonForKind(options.kind),
    quantity,
    apiBase: options.apiBase,
  })
}

export async function refundHaodou(options: {
  amount: number
  apiBase?: string
}): Promise<{ refunded: number; balance: number } | null> {
  const amount = Math.trunc(options.amount)
  if (amount <= 0) return null
  if (!hasPersistedRealToken(useAuthStore.getState().token)) return null
  try {
    const data = await authPost<{ refunded: number; balance: number }>(
      '/client/haodou/refund',
      { amount, reason: 'refund_failed' },
      options.apiBase,
    )
    if (typeof data.balance === 'number') {
      applyHaodouBalance(data.balance)
    }
    return data
  } catch (err) {
    console.warn('[haodou] refund failed', err)
    return null
  }
}

export function isHaodouInsufficientError(error: unknown): error is HaodouInsufficientError {
  return error instanceof HaodouInsufficientError
}

/** 生成失败 toast：优先展示好豆不足等业务错误文案 */
export function formatUserFacingBillingError(error: unknown, fallback: string): string {
  if (isHaodouInsufficientError(error)) return error.message
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  return fallback
}
