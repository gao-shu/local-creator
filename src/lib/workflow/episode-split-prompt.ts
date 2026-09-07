import type { EpisodeStyle } from '@/types/workflow'
import type { PromptTemplate } from '@/types/settings'
import { EXTRACT_TEMPLATE_PRO_KEY } from '@/constants/asset-extract'
import { formatExtractTemplateForEpisodeSplit } from '@/lib/workflow/extract-prompt'

const EPISODE_STYLE_LABELS: Record<EpisodeStyle, string> = {
  realistic: '真人写实',
  comic: '漫画风格',
  '2d_anime': '2D动漫',
  '3d_anime': '3D动画',
  article: '图文推文',
}

const EPISODE_STYLE_RULES: Record<EpisodeStyle, string> = {
  realistic: '影视写实语境，场景与人物描写可拍摄、可生图，避免抽象空话。',
  comic: '可带漫画分格感与夸张视觉，角色外形特征要具体。',
  '2d_anime': '日系二维动画视觉，色调、发型、服装风格明确。',
  '3d_anime': '三维渲染观感，材质与光影描述具体。',
  article: '短句、强节奏，适合竖屏短视频口播/字幕。',
}

export function normalizeEpisodeStyle(style?: string): EpisodeStyle {
  const key = String(style || 'realistic').trim().toLowerCase() as EpisodeStyle
  return EPISODE_STYLE_RULES[key] ? key : 'realistic'
}

/** 注入提取 Prompt 的描述风格段落（不含生图画风词） */
export function formatDescriptionStyleBlock(style?: string): string {
  const styleKey = normalizeEpisodeStyle(style)
  return `## 描述风格（${EPISODE_STYLE_LABELS[styleKey]}）

${EPISODE_STYLE_RULES[styleKey]}`
}

/** 分集+提取一体模板（如「快速提取Pro」），不再套外层 buildEpisodeSplitPrompt */
export function isStandaloneEpisodeExtractTemplate(template?: PromptTemplate): boolean {
  return template?.key === EXTRACT_TEMPLATE_PRO_KEY
}

function applyDescriptionStyleToTemplate(body: string, style?: string): string {
  const styleBlock = formatDescriptionStyleBlock(style)
  if (body.includes('{description_style}') || body.includes('{descriptionStyle}')) {
    return body
      .replace(/\{description_style\}/g, styleBlock)
      .replace(/\{descriptionStyle\}/g, styleBlock)
  }
  if (!styleBlock.trim()) return body
  return `${styleBlock}\n\n${body}`
}

export function buildStandaloneEpisodeExtractPrompt(
  content: string,
  template: PromptTemplate,
  style?: string,
): string {
  const text = String(content || '').trim()
  if (!text) throw new Error('剧本内容为空，无法分集')

  const body = applyDescriptionStyleToTemplate(template.content.trim(), style)
  if (body.includes('{content}')) {
    return body.replace('{content}', text)
  }
  return `${body}

---原文---
${text}`
}

