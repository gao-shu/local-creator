import { SEED_STORYBOARD_TEMPLATES } from '@/lib/storage/prompt-templates-seed'
import type { AppSettings, PromptTemplate } from '@/types/settings'
import type { WorkflowAsset, WorkflowEpisode, WorkflowProjectData } from '@/types/workflow'

const JSON_FORMAT_INSTRUCTION = `【JSON输出格式】
请严格按照以下 JSON 格式返回，不要用 markdown 代码块包裹：

{
  "storyboard": [
    {
      "shot_number": 1,
      "dialogue": "分镜标题（5-15字）",
      "prompt": "完整生图提示词，含景别、机位、构图、动作、光线、对白，可含 @角色 @场景",
      "spatial_anchor": "以场景正面为基准，人物居左，顶侧柔光"
    }
  ]
}

⚠️ 格式要求：
- dialogue 和 prompt 内禁止使用英文双引号，用【】代替
- 只输出 JSON，无额外文字
- shot_number 从 1 连续递增
- spatial_anchor 必填`

const DEFAULT_STORYBOARD_TEMPLATE_KEY = 'seedance-15s'

/** 推理分镜可用：content 非空（空壳宫格/未填 custom 不可用） */
export function isUsableStoryboardTemplate(
  template: Pick<PromptTemplate, 'content'>,
): boolean {
  return Boolean(String(template.content ?? '').trim())
}

function pickDefaultStoryboardTemplate(list: PromptTemplate[]): PromptTemplate | undefined {
  return (
    list.find(
      (t) => t.key === DEFAULT_STORYBOARD_TEMPLATE_KEY && isUsableStoryboardTemplate(t),
    ) ?? list.find((t) => isUsableStoryboardTemplate(t))
  )
}

export function listStoryboardTemplateSelectOptions(
  settings: AppSettings,
): Array<{ value: string; label: string }> {
  return (settings.storyboardTemplates ?? [])
    .filter(isUsableStoryboardTemplate)
    .map((t) => ({ value: t.key, label: t.name }))
}

export const NO_USABLE_STORYBOARD_TEMPLATE_MESSAGE =
  '未找到可用的分镜模板（请确认内置 Seedance 15秒/10秒 模板存在且 content 非空）'

export function resolveStoryboardTemplate(
  settings: AppSettings,
  templateKey?: string,
): PromptTemplate {
  const list = settings.storyboardTemplates ?? []
  if (templateKey) {
    const hit = list.find((t) => t.key === templateKey || t.id === templateKey)
    if (hit && isUsableStoryboardTemplate(hit)) return hit
  }
  const preferred =
    pickDefaultStoryboardTemplate(list) ??
    pickDefaultStoryboardTemplate(SEED_STORYBOARD_TEMPLATES)
  if (preferred) return preferred
  throw new Error(NO_USABLE_STORYBOARD_TEMPLATE_MESSAGE)
}

/** 解析项目当前分镜模板 key，兼容旧数据存 id、以及 key 不在列表中的情况 */
const LEGACY_STORYBOARD_TEMPLATE_KEYS: Record<string, string> = {
  '2': 'seedance-15s',
  ai影视导演测试: 'seedance-15s',
  seedance专用: 'seedance-15s',
  dong: 'seedance-15s',
  ad: 'seedance-15s',
  ad2: 'seedance-15s',
  良哥: 'seedance-15s',
  seedance2: 'seedance-15s',
  'seedance-15-pro': 'seedance-15s',
  'seedance-new': 'seedance-15s',
  new法测试: 'seedance-15s',
  AI影视导演: 'seedance-15s',
  /** 内置空 content 占位，旧项目若选中则回落 Seedance */
  '1': 'seedance-15s',
  '5': 'seedance-15s',
  '9宫格': 'seedance-15s',
  '4宫格': 'seedance-15s',
}

/** 内置 custom 未填 content 时回落 Seedance；用户已填写 custom 则保留 */
function normalizeStoredStoryboardTemplateKey(
  stored: string | undefined,
  list: PromptTemplate[],
): string | undefined {
  const key = stored?.trim()
  if (!key) return undefined
  const legacy = LEGACY_STORYBOARD_TEMPLATE_KEYS[key]
  if (legacy) return legacy
  if (key === 'custom') {
    const customTpl = list.find((t) => t.key === 'custom' || t.id === 'custom')
    if (!customTpl || !isUsableStoryboardTemplate(customTpl)) {
      return DEFAULT_STORYBOARD_TEMPLATE_KEY
    }
  }
  return key
}

