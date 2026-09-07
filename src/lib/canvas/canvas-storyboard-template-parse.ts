// Copyright (c) local-creator contributors. All rights reserved.

import {
  STORYBOARD_TEMPLATE_DOC_MIN_SHOTS,
  STORYBOARD_TEMPLATE_FAILURE_HINT,
  STORYBOARD_TEMPLATE_FIELD_ALIASES,
  STORYBOARD_TEMPLATE_PROMPT_FIELD_ORDER,
  STORYBOARD_TEMPLATE_SHOT_BOUNDARIES,
  type StoryboardTemplateNormalizedShot,
  type StoryboardTemplateParseFailureCode,
  type StoryboardTemplatePromptField,
} from '@/lib/canvas/canvas-storyboard-template-spec'

export type StoryboardTemplateFieldMap = Partial<
  Record<keyof typeof STORYBOARD_TEMPLATE_FIELD_ALIASES, string>
> & {
  extraLines?: string[]
}

type AliasRule = { key: keyof typeof STORYBOARD_TEMPLATE_FIELD_ALIASES; alias: string }

/** 长别名优先，避免「画面」抢在「画面内容/画面风格」之前 */
const FIELD_ALIAS_RULES: AliasRule[] = (() => {
  const rules: AliasRule[] = []
  for (const [key, aliases] of Object.entries(STORYBOARD_TEMPLATE_FIELD_ALIASES)) {
    for (const alias of aliases) {
      rules.push({
        key: key as keyof typeof STORYBOARD_TEMPLATE_FIELD_ALIASES,
        alias,
      })
    }
  }
  rules.sort((a, b) => b.alias.length - a.alias.length)
  return rules
})()

const PROMPT_FIELD_LABEL: Record<StoryboardTemplatePromptField, string> = {
  scene: '主要场景',
  content: '画面内容',
  camera: '运镜',
  lightingCore: '核心光影',
  lightingSetup: '布光',
  foreground: '前景',
  texture: '质感细节',
  emotion: '人物情绪',
  blocking: '人物站位',
  style: '画面风格',
  sfx: '音效',
}

function isShotBoundaryLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  return STORYBOARD_TEMPLATE_SHOT_BOUNDARIES.some((re) => re.test(trimmed))
}

/** 将整篇文本按「镜头号」锚点切成块（含锚点行） */
export function splitStoryboardTemplateBlocks(text: string): string[] {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let current: string[] | null = null

  for (const line of lines) {
    if (isShotBoundaryLine(line)) {
      if (current?.length) blocks.push(current.join('\n').trim())
      current = [line]
      continue
    }
    if (current) current.push(line)
  }
  if (current?.length) blocks.push(current.join('\n').trim())
  return blocks.filter(Boolean)
}

function matchFieldLine(
  line: string,
): { key: keyof typeof STORYBOARD_TEMPLATE_FIELD_ALIASES; value: string } | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  for (const rule of FIELD_ALIAS_RULES) {
    const escaped = rule.alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`^${escaped}\\s*[:：]\\s*(.*)$`, 'u')
    const m = trimmed.match(re)
    if (m) {
      return { key: rule.key, value: (m[1] ?? '').trim() }
    }
  }
  return null
}

function extractShotNumberFromBoundary(line: string): number | null {
  const trimmed = line.trim()
  const patterns = [
    /^镜头号\s*[:：]\s*(\d+)/u,
    /^分镜号\s*[:：]\s*(\d+)/u,
    /^#{1,3}\s*镜头\s*[:：]?\s*(\d+)/u,
    /^Shot\s*(?:No\.?|Number|#)?\s*[:：]?\s*(\d+)/iu,
  ]
  for (const re of patterns) {
    const m = trimmed.match(re)
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n > 0) return Math.trunc(n)
    }
  }
  const digits = trimmed.match(/(\d+)/)
  if (digits) {
    const n = Number(digits[1])
    if (Number.isFinite(n) && n > 0) return Math.trunc(n)
  }
  return null
}

function appendFieldValue(
  fields: StoryboardTemplateFieldMap,
  key: keyof typeof STORYBOARD_TEMPLATE_FIELD_ALIASES,
  chunk: string,
) {
  const next = chunk.trimEnd()
  if (!next && !chunk) return
  const prev = fields[key]
  if (prev == null || prev === '') {
    fields[key] = chunk.replace(/^\n+/, '').replace(/\n+$/, '')
    return
  }
  fields[key] = `${prev}\n${chunk}`.replace(/\n+$/, '')
}

