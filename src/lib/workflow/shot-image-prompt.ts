// Copyright (c) local-creator contributors. All rights reserved.

import type { WorkflowShot } from '@/types/workflow'
import { applyPromptAffix } from '@/lib/workflow/prompt-affix-utils'
import { resolveImageSizeApiValue } from '@/lib/workflow/image-size-presets'

/** 推理格式 key — 对齐画镜 / weifan-ai-ts workflow-prompts reasoning */
export const INFERENCE_FORMAT_OPTIONS = [
  { value: 'single', label: '单图' },
  { value: 'gpt-storyboard', label: 'GPT分镜版' },
  { value: 'grid-4-9x16', label: '4宫格 (2x2 9:16)' },
  { value: 'grid-4-16x9', label: '4宫格 (2x2 16:9)' },
  { value: 'grid-6', label: '6宫格 (第一黑)' },
  { value: 'grid-9-9x16', label: '9宫格 (3x3 9:16)' },
  { value: 'grid-9-16x9', label: '9宫格 (3x3 16:9)' },
  { value: 'grid-12', label: '12宫格 (3x4 3:4)' },
  { value: 'grid-25-9x16', label: '25宫格 (5x5 9:16)' },
  { value: 'grid-25-16x9', label: '25宫格 (5x5 16:9)' },
] as const

export type InferenceFormat = (typeof INFERENCE_FORMAT_OPTIONS)[number]['value']

export type InferenceCanvasRatio = 'free' | '9:16' | '16:9'

export interface InferenceFormatMeta {
  key: InferenceFormat
  label: string
  rows: number
  cols: number
  canvasRatio: InferenceCanvasRatio
}

const LEGACY_INFERENCE_FORMAT_MAP: Record<string, InferenceFormat> = {
  'grid-9': 'grid-9-9x16',
  'grid-4': 'grid-4-16x9',
}