export function resolveProjectStoryboardTemplateKey(
  data: Pick<WorkflowProjectData, 'storyboardTemplateKey'> | null | undefined,
  settings: AppSettings,
): string {
  const list = settings.storyboardTemplates ?? []
  const stored = normalizeStoredStoryboardTemplateKey(data?.storyboardTemplateKey, list)
  if (stored) {
    const hit = list.find((t) => t.key === stored || t.id === stored)
    if (hit && isUsableStoryboardTemplate(hit)) return hit.key
  }
  return resolveStoryboardTemplate(settings).key
}

/** 画布全局设置：解析 lastUsedCanvasStoryboardTemplateKey（空壳/legacy 回落 seedance） */
export function resolveCanvasStoryboardTemplateKey(settings: AppSettings): string {
  return resolveProjectStoryboardTemplateKey(
    { storyboardTemplateKey: settings.lastUsedCanvasStoryboardTemplateKey },
    settings,
  )
}

function formatEntityList(assets: WorkflowAsset[], label: string): string {
  if (!assets.length) return `【${label}】\n无`
  const lines = assets.map((a) => `- @${a.name}：${a.description || a.prompt || '暂无描述'}`)
  return `【${label}】\n${lines.join('\n')}`
}

/** 解析分镜 LLM 正文：可用 template → settings 回落 → 内置 seed，不再使用老生图默认 prompt */
export function resolveStoryboardPromptBody(
  template?: PromptTemplate,
  settings?: AppSettings,
): string {
  const fromTemplate = template?.content?.trim()
  if (fromTemplate) return fromTemplate

  if (settings) {
    const resolved = resolveStoryboardTemplate(settings, template?.key).content?.trim()
    if (resolved) return resolved
  }

  const fromSeed = pickDefaultStoryboardTemplate(SEED_STORYBOARD_TEMPLATES)?.content?.trim()
  if (fromSeed) return fromSeed

  throw new Error(NO_USABLE_STORYBOARD_TEMPLATE_MESSAGE)
}

export function buildStoryboardPrompt(
  episode: WorkflowEpisode,
  assets: {
    characters: WorkflowAsset[]
    scenes: WorkflowAsset[]
    props: WorkflowAsset[]
  },
  template?: PromptTemplate,
  settings?: AppSettings,
): string {
  const tpl = resolveStoryboardPromptBody(template, settings)
  const sceneDescription = episode.content.trim() || episode.summary.trim()
  const variables: Record<string, string> = {
    scene_description: sceneDescription,
    story_text: sceneDescription,
    characters_instruction: formatEntityList(assets.characters, '角色信息'),
    scenes_instruction: formatEntityList(assets.scenes, '场景信息'),
    items_instruction: assets.props.length
      ? formatEntityList(assets.props, '物品信息')
      : '',
    json_format_instruction: JSON_FORMAT_INSTRUCTION,
  }

  let prompt = tpl
  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  if (!prompt.includes('JSON') && !prompt.includes('json')) {
    prompt += `\n\n${JSON_FORMAT_INSTRUCTION}`
  }
  return prompt
}

/** 单次补空间锚点最多处理的目标镜数；超出则分批请求以控 token */
export const STORYBOARD_VALIDATE_BATCH_SIZE = 8
/** 分批时附带的前置镜数（只作连续性上下文，不要求模型再输出这些镜） */
export const STORYBOARD_VALIDATE_CONTEXT_LOOKBACK = 2
/** 深度档原文摘要最大字符（避免塞入过长剧本） */
export const STORYBOARD_VALIDATE_SCRIPT_SUMMARY_MAX_CHARS = 1200

export type StoryboardValidateMode = 'quick' | 'deep'

export type ValidatePromptShotInput = {
  shotNumber: number
  dialogue: string
  prompt: string
  spatialAnchor?: string
}

