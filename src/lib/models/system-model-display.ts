// Copyright (c) Haode AI. All rights reserved.

import type { ModelConfig } from '@/types/settings'
import { isInternalSystemModel, isSystemModel } from '@/lib/models/system-model-routing'

export type SystemModelBillingBadge = {
  text: '内部 API' | '外部 API'
  tone: 'internal' | 'external'
}

export type ModelSelectOptionLabels = {
  /** 触发器与下拉主文案：仅模型名 */
  label: string
  /** 右侧副文案（单价/摘要） */
  suffix?: string
  /** 系统模型：下拉用色点区分内外部，不展示长文案 */
  systemBadgeTone?: SystemModelBillingBadge['tone']
}

/** 系统模型计费模式角标（自定义模型返回 null） */
export function getSystemModelBillingBadge(
  model?: Pick<ModelConfig, 'source' | 'id' | 'billingMode'> | null,
): SystemModelBillingBadge | null {
  if (!isSystemModel(model)) return null
  if (isInternalSystemModel(model)) {
    return { text: '内部 API', tone: 'internal' }
  }
  return { text: '外部 API', tone: 'external' }
}

export function systemModelBillingBadgeClass(tone: SystemModelBillingBadge['tone']): string {
  return tone === 'internal'
    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
    : 'bg-sky-500/10 text-sky-700 dark:text-sky-400'
}

/** 下拉：主文案仅模型名；系统模型用 systemBadgeTone 色点区分 */
export function formatModelSelectOptionLabels(model: ModelConfig): ModelSelectOptionLabels {
  const badge = getSystemModelBillingBadge(model)
  return {
    label: model.name,
    ...(badge ? { systemBadgeTone: badge.tone } : {}),
  }
}

/** 下拉排序：内部系统 → 外部系统 → 自定义 */
export function sortModelsForSelect(models: ModelConfig[]): ModelConfig[] {
  return [...models].sort((a, b) => {
    const rank = (model: ModelConfig) => {
      if (isInternalSystemModel(model)) return 0
      if (isSystemModel(model)) return 1
      return 2
    }
    const order = rank(a) - rank(b)
    if (order !== 0) return order
    return a.name.localeCompare(b.name, 'zh-CN')
  })
}

export function partitionSystemModelsByBilling(models: ModelConfig[]): {
  internal: ModelConfig[]
  external: ModelConfig[]
} {
  const internal: ModelConfig[] = []
  const external: ModelConfig[] = []
  for (const model of models) {
    if (isInternalSystemModel(model)) internal.push(model)
    else external.push(model)
  }
  return { internal, external }
}
