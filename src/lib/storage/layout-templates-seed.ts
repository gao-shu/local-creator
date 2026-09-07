// Copyright (c) local-creator contributors. All rights reserved.

import type { PromptTemplate } from '@/types/settings'
import { LAYOUT_PRESETS } from '@/lib/workflow/layout-presets'

/** 系统内置布局模板（与 layout-presets.ts 同步，settings 合并时只读） */
export const SEED_LAYOUT_TEMPLATES: PromptTemplate[] = LAYOUT_PRESETS.map((preset) => ({
  id: `seed-layout-${preset.key}`,
  key: preset.key,
  name: preset.name,
  promptType: 'layout',
  content: preset.value,
  description: preset.description,
  layoutKind: preset.subtype,
  isBuiltin: true,
}))