/** 未显式配置时：内部 → deep，外部 → quick */
export function resolveStoryboardValidateMode(
  saved: StoryboardValidateMode | undefined,
  isInternal: boolean,
): StoryboardValidateMode {
  if (saved === 'quick' || saved === 'deep') return saved
  return isInternal ? 'deep' : 'quick'
}

/** 深度档用的本集原文摘要（截断，不塞画镜全文举例） */
export function buildEpisodeScriptSummary(
  content: string | undefined | null,
  maxChars: number = STORYBOARD_VALIDATE_SCRIPT_SUMMARY_MAX_CHARS,
): string {
  const normalized = String(content || '')
    .replace(/\r\n/g, '\n')
    .trim()
  if (!normalized) return ''
  const collapsed = normalized.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
  if (collapsed.length <= maxChars) return collapsed
  return `${collapsed.slice(0, Math.max(1, maxChars - 1))}…`
}

/**
 * 将分镜按批切开（目标镜）；lookback 由调用方按批起点另取。
 */
export function chunkShotsForValidate<T>(
  shots: T[],
  batchSize: number = STORYBOARD_VALIDATE_BATCH_SIZE,
): T[][] {
  const size = Math.max(1, Math.floor(batchSize) || STORYBOARD_VALIDATE_BATCH_SIZE)
  if (shots.length <= size) return [shots]
  const batches: T[][] = []
  for (let i = 0; i < shots.length; i += size) {
    batches.push(shots.slice(i, i + size))
  }
  return batches
}

/**
 * 空间锚点二次验证 system prompt。
 * - quick：轻量只补锚点（控 token）
 * - deep：硬规则 + 可选原文摘要（连续性审查）
 * 长分镜分批时传入 contextShots 作为 lookback。
 */
export function buildValidatePrompt(
  shots: ValidatePromptShotInput[],
  options?: {
    contextShots?: ValidatePromptShotInput[]
    mode?: StoryboardValidateMode
    /** 深度档：本集原文摘要（已截断） */
    scriptSummary?: string
  },
): string {
  const mode = options?.mode === 'quick' ? 'quick' : 'deep'
  const list = shots
    .map(
      (s) =>
        `镜号 ${s.shotNumber} | 标题：${s.dialogue}\nPrompt：${s.prompt}`,
    )
    .join('\n\n')

  const context = options?.contextShots ?? []
  const contextBlock =
    context.length > 0
      ? `【前置上下文】以下镜头仅供连续性参考，不要为它们输出 shots 条目：
${context
  .map((s) => {
    const anchor = s.spatialAnchor?.trim()
    return `镜号 ${s.shotNumber} | 标题：${s.dialogue}\nPrompt：${s.prompt}${
      anchor ? `\n已有空间锚点：${anchor}` : ''
    }`
  })
  .join('\n\n')}

`
      : ''

  const targetHint =
    context.length > 0
      ? `- 只为「待生成分镜」列表中的镜号输出 shots，覆盖全部待生成镜号；不要重复输出前置上下文镜号。`
      : `- 必须覆盖输入的全部镜号。`

  const scriptSummary = buildEpisodeScriptSummary(options?.scriptSummary)
  const scriptBlock =
    mode === 'deep' && scriptSummary
      ? `【原文摘要】（仅供核对人物/场景连续性，勿整段抄入锚点；禁止扩写举例）
${scriptSummary}

`
      : ''

  if (mode === 'quick') {
    return `你是分镜场记。请为每条分镜补充一句「全局空间锚点」（场景方位、人物站位、光线方向）。
不要改写、润色 Prompt，不要增删 @人物/@场景/@物品。

【输出】只返回 JSON（勿 markdown）：
{"shots":[{"shot_number":1,"spatial_anchor":"..."}]}
${targetHint}

${contextBlock}【待生成分镜】：
${list}`
  }

  return `你是影视分镜场记，负责为每条分镜补充「全局空间锚点」（深度连续性审查）。
逐镜处理：当前镜 = B，上一镜 = A（首镜无 A）。锚点只写空间事实（谁在哪、站/坐/躺、前后左右、关键道具环境状态），不写五官服饰情绪运镜。

【硬规则】
1. 人群继承：A 出现的人物/群体（含群众）在 B 未离场、未切场时默认仍在场；禁止无故少人/凭空加人。人数不明时写「若干」而非编造精确数字。
2. 姿势继承：B 未写起身/坐下/躺下/转身等转移动作时，人物姿势须与 A 结束态一致。
3. 场景跳切重置：B 的场景/地点与 A 明显不同，或明确时空跳切时，可重置场内人物与站位，按 B 正文重建锚点；同场连续则必须继承 A 的站位关系与道具残留（如门开着、碎物在地）。
4. 禁止改 @：锚点与推演中不得增删改原 Prompt 里的 @人物/@场景/@物品；不得改写、润色、扩写 Prompt 正文。

【输出】
- 每镜一条 spatial_anchor，一至三句中文，建议形如：「以…为基准。……；……。」
- 只返回 JSON（勿 markdown）。推荐格式：
{"passed":true,"summary":"一句话总结","issues":[],"shots":[{"shot_number":1,"spatial_anchor":"..."}]}
- issues 项：{"shot_number":2,"type":"人物站位|姿势继承|人群继承|内容缺失|镜头衔接","problem":"具体问题","suggestion":"修改建议"}；无问题则 issues=[]、passed=true。
- 兼容旧格式（可带 prompt，客户端丢弃，不写盘）：
{"shots":[{"shot_number":1,"spatial_anchor":"...","prompt":"..."}]}
${targetHint}
- 严禁改写分镜 Prompt 正文。passed/summary/issues 可为可选，缺失时客户端仍可接受。

${scriptBlock}${contextBlock}【待生成分镜】：
${list}`
}

