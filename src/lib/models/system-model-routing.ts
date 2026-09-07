// Copyright (c) Haode AI. All rights reserved.

import type { BillingMode, ModelConfig } from '@/types/settings'

const SYSTEM_MODEL_ID_PREFIX = 'sys:'

export function normalizeBillingMode(value?: string | null): BillingMode {
  return value === 'internal' ? 'internal' : 'external'
}

export function isSystemModel(model?: Pick<ModelConfig, 'source' | 'id'> | null): boolean {
  if (!model) return false
  if (model.source === 'system') return true
  return Boolean(model.id?.startsWith(SYSTEM_MODEL_ID_PREFIX))
}

export function isInternalSystemModel(
  model?: Pick<ModelConfig, 'source' | 'id' | 'billingMode'> | null,
): boolean {
  return isSystemModel(model) && model?.billingMode === 'internal'
}

/** external 系统模型走管理端代理；internal 走成员 Key / 微视等直连 */
export function shouldUseSystemModelProxy(
  model?: Pick<ModelConfig, 'source' | 'id' | 'modelKey' | 'billingMode'> | null,
): boolean {
  if (!isSystemModel(model) || !model?.modelKey?.trim()) return false
  return !isInternalSystemModel(model)
}

export { SYSTEM_MODEL_ID_PREFIX }
