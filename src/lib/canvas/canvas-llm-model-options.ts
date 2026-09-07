// Copyright (c) Haode AI. All rights reserved.

import type { ModelConfig } from '@/types/settings'
import { buildModelSelectOptions } from '@/lib/models/model-select-options'

/** 画布文本控制台 LLM 下拉 */
export function buildCanvasLlmModelOptions(models: ModelConfig[]) {
  return buildModelSelectOptions(models, 'llm')
}