/** 官方宫格布局模板 — 来源 weifan-ai-ts / 画镜 workflow-prompts reasoning */
const OFFICIAL_GRID_TEMPLATES: Partial<Record<InferenceFormat, string>> = {
  'grid-4-9x16':
    '图片中禁止出现任何文字！！！ \n图片中禁止出现任何文字！！！ \n图片中禁止出现任何文字！！！ \n9:16 竖屏总画布，2 列 2 行 4 宫格布局，每个独立宫格均为严格 9:16 竖屏屏比例且完美匹配对应接收的文字内容，宫格之间无任何黑色分割线、无任何形式分隔线、无描边、无空隙、无缝衔接，【参考图的人物脸型，发型，服饰完全不变】，左上角标注对应分镜编号，',
  'grid-4-16x9':
    '图片中禁止出现任何文字！！！ \n图片中禁止出现任何文字！！！ \n图片中禁止出现任何文字！！！ \n16:9 横屏总画布，2 列 2 行 4 宫格布局，每个独立宫格均为严格 16:9 横屏屏比例且完美匹配对应接收的文字内容，宫格之间无任何黑色分割线、无任何形式分隔线、无描边、无空隙、无缝衔接，【参考图的人物脸型，发型，服饰完全不变】，左上角标注对应分镜编号，',
  'grid-6':
    '图片中禁止出现任何文字！！！ \n图片中禁止出现任何文字！！！ \n图片中禁止出现任何文字！！！ \n🚨 MANDATORY 6-PANEL GRID LAYOUT 🚨\n\n  ⚠️ STRICT GRID REQUIREMENTS ⚠️\n  Grid: 2 rows × 3 columns = 6 panels\n  All panels EQUAL size, evenly dividing the full image\n\n  Panel layout:\n  ┌──────────┬──────────┬──────────┐\n  │ Panel 1  │ Panel 2  │ Panel 3  │\n  │ (top-left)│ (top-mid) │ (top-right)│\n  ├──────────┼──────────┼──────────┤\n  │ Panel 4  │ Panel 5  │ Panel 6  │\n  │ (bot-left)│ (bot-mid) │ (bot-right)│\n  └──────────┴──────────┴──────────┘\n\n  ⛔ FORBIDDEN:\n  - Panels of different sizes\n  - Panels not aligned to grid\n  - More or fewer than 6 panels\n  - Panels overlapping or with gaps\n\n  🖤 Panel 1 (top-left): SOLID BLACK (#000000) with white number "1"\n  📍 Panels 2-6: Story scenes with white panel numbers in top-left corner\n\n  🚨 CONTINUITY REQUIREMENT (Shot #{shot_number}) 🚨\n  Reference the previous shot image for visual continuity:\n  - Panel 2 connects naturally with previous Panel 6\n  - Consistent characters, scene, lighting, atmosphere\n\n  📸 Use varied camera angles across panels (wide, medium, close-up).\n\n  Story content :',
  'grid-9-9x16':
    '生成 9 :16比例矩形画布，内部做无间距无边框的九宫格等分布局，共 9 个 9:16 等大子画面，所有子画面风格色调统一。第 1 行第 1 列：{第 1 组原始描述词}（常规叙事视角）；第 1 行第 2 列：基于第 1 行第 1 列画面的【XX 镜头视角】分镜，保留核心人物 / 场景 / 情节，仅调整镜头取景；第 1 行第 3 列：基于第 1 行第 1 列画面的【XX 镜头视角】分镜，保留核心人物 / 场景 / 情节，仅调整镜头取景，与同排第 2 列视角不重复；第 2 行第 1 列：{第 2 组原始描述词}（常规叙事视角）；第 2 行第 2 列：基于第 2 行第 1 列画面的【XX 镜头视角】分镜，保留核心人物 / 场景 / 情节，仅调整镜头取景；第 2 行第 3 列：基于第 2 行第 1 列画面的【XX 镜头视角】分镜，保留核心人物 / 场景 / 情节，仅调整镜头取景，与同排第 2 列视角不重复；第 3 行第 1 列：{第 3 组原始描述词}（常规叙事视角）；第 3 行第 2 列：基于第 3 行第 1 列画面的【XX 镜头视角】分镜，保留核心人物 / 场景 / 情节，仅调整镜头取景；第 3 行第 3 列：基于第 3 行第 1 列画面的【XX 镜头视角】分镜，保留核心人物 / 场景 / 情节，仅调整镜头取景，与同排第 3 列视角不重复。',
  'grid-9-16x9':
    '画布与布局： 整体画布尺寸比例严格为 16:9（宽屏），高清无畸变。画面平均分为3行3列的9宫格。宫格之间无边框或仅用极淡的隐形细线（<1px，透明度<10%）分隔，确保视觉通透。\n\n分镜编号： 每个宫格左上角仅保留极简的阿拉伯数字编号（1至9）。要求：浅灰色无衬线字体，字号占单格高度的2%-3%，贴近左上角但不贴边。\n\n绝对无文字： 除分镜号外，画面中严禁出现任何多余文字、字幕、标题或水印，纯靠画面讲故事。\n\n叙事与景别： 9张图需按顺序完整呈现剧情的起承转合。灵活运用全景、中景、近景、特写以及不同视角（如俯拍、仰拍、过肩镜头等）来丰富画面张力，允许通过过肩镜头增强代入感和人物互动，突出核心转折和情绪，避免画面单调。\n\n视觉风格： 整体保持极简主义。9个分镜的画风、色彩逻辑、光影质感必须高度统一。画面干净无杂物，色彩贴合剧情氛围，光影柔和自然，人物/场景不抢戏，聚焦核心情节。',
  'grid-12':
    '图片中禁止出现任何文字！！！ \n图片中禁止出现任何文字！！！ \n图片中禁止出现任何文字！！！ \n9:16 竖屏总画布，3 列 4 行 12 宫格布局，每个独立宫格均为严格 3:4 竖屏屏比例且完美匹配对应接收的文字内容，宫格之间无任何黑色分割线、无任何形式分隔线、无描边、无空隙、无缝衔接，【参考图的人物脸型，发型，服饰完全不变】，左上角标注对应分镜编号，',
  'grid-25-9x16':
    '生成一张包含25个分镜的5×5宫格图片。必须严格遵循以下硬性规范：\n\n画布与布局： 整体画布尺寸比例严格为 9:16（竖屏），高清无畸变。由于采用了5×5共25宫格布局，每一个分镜格将呈现窄幅的竖屏比例，以适配整体的竖屏大画布。宫格之间无边框或仅用极淡的隐形细线（<1px，透明度<10%）分隔，确保视觉通透。\n\n分镜编号： 每个宫格左上角仅保留极简的阿拉伯数字编号（1至25）。要求：浅灰色无衬线字体，字号占单格高度的2%-3%，贴近左上角但不贴边。\n\n绝对无文字： 除分镜号外，画面中严禁出现任何多余文字、字幕、标题或水印，纯靠画面讲故事。\n\n叙事与景别： 25张图需按顺序完整呈现剧情的起承转合。灵活运用全景、中景、近景、特写以及不同视角（如俯拍、仰拍、过肩镜头等）来丰富画面张力，允许通过过肩镜头增强代入感和人物互动，突出核心转折和情绪，避免画面单调。\n\n视觉风格： 整体保持极简主义。25个分镜的画风、色彩逻辑、光影质感必须高度统一。画面干净无杂物，色彩贴合剧情氛围，光影柔和自然，人物/场景不抢戏，聚焦核心情节。\n\n达到"极简呈现，完整叙事"的视觉效果。',
  'grid-25-16x9':
    '画布与布局： 整体画布尺寸比例严格为 16:9（宽屏），高清无畸变。画面平均分为5行5列的25宫格。宫格之间无边框或仅用极淡的隐形细线（<1px，透明度<10%）分隔，确保视觉通透。\n\n分镜编号： 每个宫格左上角仅保留极简的阿拉伯数字编号（1至25）。要求：浅灰色无衬线字体，字号占单格高度的2%-3%，贴近左上角但不贴边。\n\n绝对无文字： 除分镜号外，画面中严禁出现任何多余文字、字幕、标题或水印，纯靠画面讲故事。\n\n叙事与景别： 25张图需按顺序完整呈现剧情的起承转合。灵活运用全景、中景、近景、特写以及不同视角（如俯拍、仰拍、过肩镜头等）来丰富画面张力，允许通过过肩镜头增强代入感和人物互动，突出核心转折和情绪，避免画面单调。\n\n视觉风格： 整体保持极简主义。25个分镜的画风、色彩逻辑、光影质感必须高度统一。画面干净无杂物，色彩贴合剧情氛围，光影柔和自然，人物/场景不抢戏，聚焦核心情节。',
}

