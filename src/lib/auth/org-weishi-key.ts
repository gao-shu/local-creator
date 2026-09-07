// Copyright (c) local-creator contributors. All rights reserved.

import type { ModelConfig } from '@/types/settings'

/** 解析微视请求用 Key：仅使用模型 settings 中的自备 Key */
export async function resolveWeishiApiKey(options: {
  model: Pick<ModelConfig, 'apiKey'>
  apiBase?: string
  forceRefresh?: boolean
}): Promise<string> {
  const key = options.model.apiKey?.trim()
  if (!key) {
    throw new Error('请先在模型配置中填写微视 API Key')
  }
  return key
}
