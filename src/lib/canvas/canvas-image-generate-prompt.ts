// Copyright (c) local-creator contributors. All rights reserved.

import type { CanvasImageAssetRole, CanvasImageNodeData } from '@/types/canvas-nodes'
import type { AppSettings } from '@/types/settings'
import type { AssetKind } from '@/types/workflow'
import {
  normalizeLayoutKey,
  resolveLayoutPresetValue,
  resolveProjectAssetLayoutKey,
} from '@/lib/workflow/layout-presets'
import {
  resolveProjectAssetStyleKey,
  resolveStylePresetValue,
} from '@/lib/workflow/style-presets'

export function mapCanvasAssetRoleToKind(role?: CanvasImageAssetRole): AssetKind {
  if (role === 'scene') return 'scene'
  if (role === 'item') return 'prop'
  return 'character'
}

/** 解析画布节点生效的风格 key（对齐 Step3 项目/记忆画风） */
export function resolveCanvasImageStyleKey(
  data: Pick<CanvasImageNodeData, 'styleKey' | 'assetRole'>,
  settings?: Pick<AppSettings, 'lastUsedAssetStyleKeys' | 'styleTemplates'> | null,
): string {
  if (data.styleKey?.trim()) return data.styleKey.trim()
  return resolveProjectAssetStyleKey(
    null,
    mapCanvasAssetRoleToKind(data.assetRole),
    settings?.lastUsedAssetStyleKeys,
    settings,
  )
}

/** 解析画布节点生效的布局 key（未选时用画布记忆 → 全局默认 → 系统默认） */
export function resolveCanvasImageLayoutKey(
  data: Pick<CanvasImageNodeData, 'layoutKey' | 'assetRole'>,
  settings?: Pick<AppSettings, 'lastUsedCanvasLayoutKeys' | 'defaultAssetLayoutKeys'> | null,
): string {
  const kind = mapCanvasAssetRoleToKind(data.assetRole)
  if (data.layoutKey?.trim()) {
    return resolveProjectAssetLayoutKey(data.layoutKey, kind, settings?.defaultAssetLayoutKeys)
  }
  const settingsKey =
    kind === 'character'
      ? settings?.lastUsedCanvasLayoutKeys?.character
      : kind === 'scene'
        ? settings?.lastUsedCanvasLayoutKeys?.scene
        : settings?.lastUsedCanvasLayoutKeys?.prop
  const canvasRemembered = normalizeLayoutKey(settingsKey, kind)
  if (canvasRemembered) return canvasRemembered
  return resolveProjectAssetLayoutKey(undefined, kind, settings?.defaultAssetLayoutKeys)
}

/** 拼接画布生图 Prompt：风格前缀 + 用户描述 + 工具附加 + 布局后缀（对齐创作工坊 Step3） */
export function buildCanvasImageGeneratePrompt(
  data: CanvasImageNodeData,
  basePrompt: string,
  toolExtras: Array<string | undefined | null> = [],
  options?: {
    settings?: Pick<
      AppSettings,
      | 'lastUsedAssetStyleKeys'
      | 'lastUsedCanvasLayoutKeys'
      | 'defaultAssetLayoutKeys'
      | 'layoutTemplates'
      | 'styleTemplates'
    > | null
  },
): string {
  const base = String(basePrompt || '').trim()
  const extras = toolExtras.map((item) => String(item || '').trim()).filter(Boolean)
  if (!data.assetRoleConverted) {
    return [base, ...extras].filter(Boolean).join('\n\n')
  }

  const kind = mapCanvasAssetRoleToKind(data.assetRole)
  const styleKey = resolveCanvasImageStyleKey(data, options?.settings)
  const layoutKey = resolveCanvasImageLayoutKey(data, options?.settings)
  const styleValue = resolveStylePresetValue(styleKey, undefined, options?.settings)
  const layoutValue = resolveLayoutPresetValue(
    kind,
    layoutKey,
    options?.settings?.defaultAssetLayoutKeys,
    options?.settings,
  )
  const parts = [
    styleValue,
    base,
    ...extras,
    layoutValue,
  ].filter(Boolean)
  return parts.join('\n\n')
}