export function buildEpisodeSplitPrompt(
  content: string,
  style?: string,
  extractTemplate?: PromptTemplate,
): string {
  if (extractTemplate && isStandaloneEpisodeExtractTemplate(extractTemplate)) {
    return buildStandaloneEpisodeExtractPrompt(content, extractTemplate, style)
  }

  const styleKey = normalizeEpisodeStyle(style)
  const text = String(content || '').trim()
  if (!text) throw new Error('剧本内容为空，无法分集')

  const extractSection = formatExtractTemplateForEpisodeSplit(extractTemplate)

  return `你是资深影视分镜师与文生图/视频 Prompt 专家。请将用户提供的完整剧本按自然分集边界拆分，并提取每集资产信息。

## 核心原则（最高优先级）

1. **忠实原文**：每一集 episodes[].content 必须是「原始输入剧本」的连续原文片段。禁止 paraphrase、润色、扩写、缩写、加戏、改台词、改格式。
2. **分集边界**：若原文已有分集标记（如「第1集」「EP01」「第一集」），严格按标记拆分；否则按情节/场景自然分界。
3. **完整性**：各集 content 按 episodeIndex 顺序拼接后，应与原文一致（仅允许首尾空白差异）。
4. **禁止改写**：不得为控制字数、增强悬念或调整节奏而修改 content。

## 集标题

- title：优先沿用原文中的集标题；若无明确标题，使用「第 N 集」。
- 不要生成 summary、hook、hookScore 等字段。

## 资产提取（实体生图隔离）

- characters 和 items 的 description 采用「全身视角/整体视角…站在白色背景前/放置在白色背景上」的隔离写法，只描述材质、纹理、尺寸、穿着，不夹带剧情动作。
- scenes 的 description 为「纯场景/无生物 Prompt」，只描写环境、建筑、光线、色调，明确标注「场景中无生物，只有静态陈设/环境」。
- 画风仅影响资产 description，不影响 content。

## 画风（${EPISODE_STYLE_LABELS[styleKey]}）

${EPISODE_STYLE_RULES[styleKey]}

${extractSection ? `\n${extractSection}\n` : ''}
## 输出格式

请直接输出一个 JSON 对象，不要用 markdown 代码块包裹，不要包含任何前后解释。结构如下（episodes 数组即分集结果，字段名必须一致）：

{"episodes":[{"episodeIndex":1,"title":"第 1 集 或原文集标题","content":"本集剧本原文片段，一字不改","characters":[{"name":"角色名","description":"全身/半身视角，名叫XX的XX岁男性/女性站在白色背景前，[外貌、五官、发质、服装材质、色彩、鞋子、体态细节]，站姿/坐姿端正而放松，无环境干扰。"}],"scenes":[{"name":"场景名","description":"[空间、建筑材质、纹理、地面、光线方向、色温、影长]，明确强调：场景内无人，无动物，只有静态陈设或环境。"}],"items":[{"name":"物品/道具名","description":"放置在白色背景上时，[尺寸、材质、颜色、表面纹理、使用痕迹、结构工艺细节]。"}]}]}

## 硬性要求

1. episodes 至少 1 集；长文必须拆成多集，不要整本合并为一集。
2. 每一集的 title、content 均须为非空字符串。
3. characters、scenes、items 必须是数组；没有则写 []，不要 null。
4. 只输出 JSON，不要解释。

## 原始输入剧本

${text}`
}

export function parseEpisodeSplitResult(raw: string): Array<Record<string, unknown>> {
  if (!raw || typeof raw !== 'string') throw new Error('分集结果为空')
  let s = raw.trim()
  const jsonBlock = raw.match(/```json\s*([\s\S]*?)\s*```/i)
  if (jsonBlock) s = jsonBlock[1]
  else {
    const anyBlock = raw.match(/```\s*([\s\S]*?)\s*```/i)
    if (anyBlock) s = anyBlock[1]
  }
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start !== -1 && end > start) s = s.slice(start, end + 1)
  // 清理 LLM 输出中不可见控制字符，避免 JSON.parse 失败
  // eslint-disable-next-line no-control-regex
  s = s.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/[\x00-\x1F\x7F]/g, ' ')

  const parsed = JSON.parse(s) as {
    episodes?: unknown[]
    storyboard?: unknown[]
    data?: { episodes?: unknown[]; storyboard?: unknown[] }
  }

  const rawEpisodes =
    parsed.episodes ||
    parsed.data?.episodes ||
    parsed.data?.storyboard ||
    parsed.storyboard ||
    (Array.isArray(parsed) ? parsed : [])

  if (!Array.isArray(rawEpisodes) || rawEpisodes.length === 0) {
    throw new Error('未生成有效分集结果')
  }

  return rawEpisodes.map((item) => {
    const row = item as Record<string, unknown>
    if (row.title || row.content) return row
    if (row.name && !row.title) {
      return { ...row, title: String(row.name) }
    }
    return row
  })
}
