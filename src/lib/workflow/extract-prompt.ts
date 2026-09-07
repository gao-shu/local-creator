import type { PromptTemplate } from '@/types/settings'

const EXTRACT_BUILTIN = `请分析以下文本，提取其中的角色、场景和物品信息。

文本内容：
{content}

请只返回 JSON，不要输出其他解释。JSON 格式如下：
{
  "characters": [{"name": "角色名", "description": "角色外貌、服装、性格等描述"}],
  "scenes": [{"name": "场景名", "description": "场景环境、氛围、光线等描述"}],
  "items": [{"name": "物品名", "description": "物品外观、材质、用途等描述"}]
}

要求：
1. 没有对应实体时返回空数组
2. 名称简洁，描述尽量具体
3. 严格输出合法 JSON`

const JSON_OUTPUT_SUFFIX = `

请只返回一个 JSON 对象，不要用 markdown 代码块或前言说明。格式：
{"characters":[{"name":"","description":""}],"scenes":[{"name":"","description":""}],"items":[{"name":"","description":""}]}
没有对应实体时该数组为空 []。`

export interface BuildExtractPromptOptions {
  /** 描述风格段落，替换模板内 {description_style} 或置于正文前 */
  descriptionStyleBlock?: string
}

function applyDescriptionStylePlaceholders(text: string, styleBlock: string): string {
  if (text.includes('{description_style}') || text.includes('{descriptionStyle}')) {
    return text
      .replace(/\{description_style\}/g, styleBlock)
      .replace(/\{descriptionStyle\}/g, styleBlock)
  }
  if (!styleBlock.trim()) return text
  return `${styleBlock}\n\n${text}`
}

export function buildExtractPrompt(
  content: string,
  template?: PromptTemplate,
  options?: BuildExtractPromptOptions,
): string {
  const styleBlock = options?.descriptionStyleBlock?.trim() ?? ''
  const tpl = template?.content?.trim() || EXTRACT_BUILTIN
  const body = applyDescriptionStylePlaceholders(tpl, styleBlock)
  let prompt: string
  if (body.includes('{content}')) {
    prompt = body.replace('{content}', content)
  } else {
    prompt = `${body}

文本内容：
${content}`
  }
  if (!/json/i.test(body)) {
    prompt += JSON_OUTPUT_SUFFIX
  }
  return prompt
}

/** 将提取模板嵌入分集 Prompt，用于规范每集 characters/scenes/items */
export function formatExtractTemplateForEpisodeSplit(template?: PromptTemplate): string {
  const raw = template?.content?.trim()
  if (!raw) return ''

  const label = template?.name?.trim() || template?.key?.trim() || '提取模板'
  let body = raw.includes('{content}')
    ? raw.replace(/\{content\}/g, '（见下文「原始输入剧本」）')
    : raw

  return `## 资产提取规范（${label}）

以下规范用于填写每一集 episodes[].characters / scenes / items；**整体输出仍须为上文规定的 episodes 分集 JSON**，勿改为仅输出根级 characters/scenes/items 清单。

${body}`
}

export interface ExtractResult {
  characters: Array<{ name: string; description: string }>
  scenes: Array<{ name: string; description: string }>
  items: Array<{ name: string; description: string }>
}

function normalizeEntities(arr: unknown[] | undefined) {
  return (arr ?? [])
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      const row = x as Record<string, unknown>
      return {
        name: String(row.name || '').trim(),
        description: String(row.description || '').trim(),
      }
    })
    .filter((x) => x.name)
}

function tryParseExtractJson(raw: string): ExtractResult | null {
  let s = raw.trim()
  const jsonBlock = raw.match(/```json\s*([\s\S]*?)\s*```/i)
  if (jsonBlock) s = jsonBlock[1]
  else {
    const anyBlock = raw.match(/```\s*([\s\S]*?)\s*```/i)
    if (anyBlock) s = anyBlock[1].trim()
  }

  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end <= start) return null

  s = s.slice(start, end + 1)
  // eslint-disable-next-line no-control-regex
  s = s.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/[\x00-\x1F\x7F]/g, ' ')

  try {
    const parsed = JSON.parse(s) as {
      characters?: unknown[]
      scenes?: unknown[]
      items?: unknown[]
      props?: unknown[]
    }
    return {
      characters: normalizeEntities(parsed.characters),
      scenes: normalizeEntities(parsed.scenes),
      items: normalizeEntities(parsed.items ?? parsed.props),
    }
  } catch {
    return null
  }
}

/** 兼容模型返回 Markdown 资产清单（如提取模板 V2） */
function parseMarkdownExtract(raw: string): ExtractResult {
  const result: ExtractResult = { characters: [], scenes: [], items: [] }
  let section: keyof ExtractResult | null = null
  let name = ''
  let descParts: string[] = []

  const flush = () => {
    const n = name.trim()
    if (!n || !section) return
    const description = descParts.join('；').replace(/\s+/g, ' ').trim()
    result[section].push({ name: n, description })
    name = ''
    descParts = []
  }

  const pushListItem = (text: string) => {
    const colon = text.search(/[：:]/)
    const itemName = colon > 0 ? text.slice(0, colon).trim() : text.slice(0, 40).trim()
    if (itemName) result.items.push({ name: itemName, description: text })
  }

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed === '---') continue

    const h2 = trimmed.match(/^##\s+(.+)/)
    if (h2) {
      flush()
      const title = h2[1]
      if (/角色/.test(title)) section = 'characters'
      else if (/场景/.test(title)) section = 'scenes'
      else if (/物品|道具/.test(title)) section = 'items'
      else section = null
      continue
    }

    const h3 = trimmed.match(/^###\s+(.+)/)
    if (h3) {
      flush()
      const title = h3[1].trim()
      const isItemGroup =
        section === 'items' &&
        !/^\d+\./.test(title) &&
        !/^场景\d+/.test(title)
      if (isItemGroup) {
        name = ''
        continue
      }
      name = title
        .replace(/^\d+\.\s*/, '')
        .replace(/^场景\d+[：:]\s*/, '')
        .replace(/（[^）]*）$/, '')
        .trim()
      continue
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)/)
    if (!bullet) continue

    const text = bullet[1].replace(/\*\*([^*]+)\*\*[：:]\s*/g, '$1：').trim()
    if (section === 'items' && !name) {
      pushListItem(text)
    } else {
      descParts.push(text)
    }
  }

  flush()
  return result
}

export function parseExtractResult(raw: string): ExtractResult {
  if (!raw?.trim()) throw new Error('提取结果为空')

  const fromJson = tryParseExtractJson(raw)
  if (fromJson) return fromJson

  const fromMd = parseMarkdownExtract(raw)
  if (fromMd.characters.length + fromMd.scenes.length + fromMd.items.length > 0) {
    return fromMd
  }

  throw new Error('提取结果无法解析，请检查模型是否返回 JSON 或结构化 Markdown')
}