const INFERENCE_FORMAT_META: InferenceFormatMeta[] = [
  { key: 'single', label: '单图', rows: 1, cols: 1, canvasRatio: 'free' },
  { key: 'gpt-storyboard', label: 'GPT分镜版', rows: 1, cols: 1, canvasRatio: 'free' },
  { key: 'grid-4-9x16', label: '4宫格 (2x2 9:16)', rows: 2, cols: 2, canvasRatio: '9:16' },
  { key: 'grid-4-16x9', label: '4宫格 (2x2 16:9)', rows: 2, cols: 2, canvasRatio: '16:9' },
  { key: 'grid-6', label: '6宫格 (第一黑)', rows: 2, cols: 3, canvasRatio: '16:9' },
  { key: 'grid-9-9x16', label: '9宫格 (3x3 9:16)', rows: 3, cols: 3, canvasRatio: '9:16' },
  { key: 'grid-9-16x9', label: '9宫格 (3x3 16:9)', rows: 3, cols: 3, canvasRatio: '16:9' },
  { key: 'grid-12', label: '12宫格 (3x4 3:4)', rows: 4, cols: 3, canvasRatio: '9:16' },
  { key: 'grid-25-9x16', label: '25宫格 (5x5 9:16)', rows: 5, cols: 5, canvasRatio: '9:16' },
  { key: 'grid-25-16x9', label: '25宫格 (5x5 16:9)', rows: 5, cols: 5, canvasRatio: '16:9' },
]

