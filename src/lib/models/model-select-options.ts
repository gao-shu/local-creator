// Copyright (c) Haode AI. All rights reserved.

import type { SelectOption } from '@/components/ui/select'
import type { ModelConfig } from '@/types/settings'
import { hasPersistedRealToken } from '@/lib/auth/login-mode'
import { buildImageModelPickerGroups } from '@/lib/models/image-model-pricing'
import { formatModelSelectOptionLabelsForKind } from '@/lib/models/image-model-display'
import { isWeishiApiModel } from '@/lib/models/weishi-model-presets'
import { sortModelsForSelect } from '@/lib/models/system-model-display'
import { formatModelUnitPriceLabel } from '@/lib/models/system-model-unit-price-label'

export type ModelSelectKind = 'llm' | 'image' | 'video'

export type BuildModelSelectOptionsParams = {
  systemCatalog?: ModelConfig[]
  /** 有真实登录 Session 时为 true，用于微视下拉展示单价 */
  showWeishiUnitPrice?: boolean
  /** 画布等业务下拉：仅模型名，不展示单价 suffix */
  modelPickerOnly?: boolean
}

function buildFlatModelSelectOption(
  model: ModelConfig,
  kind: ModelSelectKind,
  params?: BuildModelSelectOptionsParams,
): SelectOption {
  const { label, suffix, systemBadgeTone } = formatModelSelectOptionLabelsForKind(model, kind)
  const catalog = params?.systemCatalog ?? []
  const showWeishiUnitPrice = Boolean(params?.showWeishiUnitPrice)
  const modelPickerOnly = Boolean(params?.modelPickerOnly)
  const hasVideoPricingSummary = kind === 'video' && Boolean(model.videoPricing?.pricingSummary?.trim())

  const unitPrice =
    kind === 'video' && showWeishiUnitPrice && isWeishiApiModel(model) && !hasVideoPricingSummary
      ? formatModelUnitPriceLabel(model, catalog, { skipAuthCheck: true })
      : null

  return {
    value: model.id,
    label,
    ...(!modelPickerOnly ? { suffix: unitPrice ?? suffix } : {}),
    ...(systemBadgeTone ? { systemBadgeTone } : {}),
  }
}

/** 图片模型下拉：按 group_name 分组，展示 pricing_summary 与能力 Tag */
export function buildImageModelSelectOptions(
  models: ModelConfig[],
  params?: BuildModelSelectOptionsParams,
): SelectOption[] {
  const custom = models.filter((model) => model.source !== 'system')
  const system = models.filter((model) => model.source === 'system')
  const { systemGroups, customModels } = buildImageModelPickerGroups(custom, system)
  const options: SelectOption[] = []

  for (const group of systemGroups) {
    const groupHeader =
      group.isMultiChannel && group.groupName ? group.groupName : undefined
    for (const model of group.models) {
      options.push({
        ...buildFlatModelSelectOption(model, 'image', params),
        group: groupHeader,
      })
    }
  }

  if (customModels.length > 0) {
    const customHeader = systemGroups.length > 0 ? '自定义模型' : undefined
    for (const model of customModels) {
      options.push({
        ...buildFlatModelSelectOption(model, 'image', params),
        group: customHeader,
      })
    }
  }

  return options
}

/** 视频模型下拉：系统模型在前，自定义模型带分组标题 */
export function buildVideoModelSelectOptionsList(
  models: ModelConfig[],
  params?: BuildModelSelectOptionsParams,
): SelectOption[] {
  return buildSourceGroupedModelSelectOptions(models, 'video', params)
}

/** LLM 下拉：系统 / 自定义分组（画布参数面板与助手侧栏） */
export function buildLlmModelSelectOptionsList(
  models: ModelConfig[],
  params?: BuildModelSelectOptionsParams,
): SelectOption[] {
  return buildSourceGroupedModelSelectOptions(models, 'llm', params)
}

function buildSourceGroupedModelSelectOptions(
  models: ModelConfig[],
  kind: Exclude<ModelSelectKind, 'image'>,
  params?: BuildModelSelectOptionsParams,
): SelectOption[] {
  const custom = sortModelsForSelect(models.filter((model) => model.source !== 'system'))
  const system = sortModelsForSelect(models.filter((model) => model.source === 'system'))
  const both = system.length > 0 && custom.length > 0
  const options: SelectOption[] = []

  for (const model of system) {
    options.push({
      ...buildFlatModelSelectOption(model, kind, params),
      ...(both ? { group: '系统模型' } : {}),
    })
  }

  for (const model of custom) {
    options.push({
      ...buildFlatModelSelectOption(model, kind, params),
      ...(both ? { group: '自定义模型' } : {}),
    })
  }

  return options
}

/** 模型下拉选项（系统模型带 internal/external 标签；微视 API 可附带单价） */
export function buildModelSelectOptions(
  models: ModelConfig[],
  kind: ModelSelectKind,
  params?: BuildModelSelectOptionsParams,
): SelectOption[] {
  if (kind === 'image') {
    return buildImageModelSelectOptions(models, params)
  }

  if (kind === 'video') {
    return buildVideoModelSelectOptionsList(models, params)
  }

  return buildLlmModelSelectOptionsList(models, params)
}

/** 视频模型下拉（含微视单价，需传入 systemCatalog + 真实 Session） */
export function buildVideoModelSelectOptions(
  models: ModelConfig[],
  systemCatalog: ModelConfig[],
  token: string | null | undefined,
  extra?: Pick<BuildModelSelectOptionsParams, 'modelPickerOnly'>,
): SelectOption[] {
  return buildModelSelectOptions(models, 'video', {
    systemCatalog,
    showWeishiUnitPrice: hasPersistedRealToken(token),
    ...extra,
  })
}