/** 解析单块镜头字段 */
export function parseStoryboardTemplateBlock(block: string): StoryboardTemplateFieldMap {
  const lines = String(block ?? '').replace(/\r\n/g, '\n').split('\n')
  const fields: StoryboardTemplateFieldMap = {}
  let currentKey: keyof typeof STORYBOARD_TEMPLATE_FIELD_ALIASES | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (i === 0 && isShotBoundaryLine(line)) {
      const shotNumber = extractShotNumberFromBoundary(line)
      if (shotNumber != null) fields.shotNumber = String(shotNumber)
      // `镜头号： 23` 同行无其它正文；若写成「镜头号：1 简述」则 value 进 shot 旁路已够
      const inline = matchFieldLine(line)
      if (inline && inline.key === 'shotNumber' && inline.value && !/^\d+\s*$/.test(inline.value)) {
        // 同行残余不作为其它字段
      }
      currentKey = 'shotNumber'
      continue
    }

    const fieldHit = matchFieldLine(line)
    if (fieldHit) {
      currentKey = fieldHit.key
      if (fieldHit.key === 'shotNumber') {
        const n = extractShotNumberFromBoundary(line) ?? Number(fieldHit.value.match(/\d+/)?.[0])
        if (Number.isFinite(n) && n > 0) fields.shotNumber = String(Math.trunc(n))
      } else if (fieldHit.value) {
        fields[fieldHit.key] = fieldHit.value
      } else {
        fields[fieldHit.key] = fields[fieldHit.key] ?? ''
      }
      continue
    }

    if (!currentKey || currentKey === 'shotNumber') {
      const trimmed = line.trim()
      if (trimmed) {
        fields.extraLines = [...(fields.extraLines ?? []), trimmed]
      }
      continue
    }

    // 多行字段：保留空行结构
    if (fields[currentKey] == null || fields[currentKey] === '') {
      if (line.trim()) fields[currentKey] = line.trimEnd()
    } else {
      appendFieldValue(fields, currentKey, line)
    }
  }

  // 规范化 trim
  for (const key of Object.keys(STORYBOARD_TEMPLATE_FIELD_ALIASES) as Array<
    keyof typeof STORYBOARD_TEMPLATE_FIELD_ALIASES
  >) {
    const value = fields[key]
    if (typeof value === 'string') {
      fields[key] = value.replace(/^\n+/, '').replace(/\n+$/, '').trim()
      if (fields[key] === '') delete fields[key]
    }
  }
  return fields
}

/** 时长：`12秒` / `12s` / `12` → 秒；无法解析返回 undefined */
export function parseStoryboardTemplateDurationSec(raw: string | undefined | null): number | undefined {
  if (raw == null) return undefined
  const text = String(raw).trim()
  if (!text) return undefined
  const m =
    text.match(/(\d+(?:\.\d+)?)\s*(?:秒|s|sec|secs|second|seconds)?/i) ??
    text.match(/(\d+(?:\.\d+)?)/)
  if (!m) return undefined
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return undefined
  return Math.round(n)
}

/** 按契约字段序拼接视频/分镜 prompt */
export function composeVideoPromptFromTemplate(fields: StoryboardTemplateFieldMap): string {
  const parts: string[] = []
  for (const key of STORYBOARD_TEMPLATE_PROMPT_FIELD_ORDER) {
    const value = fields[key]?.trim()
    if (!value) continue
    parts.push(`${PROMPT_FIELD_LABEL[key]}：${value}`)
  }
  const dialogue = fields.dialogue?.trim()
  if (dialogue) {
    parts.push(`台词：${dialogue}`)
  }
  if (fields.extraLines?.length) {
    parts.push(fields.extraLines.join('\n'))
  }
  return parts.join('\n\n').trim()
}

function hasValidShotBody(fields: StoryboardTemplateFieldMap): boolean {
  if (fields.content?.trim()) return true
  if (fields.camera?.trim() && fields.scene?.trim()) return true
  return false
}