export const SHOT_IMAGE_QUALITY_SUFFIX = `请根据以上描述生成一张高质量的分镜图片，要求:
1. 画面构图清晰，主体突出
2. 人物形象与描述一致，保持真人写实风格
3. 场景氛围符合剧情需要
4. 电影级画面质感，真实光影效果`

const SINGLE_IMAGE_OUTPUT_HINT =
  '【输出要求】生成一张高质量单张分镜图，单一构图，单一瞬间，禁止分格、禁止九宫格、禁止 storyboard grid、禁止 comic panel。'

export interface SeedanceSegment {
  timeRange: string
  shotLabel: string
  visual: string
}

/** 生图是否携带当前剧本 — 模板层固定，暂不对用户开放 */
export const STORYBOARD_IMAGE_CARRY_SCRIPT = false

export interface BuildShotImagePromptOptions {
  shot: WorkflowShot
  inferenceFormat?: InferenceFormat | string | null
  styleText?: string
  promptPrefix?: string
  promptSuffix?: string
  scriptText?: string
  previousShot?: WorkflowShot | null
  /** 同集分镜列表，用于宫格跨镜取描述 */
  episodeShots?: WorkflowShot[]
}

export function normalizeInferenceFormat(value?: string | null): InferenceFormat {
  const trimmed = value?.trim()
  if (!trimmed) return 'single'
  if (LEGACY_INFERENCE_FORMAT_MAP[trimmed]) {
    return LEGACY_INFERENCE_FORMAT_MAP[trimmed]
  }
  if (INFERENCE_FORMAT_OPTIONS.some((item) => item.value === trimmed)) {
    return trimmed as InferenceFormat
  }
  return 'single'
}

export function getInferenceFormatMeta(format?: InferenceFormat | string | null): InferenceFormatMeta {
  const key = normalizeInferenceFormat(format)
  return INFERENCE_FORMAT_META.find((item) => item.key === key) ?? INFERENCE_FORMAT_META[0]
}

export function isGridInferenceFormat(format?: InferenceFormat | string | null): boolean {
  const meta = getInferenceFormatMeta(format)
  return meta.rows > 1 || meta.cols > 1
}

/** 宫格画布比例优先于 UI 尺寸选择（对齐画镜） */
export function resolveImageSizeForInferenceFormat(
  inferenceFormat: InferenceFormat | string | null | undefined,
  presetValue: string,
): string {
  const meta = getInferenceFormatMeta(inferenceFormat)
  if (meta.canvasRatio === 'free') {
    return resolveImageSizeApiValue(presetValue)
  }
  if (meta.canvasRatio === '9:16') {
    const prefer2k = resolveImageSizeApiValue('2k-9:16')
    if (prefer2k) return prefer2k
    return '1080x1920'
  }
  const prefer2k = resolveImageSizeApiValue('2k-16:9')
  return prefer2k || '1920x1080'
}

/** 解析 Seedance 15 秒四段式 prompt */
export function parseSeedanceSegments(text: string): SeedanceSegment[] {
  const input = String(text || '').trim()
  if (!input) return []

  const segments: SeedanceSegment[] = []
  const lineRe = /^(\d{2}:\d{2}-\d{2}:\d{2})\s+([^：:\n]+)[：:]\s*(.*)$/

  for (const rawLine of input.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const match = line.match(lineRe)
    if (!match) continue

    let content = match[3].trim()
    content = content.replace(/（衔接锚点[\s\S]*$/, '').trim()
    content = content.replace(/对白\/独白[：:][\s\S]*?(?=音效&BGM|$)/i, '').trim()
    content = content.replace(/音效&BGM[：:][\s\S]*$/i, '').trim()

    segments.push({
      timeRange: match[1],
      shotLabel: match[2].trim(),
      visual: content,
    })
  }

  return segments
}