export interface ParsedStoryboardItem {
  shotNumber: number
  dialogue: string
  prompt: string
  spatialAnchor?: string
}

export interface ParsedValidateItem {
  shotNumber: number
  spatialAnchor: string
  /** 兼容旧模型 JSON；客户端应用时忽略，永不写回 shot.prompt */
  prompt?: string
}

export interface ParsedValidateIssue {
  shotNumber?: number
  type: string
  problem: string
  suggestion?: string
}

/** 二次验证整包解析结果（shots 必填；passed / issues 可选） */
export interface ParsedValidatePayload {
  shots: ParsedValidateItem[]
  passed?: boolean
  summary?: string
  issues: ParsedValidateIssue[]
}

function extractJsonObject(raw: string): string {
  let s = raw.trim()
  const jsonBlock = raw.match(/```json\s*([\s\S]*?)\s*```/i)
  if (jsonBlock) s = jsonBlock[1]
  else {
    const anyBlock = raw.match(/```\s*([\s\S]*?)\s*```/i)
    if (anyBlock) s = anyBlock[1].trim()
  }
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start !== -1 && end > start) s = s.slice(start, end + 1)
  // eslint-disable-next-line no-control-regex
  return s.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/[\x00-\x1F\x7F]/g, ' ')
}

/**
 * 修复 LLM JSON 中的非法转义（如 Markdown 残留 `\(` `\-` `\.` `\!`）。
 * 合法转义保留；非法则去掉反斜杠保留后续字符。
 */
function sanitizeInvalidJsonEscapes(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch !== '\\') {
      out += ch
      continue
    }
    const next = text[i + 1]
    if (next == null) {
      // 尾部孤立反斜杠，丢弃
      break
    }
    if ('"\\/bfnrt'.includes(next)) {
      out += ch + next
      i += 1
      continue
    }
    if (next === 'u' && /^[0-9a-fA-F]{4}/.test(text.slice(i + 2, i + 6))) {
      out += text.slice(i, i + 6)
      i += 5
      continue
    }
    // 非法转义：丢掉 `\`，保留原字符（St\. → St.）
    out += next
    i += 1
  }
  return out
}

function parseExtractedJsonObject(raw: string): unknown {
  const extracted = extractJsonObject(raw)
  try {
    return JSON.parse(extracted)
  } catch {
    return JSON.parse(sanitizeInvalidJsonEscapes(extracted))
  }
}