function normalizeShot(
  fields: StoryboardTemplateFieldMap,
  fallbackIndex: number,
): StoryboardTemplateNormalizedShot | null {
  const shotNumberRaw = Number(fields.shotNumber)
  const shotNumber =
    Number.isFinite(shotNumberRaw) && shotNumberRaw > 0
      ? Math.trunc(shotNumberRaw)
      : fallbackIndex
  if (!shotNumber || shotNumber <= 0) return null
  if (!hasValidShotBody(fields)) return null

  const prompt = composeVideoPromptFromTemplate(fields)
  if (!prompt) return null

  const dialogue = fields.dialogue?.trim() ?? ''
  const spatialAnchor = fields.blocking?.trim() || fields.scene?.trim() || undefined
  const durationSec = parseStoryboardTemplateDurationSec(fields.duration)
  const warnings: string[] = []
  if (!fields.content?.trim() && fields.camera?.trim() && fields.scene?.trim()) {
    warnings.push(`镜头 ${shotNumber}：缺少「画面内容」，已用场景+运镜兜底`)
  }
  if (!dialogue) warnings.push(`镜头 ${shotNumber}：未填写台词`)
  if (durationSec == null && fields.duration?.trim()) {
    warnings.push(`镜头 ${shotNumber}：时长无法解析（${fields.duration}）`)
  }

  return {
    shotNumber,
    prompt,
    dialogue,
    spatialAnchor,
    durationSec,
    warnings,
  }
}

export type StoryboardTemplateParseSuccess = {
  ok: true
  shots: StoryboardTemplateNormalizedShot[]
  warnings: string[]
}

export type StoryboardTemplateParseFailure = {
  ok: false
  code: StoryboardTemplateParseFailureCode
  message: string
}

export type StoryboardTemplateParseResult =
  | StoryboardTemplateParseSuccess
  | StoryboardTemplateParseFailure

/** 整篇分镜模板解析 */
export function parseStoryboardTemplateDocument(text: string): StoryboardTemplateParseResult {
  const raw = String(text ?? '').trim()
  if (!raw) {
    return {
      ok: false,
      code: 'empty',
      message: STORYBOARD_TEMPLATE_FAILURE_HINT.empty,
    }
  }

  const blocks = splitStoryboardTemplateBlocks(raw)
  if (!blocks.length) {
    return {
      ok: false,
      code: 'no_shot_boundary',
      message: STORYBOARD_TEMPLATE_FAILURE_HINT.no_shot_boundary,
    }
  }

  const shots: StoryboardTemplateNormalizedShot[] = []
  const warnings: string[] = []
  let skippedInvalid = 0

  blocks.forEach((block, index) => {
    const fields = parseStoryboardTemplateBlock(block)
    const shot = normalizeShot(fields, index + 1)
    if (!shot) {
      skippedInvalid += 1
      return
    }
    shots.push(shot)
    warnings.push(...shot.warnings)
  })

  if (shots.length < STORYBOARD_TEMPLATE_DOC_MIN_SHOTS) {
    return {
      ok: false,
      code: skippedInvalid > 0 ? 'no_valid_shot' : 'no_shot_boundary',
      message:
        skippedInvalid > 0
          ? STORYBOARD_TEMPLATE_FAILURE_HINT.no_valid_shot
          : STORYBOARD_TEMPLATE_FAILURE_HINT.no_shot_boundary,
    }
  }

  if (skippedInvalid > 0) {
    warnings.push(`有 ${skippedInvalid} 个分段因缺少必备字段已跳过`)
  }

  shots.sort((a, b) => a.shotNumber - b.shotNumber)
  return { ok: true, shots, warnings }
}

/** 是否像分镜模板（供 UI 弱提示；不要求全部合法） */
export function looksLikeStoryboardTemplate(text: string): boolean {
  return assessStoryboardTemplateLikeness(text).looksLike
}

/**
 * 模板相似度：
 * - looksLike：至少 1 个「镜头号」锚点
 * - strong：≥2 个锚点，或解析出 ≥2 个有效镜（用于建议改用导入分镜稿）
 */
export function assessStoryboardTemplateLikeness(text: string): {
  looksLike: boolean
  strong: boolean
  shotBoundaryCount: number
} {
  const blocks = splitStoryboardTemplateBlocks(text)
  const shotBoundaryCount = blocks.length
  if (shotBoundaryCount < 1) {
    return { looksLike: false, strong: false, shotBoundaryCount: 0 }
  }
  if (shotBoundaryCount >= 2) {
    return { looksLike: true, strong: true, shotBoundaryCount }
  }
  const parsed = parseStoryboardTemplateDocument(text)
  const validCount = parsed.ok ? parsed.shots.length : 0
  return {
    looksLike: true,
    strong: validCount >= 2,
    shotBoundaryCount,
  }
}
