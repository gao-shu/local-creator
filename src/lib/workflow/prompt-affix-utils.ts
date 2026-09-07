// Copyright (c) haode-ai-client. All rights reserved.

import type { PromptAffixPreset } from '@/types/settings'

export const DEFAULT_AFFIX_PRESET_ID = 1

export const SEED_AFFIX_PRESETS: PromptAffixPreset[] = [
  {
    id: DEFAULT_AFFIX_PRESET_ID,
    name: '默认',
    prefix: '高质量',
    suffix: '细节丰富',
    isDefault: true,
  },
]

export function normalizeAffixPresets(raw: unknown): PromptAffixPreset[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...SEED_AFFIX_PRESETS]
  const presets = raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const id = Number(row.id)
      const name = String(row.name || '').trim()
      if (!id || !name) return null
      return {
        id,
        name,
        prefix: String(row.prefix || ''),
        suffix: String(row.suffix || ''),
        isDefault: Boolean(row.isDefault),
      } satisfies PromptAffixPreset
    })
    .filter((item): item is PromptAffixPreset => item != null)
  return presets.length ? presets : [...SEED_AFFIX_PRESETS]
}

export function getAffixPresetById(
  presets: PromptAffixPreset[],
  id?: number,
): PromptAffixPreset | undefined {
  if (id == null) return presets.find((item) => item.isDefault) ?? presets[0]
  return presets.find((item) => item.id === id) ?? presets[0]
}

export function createAffixPreset(presets: PromptAffixPreset[]): PromptAffixPreset {
  const nextId = Math.max(0, ...presets.map((item) => item.id)) + 1
  return {
    id: nextId,
    name: `预设 ${presets.length + 1}`,
    prefix: '',
    suffix: '',
    isDefault: false,
  }
}

/** 生图/生视频时拼接前后缀（对齐 haode-ai-client） */
export function applyPromptAffix(
  prompt: string,
  prefix?: string,
  suffix?: string,
): string {
  const body = String(prompt || '').trim()
  const pre = String(prefix || '').trim()
  const suf = String(suffix || '').trim()
  let result = ''
  if (pre) result += `${pre}\n`
  if (body) result += body
  if (suf) result += result ? `\n${suf}` : suf
  return result.trim()
}
