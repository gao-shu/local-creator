// Copyright (c) Haode AI. All rights reserved.

import { canReportProjectConsumption } from '@/lib/auth/consumption-service'
import { isWeishiApiModel } from '@/lib/models/weishi-model-presets'
import { isInternalSystemModel, isSystemModel } from '@/lib/models/system-model-routing'
import { hasBillableUnitPrice, parseUnitPrice } from '@/lib/models/system-model-unit-price'
import type { ModelConfig } from '@/types/settings'

function listBillableInternalWeishiModels(systemCatalog: ModelConfig[]): ModelConfig[] {
  return systemCatalog.filter(
    (item) =>
      isInternalSystemModel(item) &&
      isWeishiApiModel(item) &&
      (item.consumption?.billing_enabled || resolveYuanUnitPrice(item) > 0),
  )
}

/** 自定义微视模型 → 匹配 internal 系统模型的 consumption 单价 */
export function resolveConsumptionBillingModel(
  model: ModelConfig | null | undefined,
  systemCatalog: ModelConfig[] = [],
): ModelConfig | null {
  if (!model) return null
  if (
    isSystemModel(model) &&
    (model.consumption?.billing_enabled || resolveYuanUnitPrice(model) > 0)
  ) {
    return model
  }
  if (!isWeishiApiModel(model)) return null

  const billable = listBillableInternalWeishiModels(systemCatalog)
  if (!billable.length) return null

  const upstream = model.model?.trim()
  if (upstream) {
    const exact = billable.find((item) => item.model?.trim() === upstream)
    if (exact) return exact
  }

  // 自定义「微视API」未配 model 或与后台不一致时，回退到唯一可用的 internal 微视单价
  if (billable.length === 1) return billable[0]
  return null
}

function resolveYuanUnitPrice(model: ModelConfig): number {
  const fromConsumption = parseUnitPrice(model.consumption?.price)
  if (fromConsumption > 0) return fromConsumption
  if (isInternalSystemModel(model) && hasBillableUnitPrice(model.unitPrice)) {
    return model.unitPrice!
  }
  return 0
}

/** 下拉展示用：去掉「元/豆」等货币前缀，保留 `/秒` `/张` 等量纲 */
function normalizeUnitPriceDisplaySuffix(unitLabel: string): string {
  const trimmed = unitLabel.trim()
  if (!trimmed) return '/秒'
  const slashIndex = trimmed.indexOf('/')
  if (slashIndex >= 0) return trimmed.slice(slashIndex)
  return `/${trimmed.replace(/^[\u4e00-\u9fff]+/u, '') || '秒'}`
}

/** 微视 API 下拉用：如 `1.1/秒`；无单价或未启用计费时返回 null */
export function formatModelUnitPriceLabel(
  model: ModelConfig | null | undefined,
  systemCatalog: ModelConfig[] = [],
  options?: { skipAuthCheck?: boolean },
): string | null {
  if (!options?.skipAuthCheck && !canReportProjectConsumption()) return null
  if (!model || !isWeishiApiModel(model)) return null

  const billingModel = resolveConsumptionBillingModel(model, systemCatalog)
  if (!billingModel) return null

  const price = resolveYuanUnitPrice(billingModel)
  if (price <= 0) return null

  const unitLabel =
    billingModel.consumption?.unit_label?.trim() ||
    billingModel.unitLabel?.trim() ||
    '/秒'

  return `${price}${normalizeUnitPriceDisplaySuffix(unitLabel)}`
}

/** 设置页微视 Model 下拉：按 upstream modelId 查单价 */
export function formatWeishiUpstreamUnitPriceLabel(
  upstreamModelId: string,
  systemVideoCatalog: ModelConfig[],
): string | null {
  const billing = systemVideoCatalog.find(
    (item) =>
      isInternalSystemModel(item) &&
      isWeishiApiModel(item) &&
      item.model?.trim() === upstreamModelId.trim() &&
      (item.consumption?.billing_enabled || resolveYuanUnitPrice(item) > 0),
  )
  if (!billing) return null
  return formatModelUnitPriceLabel(billing, systemVideoCatalog, { skipAuthCheck: true })
}
