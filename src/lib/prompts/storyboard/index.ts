// Copyright (c) local-creator contributors. All rights reserved.

import type { PromptTemplate } from '@/types/settings'
import { SEEDANCE_15S_STANDARD_TEMPLATE } from '@/lib/prompts/storyboard/seedance-15s-standard'

/** 手写分镜模板（不进 prompt-templates-seed 生成链，与 SEED 合并注册） */
export const HAND_STORYBOARD_TEMPLATES: PromptTemplate[] = [SEEDANCE_15S_STANDARD_TEMPLATE]