export function parseStoryboardResult(raw: string): ParsedStoryboardItem[] {
  if (!raw.trim()) throw new Error('分镜结果为空')
  let parsed: {
    storyboard?: unknown[]
    shots?: unknown[]
  }
  try {
    parsed = parseExtractedJsonObject(raw) as {
      storyboard?: unknown[]
      shots?: unknown[]
    }
  } catch {
    throw new Error('分镜结果解析失败（非有效 JSON），请重试')
  }
  const list = parsed.storyboard ?? parsed.shots ?? []
  if (!Array.isArray(list) || list.length === 0) throw new Error('未生成有效分镜')

  return list
    .map((item, index) => {
      const row = item as Record<string, unknown>
      const shotNumber = Number(row.shot_number ?? row.shotNumber ?? index + 1)
      const dialogue = String(row.dialogue || row.title || `镜头 ${shotNumber}`).trim()
      const prompt = String(row.prompt || row.description || row.content || '').trim()
      if (!prompt) return null
      return {
        shotNumber,
        dialogue,
        prompt,
        spatialAnchor: row.spatial_anchor
          ? String(row.spatial_anchor)
          : row.spatialAnchor
            ? String(row.spatialAnchor)
            : undefined,
      }
    })
    .filter((item): item is ParsedStoryboardItem => item != null)
    .sort((a, b) => a.shotNumber - b.shotNumber)
}

/**
 * 解析二次验证 LLM JSON。
 * 兼容：
 * - `{ shots:[{ shot_number, spatial_anchor }] }`
 * - `{ shots:[{ shot_number, spatial_anchor, prompt }] }`（prompt 仅透传，上层忽略）
 * - 可选顶层：`passed` / `summary` / `issues[]`
 * - camelCase：`shotNumber` / `spatialAnchor`
 * - 别名数组：`storyboard`（与推理分镜输出同名时）
 */
export function parseValidateResult(raw: string): ParsedValidatePayload {
  if (!raw.trim()) throw new Error('二次验证结果为空，请重试')

  let parsed: Record<string, unknown>
  try {
    parsed = parseExtractedJsonObject(raw) as Record<string, unknown>
  } catch {
    throw new Error('二次验证结果解析失败（非有效 JSON），请重试')
  }

  const listRaw = parsed.shots ?? parsed.storyboard
  const list = Array.isArray(listRaw) ? listRaw : []
  if (list.length === 0) {
    throw new Error('二次验证未返回有效镜头列表，请重试')
  }

  const shots = list
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const shotNumber = Number(row.shot_number ?? row.shotNumber)
      if (!Number.isFinite(shotNumber) || shotNumber <= 0) return null
      const spatialAnchor = String(row.spatial_anchor ?? row.spatialAnchor ?? '').trim()
      const promptRaw = row.prompt
      const prompt =
        promptRaw == null || promptRaw === ''
          ? undefined
          : String(promptRaw).trim() || undefined
      return {
        shotNumber,
        spatialAnchor,
        ...(prompt ? { prompt } : {}),
      }
    })
    .filter((item): item is ParsedValidateItem => item != null)

  if (shots.length === 0) {
    throw new Error('二次验证未解析出任何镜头，请重试')
  }
  if (!shots.some((item) => item.spatialAnchor)) {
    throw new Error('二次验证未返回有效空间锚点，请重试')
  }

  const issues = parseValidateIssues(parsed.issues)
  const passed =
    typeof parsed.passed === 'boolean'
      ? parsed.passed
      : issues.length === 0
        ? true
        : false
  const summaryRaw = parsed.summary
  const summary =
    summaryRaw == null || summaryRaw === ''
      ? undefined
      : String(summaryRaw).trim() || undefined

  return {
    shots,
    passed,
    ...(summary ? { summary } : {}),
    issues,
  }
}

function parseValidateIssues(raw: unknown): ParsedValidateIssue[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const problem = String(row.problem ?? row.message ?? row.description ?? '').trim()
      if (!problem) return null
      const type = String(row.type ?? row.kind ?? '连续性').trim() || '连续性'
      const shotNum = Number(row.shot_number ?? row.shotNumber)
      const suggestionRaw = row.suggestion ?? row.fix
      const suggestion =
        suggestionRaw == null || suggestionRaw === ''
          ? undefined
          : String(suggestionRaw).trim() || undefined
      return {
        type,
        problem,
        ...(Number.isFinite(shotNum) && shotNum > 0 ? { shotNumber: shotNum } : {}),
        ...(suggestion ? { suggestion } : {}),
      }
    })
    .filter((item): item is ParsedValidateIssue => item != null)
}