function stripVideoPromptNoise(text: string): string {
  return String(text || '')
    .replace(/（衔接锚点[\s\S]*$/, '')
    .replace(/对白\/独白[：:][\s\S]*?(?=音效&BGM|$)/gi, '')
    .replace(/音效&BGM[：:][\s\S]*$/gi, '')
    .replace(/^\d{2}:\d{2}-\d{2}:\d{2}\s+[^：:\n]+[：:]\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildStructuredDescription(
  shot: WorkflowShot,
  format: InferenceFormat,
  episodeShots: WorkflowShot[] = [],
): string {
  const prompt = shot.prompt?.trim() ?? ''
  const spatial = shot.spatialAnchor?.trim()
  const segments = parseSeedanceSegments(prompt)

  if (format === 'single') {
    const visual =
      segments[0]?.visual ||
      stripVideoPromptNoise(prompt) ||
      prompt
    const parts = [
      spatial ? `全局空间锚点：${spatial}` : '',
      segments[0] ? `景别/运镜：${segments[0].shotLabel}；画面：${visual}` : visual,
    ].filter(Boolean)
    return parts.join('\n')
  }

  if (format === 'gpt-storyboard') {
    if (segments.length > 0) {
      return segments
        .map(
          (seg, index) =>
            `段落 ${index + 1}（${seg.timeRange} ${seg.shotLabel}）：${seg.visual}`,
        )
        .join('\n')
    }
    return [spatial ? `全局空间锚点：${spatial}` : '', prompt].filter(Boolean).join('\n')
  }

  const panelCount = getInferenceFormatMeta(format).rows * getInferenceFormatMeta(format).cols
  const effectivePanels = panelCount === 6 ? 5 : panelCount

  const panelLines: string[] = []
  if (segments.length >= effectivePanels) {
    for (let i = 0; i < effectivePanels; i += 1) {
      const seg = segments[i]
      panelLines.push(`宫格 ${i + 1}：${seg.shotLabel}，${seg.visual}`)
    }
  } else if (segments.length > 0) {
    for (let i = 0; i < effectivePanels; i += 1) {
      const seg = segments[i % segments.length]
      panelLines.push(`宫格 ${i + 1}：${seg.shotLabel}，${seg.visual}`)
    }
  } else {
    const neighbors = collectNeighborDescriptions(shot, episodeShots, effectivePanels)
    if (neighbors.length > 0) {
      neighbors.forEach((desc, index) => {
        panelLines.push(`宫格 ${index + 1}：${desc}`)
      })
    } else {
      const cleaned = stripVideoPromptNoise(prompt) || prompt
      panelLines.push(`宫格 1：${cleaned}`)
      for (let i = 1; i < effectivePanels; i += 1) {
        panelLines.push(`宫格 ${i + 1}：延续上一格情节，切换景别与视角`)
      }
    }
  }

  if (spatial) {
    panelLines.unshift(`全局空间锚点：${spatial}`)
  }
  return panelLines.join('\n')
}

function collectNeighborDescriptions(
  shot: WorkflowShot,
  episodeShots: WorkflowShot[],
  count: number,
): string[] {
  if (!episodeShots.length) return []
  const sorted = [...episodeShots].sort((a, b) => a.shotNumber - b.shotNumber)
  const index = sorted.findIndex((item) => item.id === shot.id)
  if (index < 0) return []

  const result: string[] = []
  for (let offset = 0; offset < count; offset += 1) {
    const target = sorted[index + offset]
    if (!target) break
    const text = stripVideoPromptNoise(target.prompt || '') || target.prompt || target.dialogue || ''
    if (text.trim()) result.push(text.trim())
  }
  return result
}

function fillNineGridPlaceholders(template: string, groups: string[]): string {
  let result = template
  for (let i = 0; i < 3; i += 1) {
    const desc = groups[i] || groups[0] || '当前分镜画面'
    result = result.replace(`{第 ${i + 1} 组原始描述词}`, desc)
  }
  return result
}

function applyGridTemplate(
  template: string,
  description: string,
  shotNumber: number,
): string {
  let layout = template.replace(/#\{shot_number\}/g, String(shotNumber))

  if (layout.includes('{第 1 组原始描述词}')) {
    const groups = description
      .split('\n')
      .map((line) => line.replace(/^宫格 \d+[：:]\s*/, '').trim())
      .filter((line) => line && !line.startsWith('全局空间锚点'))
      .slice(0, 3)
    layout = fillNineGridPlaceholders(layout, groups)
  }

  return layout
}

function buildPreviousShotSummary(shot?: WorkflowShot | null): string {
  if (!shot) return ''
  const segments = parseSeedanceSegments(shot.prompt || '')
  if (segments.length > 0) {
    const last = segments[segments.length - 1]
    return `${last.shotLabel}：${last.visual}`
  }
  return stripVideoPromptNoise(shot.prompt || '') || shot.dialogue || ''
}

/**
 * 分镜生图 prompt 转换层：按推理格式拼接布局模板 + 分镜正文（对齐画镜 / weifan mv）
 */
export function buildShotImagePrompt(options: BuildShotImagePromptOptions): string {
  const {
    shot,
    styleText,
    promptPrefix,
    promptSuffix,
    scriptText,
    previousShot,
    episodeShots = [],
  } = options
  const format = normalizeInferenceFormat(options.inferenceFormat)
  const meta = getInferenceFormatMeta(format)

  const description = buildStructuredDescription(shot, format, episodeShots)
  const parts: string[] = []

  const prefix = String(promptPrefix || '').trim()
  if (prefix) parts.push(prefix)

  if (meta.rows > 1 || meta.cols > 1) {
    const template = OFFICIAL_GRID_TEMPLATES[format]
    if (template) {
      let layout = applyGridTemplate(template, description, shot.shotNumber)
      if (format === 'grid-6' && /Story content\s*:?\s*$/i.test(layout)) {
        layout = layout.replace(/Story content\s*:?\s*$/i, '') + `Story content:\n${description}`
      }
      parts.push(layout)
    }
  }

  const script = String(scriptText || '').trim()
  if (STORYBOARD_IMAGE_CARRY_SCRIPT && script) {
    parts.push(
      [
        '【当前剧本原文（生图参考）】',
        script.slice(0, 800),
        '',
        '请参考以上剧本内容理解剧情逻辑、角色关系、场景上下文，但最终画面请严格以当前分镜要求为直接生成目标。',
      ].join('\n'),
    )
  }

  const style = String(styleText || '').trim()
  if (style) {
    parts.push(`【分镜风格】\n${style}`)
  }

  const previousSummary = buildPreviousShotSummary(previousShot)
  if (previousSummary) {
    parts.push(
      [
        '【画面连续性要求】',
        `这是分镜 #${shot.shotNumber}，需要与上一个分镜保持视觉连续性。`,
        `上一个分镜内容: ${previousSummary}`,
        '请确保：角色形象一致、场景氛围连贯、光影风格统一。',
      ].join('\n'),
    )
  }

  parts.push(`分镜 #${shot.shotNumber}`)
  parts.push(`描述: ${description}`)
  if (shot.dialogue?.trim()) {
    parts.push(`分镜: ${shot.dialogue.trim()}`)
  }

  if (format === 'single') {
    parts.push(SINGLE_IMAGE_OUTPUT_HINT)
  }

  parts.push(SHOT_IMAGE_QUALITY_SUFFIX)

  const suffix = String(promptSuffix || '').trim()
  if (suffix) parts.push(suffix)

  return applyPromptAffix(parts.filter(Boolean).join('\n\n'), '', '')
}
