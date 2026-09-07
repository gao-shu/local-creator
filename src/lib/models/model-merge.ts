// Copyright (c) local-creator. All rights reserved.

import type { ModelConfig, ModelKind } from '@/types/settings'
import {
  buildImageModelPickerGroups,
  type ImageModelPickerGroups,
} from '@/lib/models/image-model-pricing'

export type SystemModelsByKind = Record<ModelKind, ModelConfig[]>

export function isSystemModel(model?: Pick<ModelConfig, 'source'> | null): boolean {
  return model?.source === 'system'
}

export function shouldUseSystemModelProxy(_model?: ModelConfig | null): boolean {
  return false
}

export function filterSystemModelsForSelect(
  _kind: ModelKind,
  _models?: ModelConfig[],
): ModelConfig[] {
  return []
}

/** 开源版仅返回自定义模型 */
export function mergeModelsForKind(
  _kind: ModelKind,
  customModels: ModelConfig[] | undefined,
  _systemByKind?: SystemModelsByKind,
): ModelConfig[] {
  return (Array.isArray(customModels) ? customModels : []).filter((m) => m.source !== 'system')
}

export function mergeImageModelsGrouped(
  customModels: ModelConfig[],
  _systemByKind?: SystemModelsByKind,
): ImageModelPickerGroups {
  return buildImageModelPickerGroups(
    customModels.filter((m) => m.source !== 'system'),
    [],
  )
}

export type { ImageModelPickerGroups }

export function ensureCustomSource(model: ModelConfig): ModelConfig {
  if (isSystemModel(model)) return model
  return { ...model, source: model.source || 'custom' }
}
