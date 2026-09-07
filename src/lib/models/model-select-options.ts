// Copyright (c) local-creator. All rights reserved.

import type { SelectOption } from '@/components/ui/select'
import type { ModelConfig } from '@/types/settings'
import { buildImageModelPickerGroups } from '@/lib/models/image-model-pricing'
import { formatModelSelectOptionLabelsForKind, sortModelsForSelect } from '@/lib/models/image-model-display'

export type ModelSelectKind = 'llm' | 'image' | 'video'

export type BuildModelSelectOptionsParams = {
  systemCatalog?: ModelConfig[]
  showWeishiUnitPrice?: boolean
  modelPickerOnly?: boolean
}

function buildFlatModelSelectOption(
  model: ModelConfig,
  kind: ModelSelectKind,
  params?: BuildModelSelectOptionsParams,
): SelectOption {
  const { label, suffix } = formatModelSelectOptionLabelsForKind(model, kind)
  const modelPickerOnly = Boolean(params?.modelPickerOnly)

  return {
    value: model.id,
    label,
    ...(!modelPickerOnly && suffix ? { suffix } : {}),
  }
}

export function buildImageModelSelectOptions(
  models: ModelConfig[],
  params?: BuildModelSelectOptionsParams,
): SelectOption[] {
  const custom = models.filter((model) => model.source !== 'system')
  const { customModels } = buildImageModelPickerGroups(custom, [])
  return customModels.map((model) => buildFlatModelSelectOption(model, 'image', params))
}

function buildSourceGroupedModelSelectOptions(
  models: ModelConfig[],
  kind: Exclude<ModelSelectKind, 'image'>,
  params?: BuildModelSelectOptionsParams,
): SelectOption[] {
  const custom = sortModelsForSelect(models.filter((model) => model.source !== 'system'))
  return custom.map((model) => buildFlatModelSelectOption(model, kind, params))
}

export function buildVideoModelSelectOptionsList(
  models: ModelConfig[],
  params?: BuildModelSelectOptionsParams,
): SelectOption[] {
  return buildSourceGroupedModelSelectOptions(models, 'video', params)
}

export function buildLlmModelSelectOptionsList(
  models: ModelConfig[],
  params?: BuildModelSelectOptionsParams,
): SelectOption[] {
  return buildSourceGroupedModelSelectOptions(models, 'llm', params)
}

export function buildModelSelectOptions(
  models: ModelConfig[],
  kind: ModelSelectKind,
  params?: BuildModelSelectOptionsParams,
): SelectOption[] {
  if (kind === 'image') return buildImageModelSelectOptions(models, params)
  if (kind === 'video') return buildVideoModelSelectOptionsList(models, params)
  return buildLlmModelSelectOptionsList(models, params)
}

export function buildVideoModelSelectOptions(
  models: ModelConfig[],
  _systemCatalog: ModelConfig[],
  _token: string | null | undefined,
  extra?: Pick<BuildModelSelectOptionsParams, 'modelPickerOnly'>,
): SelectOption[] {
  return buildModelSelectOptions(models, 'video', { ...extra })
}
