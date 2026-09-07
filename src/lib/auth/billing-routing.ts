// Copyright (c) Haode AI. All rights reserved.

import { isWeishiApiModel } from '@/lib/models/weishi-model-presets'
import {
  isInternalSystemModel,
  isSystemModel,
  shouldUseSystemModelProxy,
} from '@/lib/models/system-model-routing'
import { resolveConsumptionBillingModel } from '@/lib/models/system-model-unit-price-label'
import { useSettingsStore } from '@/stores/settings-store'
import type { ModelConfig } from '@/types/settings'

/** 单次 AI 调用的计费分流：好豆 / 项目统计 / 不计费 */
export type BillingPath = 'haodou' | 'project' | 'none'

/** external 系统模型走平台代理 → 好豆；internal / 映射微视 → 项目统计；其余 → none */
export function getBillingPath(
  model?: ModelConfig | null,
  systemCatalog?: ModelConfig[],
): BillingPath {
  if (!model) return 'none'
  const catalog =
    systemCatalog ??
    (isWeishiApiModel(model) ? readSystemVideoCatalog() : [])
  if (resolveProjectConsumptionChargeModel(model, catalog)) return 'project'
  if (shouldUseSystemModelProxy(model)) return 'haodou'
  return 'none'
}

/** external 系统模型是否应扣好豆（单价由服务端 consume 为准） */
export function shouldChargeHaodou(model?: ModelConfig | null): boolean {
  return shouldUseSystemModelProxy(model)
}

/**
 * internal 系统模型且后台启用 consumption 时，才计入项目消耗。
 * 自定义模型 / external 系统模型均返回 false。
 */
export function shouldReportInternalProjectConsumption(
  model?: ModelConfig | null,
): boolean {
  if (!model) return false
  if (!isInternalSystemModel(model)) return false
  if (!model.modelKey?.trim()) return false
  return Boolean(model.consumption?.billing_enabled)
}

/**
 * 项目消耗 charge 用的模型：internal 系统模型自身，或自定义微视匹配到的 internal catalog。
 */
export function resolveProjectConsumptionChargeModel(
  model: ModelConfig | null | undefined,
  systemCatalog: ModelConfig[] = [],
): ModelConfig | null {
  if (!model) return null
  if (shouldReportInternalProjectConsumption(model)) return model
  const billing = resolveConsumptionBillingModel(model, systemCatalog)
  if (billing && shouldReportInternalProjectConsumption(billing)) return billing
  return null
}

/** 已同步的系统视频模型目录（internal 微视单价 / charge 映射） */
export function readSystemVideoCatalog(): ModelConfig[] {
  return useSettingsStore.getState().systemModelsByKind?.video ?? []
}

/** 是否应计入项目消耗（含自定义微视 → internal 映射） */
export function isProjectConsumptionModel(
  model?: ModelConfig | null,
  systemCatalog: ModelConfig[] = [],
): boolean {
  return resolveProjectConsumptionChargeModel(model, systemCatalog) != null
}

export function describeBillingPath(model?: ModelConfig | null): string {
  const path = getBillingPath(model)
  if (path === 'project') return '项目统计（internal）'
  if (path === 'haodou') return '好豆（external 代理）'
  if (isSystemModel(model)) return '系统模型未启用计费'
  return '自定义模型不计费'
}
