// Copyright (c) Haode AI. All rights reserved.

import type { ModelKind } from '@/types/settings'

export type BillingQuantityUnit = 'second' | 'count' | 'call'

/** 与后台 production_service.KIND_BILLING_UNIT 对齐 */
export function billingQuantityUnitForKind(kind: ModelKind): BillingQuantityUnit {
  if (kind === 'video') return 'second'
  if (kind === 'image') return 'count'
  return 'call'
}

/** 外部 API 好豆扣费数量：视频=秒，图片/LLM=次 */
export function resolveHaodouBillingQuantity(
  kind: ModelKind,
  options?: { durationSec?: number },
): number {
  if (kind === 'video') {
    const sec = Math.trunc(options?.durationSec ?? 0)
    return sec > 0 ? sec : 0
  }
  return 1
}

/** 内部 API 项目消耗数量：视频=秒，图片/LLM=次（元/秒·张·次） */
export function resolveConsumptionBillingQuantity(
  kind: ModelKind,
  options?: { durationSec?: number },
): number {
  if (kind === 'video') {
    const sec = Math.trunc(options?.durationSec ?? 0)
    return sec > 0 ? sec : 0
  }
  return 1
}

export function parseUnitPrice(value: unknown): number {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return 0
  return Math.round(num * 10) / 10
}

/** 与后台 compute_haodou_charge_amount 一致（四舍五入到整数好豆） */
export function computeHaodouChargeAmount(unitPrice: number, quantity: number): number {
  if (unitPrice <= 0 || quantity <= 0) return 0
  return Math.round(unitPrice * quantity)
}

export function hasBillableUnitPrice(unitPrice: number | undefined): boolean {
  return typeof unitPrice === 'number' && unitPrice > 0
}
