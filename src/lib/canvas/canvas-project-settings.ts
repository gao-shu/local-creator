// Copyright (c) local-creator contributors. All rights reserved.

import type { CanvasProjectSettings } from '@/types/canvas'

/** 画布项目 settings 默认值（新建项目 / 缺字段时） */
export const DEFAULT_CANVAS_PROJECT_SETTINGS: CanvasProjectSettings = {}

/** 读盘时规范化；忽略已废弃字段（如 autoConnectAssetsToShots） */
export function normalizeCanvasProjectSettings(
  _raw?: CanvasProjectSettings | null,
): CanvasProjectSettings {
  return {}
}
