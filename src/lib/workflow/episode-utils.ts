import type { EpisodeStyle, WorkflowEpisode, WorkflowEpisodePlan, WorkflowProjectData } from '@/types/workflow'
import { EPISODE_PLAN_LABELS } from '@/types/workflow'
import { generateUUID } from '@/lib/utils'

export const EPISODE_STYLE_OPTIONS: { value: EpisodeStyle; label: string }[] = [
  { value: 'realistic', label: '写实' },
  { value: 'comic', label: '漫画' },
  { value: '2d_anime', label: '2D动漫' },
  { value: '3d_anime', label: '3D动画' },
  { value: 'article', label: '图文推文' },
]

export function hasScriptContent(script: string | undefined | null): boolean {
  return Boolean(script?.trim())
}

/** 全文剧本优先；否则合并各分集 content（Step2 预览常见场景） */
export function resolveProjectScriptText(
  data: Pick<WorkflowProjectData, 'script' | 'episodes'>,
): string {
  const full = data.script?.trim()
  if (full) return full
  return (data.episodes ?? [])
    .map((ep) => ep.content?.trim())
    .filter(Boolean)
    .join('\n\n')
}

/** 合并各集 content（非空），集间空行分隔 */
export function mergeEpisodeContents(episodes: WorkflowEpisode[]): string {
  return episodes
    .map((ep) => ep.content?.trim())
    .filter(Boolean)
    .join('\n\n')
}

export type Step2AiScriptPurpose = 'extract' | 'split'

export type Step2AiScriptSourceKind =
  | 'single_episode'
  | 'episodes_merged'
  | 'step1_script'
  | 'project_fallback'

export interface Step2AiScriptResolution {
  purpose: Step2AiScriptPurpose
  script: string
  sourceKind: Step2AiScriptSourceKind
  /** 人类可读来源，如「第 1 集本集脚本」「第 1–3 集脚本拼接」 */
  sourceLabel: string
  charCount: number
}

export interface ResolveStep2AiScriptOptions {
  activeEpisodeId?: string | null
}

function buildStep2AiScriptResolution(
  purpose: Step2AiScriptPurpose,
  script: string,
  sourceKind: Step2AiScriptSourceKind,
  sourceLabel: string,
): Step2AiScriptResolution {
  const trimmed = script.trim()
  return {
    purpose,
    script: trimmed,
    sourceKind,
    sourceLabel,
    charCount: trimmed.length,
  }
}

/**
 * Step2 AI 操作剧本文本（含来源说明）。
 * - extract：单集 → 本集 content；多集 → 各集 content 拼接（不再默认 Step1 全文）
 * - split：优先 Step1 全文，无全文时回退各集拼接
 */
export function resolveStep2AiScript(
  data: Pick<WorkflowProjectData, 'script' | 'episodes'>,
  purpose: Step2AiScriptPurpose,
  _options: ResolveStep2AiScriptOptions = {},
): Step2AiScriptResolution {
  const episodes = Array.isArray(data.episodes) ? data.episodes : []
  const step1Script = data.script?.trim() ?? ''

  if (purpose === 'split') {
    if (step1Script) {
      return buildStep2AiScriptResolution('split', step1Script, 'step1_script', 'Step1 全文剧本')
    }
    const merged = mergeEpisodeContents(episodes)
    if (merged) {
      const label =
        episodes.length > 1
          ? `各集脚本拼接（无 Step1 全文，共 ${episodes.length} 集）`
          : `第 ${episodes[0]?.episodeIndex ?? 1} 集本集脚本（无 Step1 全文）`
      return buildStep2AiScriptResolution('split', merged, 'episodes_merged', label)
    }
    const fallback = resolveProjectScriptText(data)
    return buildStep2AiScriptResolution('split', fallback, 'project_fallback', '项目剧本文本')
  }

  // extract
  if (episodes.length === 1) {
    const ep = episodes[0]
    const episodeContent = ep?.content?.trim()
    if (episodeContent) {
      return buildStep2AiScriptResolution(
        'extract',
        episodeContent,
        'single_episode',
        `第 ${ep.episodeIndex} 集本集脚本`,
      )
    }
    if (step1Script) {
      return buildStep2AiScriptResolution('extract', step1Script, 'step1_script', 'Step1 全文剧本')
    }
    const fallback = resolveProjectScriptText(data)
    return buildStep2AiScriptResolution('extract', fallback, 'project_fallback', '项目剧本文本')
  }

  if (episodes.length > 1) {
    const merged = mergeEpisodeContents(episodes)
    if (merged) {
      const filledCount = episodes.filter((ep) => ep.content?.trim()).length
      const sourceLabel =
        filledCount === episodes.length
          ? `第 1–${episodes.length} 集脚本拼接`
          : `各集脚本拼接（${filledCount}/${episodes.length} 集有内容）`
      return buildStep2AiScriptResolution('extract', merged, 'episodes_merged', sourceLabel)
    }
    if (step1Script) {
      return buildStep2AiScriptResolution(
        'extract',
        step1Script,
        'step1_script',
        'Step1 全文剧本（各集脚本为空）',
      )
    }
    const fallback = resolveProjectScriptText(data)
    return buildStep2AiScriptResolution('extract', fallback, 'project_fallback', '项目剧本文本')
  }

  if (step1Script) {
    return buildStep2AiScriptResolution('extract', step1Script, 'step1_script', 'Step1 全文剧本')
  }
  const fallback = resolveProjectScriptText(data)
  return buildStep2AiScriptResolution('extract', fallback, 'project_fallback', '项目剧本文本')
}

/** Step2 AI 操作用的剧本文本 */
export function resolveStep2AiScriptText(
  data: Pick<WorkflowProjectData, 'script' | 'episodes'>,
  purpose: Step2AiScriptPurpose = 'extract',
  options?: ResolveStep2AiScriptOptions,
): string {
  return resolveStep2AiScript(data, purpose, options).script
}

/** UI / tooltip：将使用：第 1 集本集脚本 · 3,200 字 */
export function formatStep2AiScriptSourceHint(resolution: Step2AiScriptResolution): string {
  return `将使用：${resolution.sourceLabel} · ${resolution.charCount.toLocaleString('zh-CN')} 字`
}

/** 任务进行中状态文案 */
export function formatStep2AiRunningMessage(
  resolution: Step2AiScriptResolution,
  action: 'extract' | 'split' | 'episode_reextract',
): string {
  if (action === 'episode_reextract') {
    return `正在重提${resolution.sourceLabel}资产…`
  }
  if (action === 'extract') {
    return `正在根据${resolution.sourceLabel}提取资产…`
  }
  return `正在根据${resolution.sourceLabel}分集并同步资产…`
}

/** 重提本集资产：固定使用当前分集 content，不回退 Step1 全文 */
export function resolveEpisodeReextractScript(
  episode: WorkflowEpisode,
): Step2AiScriptResolution | null {
  const script = episode.content?.trim() ?? ''
  if (!script) return null
  return buildStep2AiScriptResolution(
    'extract',
    script,
    'single_episode',
    `第 ${episode.episodeIndex} 集本集脚本`,
  )
}

export function isEpisodeReextractReady(episode: WorkflowEpisode | null | undefined): boolean {
  return Boolean(episode?.content?.trim())
}

/** 重提本集资产按钮 tooltip */
export function formatEpisodeReextractSourceHint(episode: WorkflowEpisode | null | undefined): string {
  if (!episode) return '请先选择分集'
  const resolution = resolveEpisodeReextractScript(episode)
  if (!resolution) return '请先录入本集脚本后再重提本集资产'
  return `${formatStep2AiScriptSourceHint(resolution)}；同名资产将保留，仅同步本集增删`
}

/** @deprecated 使用 resolveStep2AiScriptText(data, 'extract') */
export const resolveAssetExtractScriptText = (
  data: Pick<WorkflowProjectData, 'script' | 'episodes'>,
) => resolveStep2AiScriptText(data, 'extract')

export function hasWorkflowScriptContent(
  data: Pick<WorkflowProjectData, 'script' | 'episodes'> | null | undefined,
  purpose: Step2AiScriptPurpose = 'extract',
): boolean {
  if (!data) return false
  return Boolean(resolveStep2AiScriptText(data, purpose).trim())
}

export { EPISODE_PLAN_LABELS }
export type { WorkflowEpisodePlan }

/** 从磁盘数据推断分集规划模式（兼容无 episodePlan 的旧项目） */
export function inferEpisodePlan(
  data: Pick<WorkflowProjectData, 'episodePlan' | 'script' | 'episodes'> | null | undefined,
): WorkflowEpisodePlan {
  if (!data) return 'bootstrap'

  const stored = data.episodePlan
  if (stored === 'bootstrap' || stored === 'manual' || stored === 'ai_split') {
    return stored
  }

  const episodes = Array.isArray(data.episodes) ? data.episodes : []

  if (episodes.length > 1) {
    if (episodes.some((ep) => ep.contentManuallyEdited)) return 'manual'
    const looksLikeAiSplit =
      episodes.every((ep) => ep.content?.trim()) &&
      episodes.some(
        (ep) =>
          Boolean(ep.assetScope?.trim()) ||
          ep.characters.length > 0 ||
          ep.scenes.length > 0 ||
          ep.items.length > 0,
      )
    if (looksLikeAiSplit) return 'ai_split'
    return 'manual'
  }

  if (hasAiEpisodeSplit({ script: data.script, episodes })) return 'ai_split'
  if (hasManualEpisodeLayout(episodes)) return 'manual'
  return 'bootstrap'
}

export function formatEpisodePlanLabel(
  data: Pick<WorkflowProjectData, 'episodePlan' | 'script' | 'episodes'> | null | undefined,
): string {
  return EPISODE_PLAN_LABELS[inferEpisodePlan(data)]
}

/** manual / ai_split 下禁止 Step1 全文镜像与静默改集数 */
export function isEpisodePlanProtected(
  data: Pick<WorkflowProjectData, 'episodePlan' | 'script' | 'episodes'> | null | undefined,
): boolean {
  const plan = inferEpisodePlan(data)
  return plan === 'manual' || plan === 'ai_split'
}

/** 仅 bootstrap 允许将 Step1 全文镜像到唯一占位集 */
export function canMirrorStep1ScriptToEpisodes(
  data: Pick<WorkflowProjectData, 'episodePlan' | 'script' | 'episodes'> | null | undefined,
): boolean {
  return inferEpisodePlan(data) === 'bootstrap'
}

/** 用户编辑分集正文或结构后应进入 manual */
export function episodePlanAfterUserEdit(
  data: Pick<WorkflowProjectData, 'episodePlan' | 'script' | 'episodes'>,
): WorkflowEpisodePlan | undefined {
  const plan = inferEpisodePlan(data)
  return plan === 'manual' ? undefined : 'manual'
}

export function episodePlanAfterStructureEdit(
  data: Pick<WorkflowProjectData, 'episodePlan' | 'script' | 'episodes'>,
): WorkflowEpisodePlan {
  return 'manual'
}

export interface Step1EpisodeSyncPreview {
  available: boolean
  script: string
  currentContent: string
  scriptCharCount: number
  contentCharCount: number
  changed: boolean
}

/** 是否可手动将 Step1 全文同步到唯一一集（需有全文且与当前 content 不同） */
export function buildStep1EpisodeSyncPreview(
  data: Pick<WorkflowProjectData, 'script' | 'episodes'> | null | undefined,
): Step1EpisodeSyncPreview {
  const empty: Step1EpisodeSyncPreview = {
    available: false,
    script: '',
    currentContent: '',
    scriptCharCount: 0,
    contentCharCount: 0,
    changed: false,
  }
  if (!data) return empty

  const episodes = Array.isArray(data.episodes) ? data.episodes : []
  const script = data.script?.trim() ?? ''
  const currentContent = episodes[0]?.content?.trim() ?? ''
  const available = episodes.length === 1 && Boolean(script)

  return {
    available,
    script,
    currentContent,
    scriptCharCount: script.length,
    contentCharCount: currentContent.length,
    changed: available && script !== currentContent,
  }
}

export function formatStep1EpisodeSyncConfirmDescription(preview: Step1EpisodeSyncPreview): string {
  if (!preview.available) {
    return '当前无法同步：需要单集占位且 Step1 有全文剧本。'
  }
  return [
    `Step1 全文：${preview.scriptCharCount.toLocaleString('zh-CN')} 字`,
    `第 1 集当前：${preview.contentCharCount.toLocaleString('zh-CN')} 字`,
    preview.changed
      ? '同步后将用 Step1 全文覆盖第 1 集本集脚本。'
      : '第 1 集已与 Step1 全文一致，无需同步。',
  ].join('\n')
}

/** 手动同步：将 Step1 全文写入唯一一集 content */
export function applyStep1ScriptToFirstEpisode(
  data: Pick<WorkflowProjectData, 'script' | 'episodes'>,
): WorkflowEpisode[] {
  const preview = buildStep1EpisodeSyncPreview(data)
  if (!preview.available || !preview.changed) {
    return Array.isArray(data.episodes) ? data.episodes : []
  }
  const episodes = data.episodes ?? []
  const [first, ...rest] = episodes
  if (!first) return episodes
  return [{ ...first, content: preview.script, contentManuallyEdited: true }, ...rest]
}

export function ensureDefaultEpisode(episodes: WorkflowEpisode[]): WorkflowEpisode[] {
  if (episodes.length > 0) return episodes
  return [createEmptyEpisode(1)]
}

/** 是否已完成 AI 分集（一键提取资产、仅有实体标签不算） */
export function hasAiEpisodeSplit(
  data: Pick<WorkflowProjectData, 'script' | 'episodes'>,
): boolean {
  const episodes = Array.isArray(data.episodes) ? data.episodes : []
  if (episodes.length > 1) return true

  const only = episodes[0]
  if (!only) return false
  if (only.assetScope?.trim()) return true

  const script = data.script?.trim() ?? ''
  const content = only.content?.trim() ?? ''
  if (!content || !script || content === script) return false

  // 单集且 content 为全文片段（明显短于全文）→ 已 AI 分集；全文修订或仅提取资产标签不算
  if (script.includes(content) && content.length < script.length * 0.9) {
    return true
  }

  return false
}

/** 是否为 Step2 自动占位单集（全文镜像到首集、尚未 AI 分集） */
export function isBootstrapOnlyEpisode(
  episode: WorkflowEpisode,
  fullScript?: string,
): boolean {
  return !hasAiEpisodeSplit({ episodes: [episode], script: fullScript ?? '' })
}

/** 是否已完成分集规划（手动或 AI 分集后视为已规划） */
export function hasWorkflowEpisodePlan(
  data: Pick<WorkflowProjectData, 'episodePlan' | 'script' | 'episodes'> | null | undefined,
): boolean {
  if (!data) return false
  const plan = inferEpisodePlan(data)
  if (plan === 'manual' || plan === 'ai_split') return true
  const episodes = Array.isArray(data.episodes) ? data.episodes : []
  if (episodes.length === 0) return false
  return hasAiEpisodeSplit(data)
}

/** 进入分集步骤时：无分集则创建第 1 集，并将全文剧本写入首集脚本（若有） */
export function bootstrapFirstEpisodeView(
  data: Pick<WorkflowProjectData, 'script' | 'episodes'>,
): WorkflowEpisode[] {
  const episodes = Array.isArray(data.episodes) ? data.episodes : []
  const script = data.script?.trim() ?? ''

  if (episodes.length > 0) return episodes

  const first = createEmptyEpisode(1)
  if (script) first.content = script
  return [first]
}

/** 未 AI 分集时：将 Step1 全文镜像到唯一一集的 content；manual / ai_split 不再覆盖 */
export function syncScriptToPlaceholderEpisode(
  data: Pick<WorkflowProjectData, 'episodePlan' | 'script' | 'episodes'>,
): WorkflowEpisode[] {
  const episodes = Array.isArray(data.episodes) ? data.episodes : []
  if (!canMirrorStep1ScriptToEpisodes(data)) return episodes

  const script = data.script?.trim() ?? ''
  if (episodes.length !== 1 || !script) return episodes

  const [first, ...rest] = episodes
  if (first.contentManuallyEdited) return episodes

  const content = first.content?.trim() ?? ''
  if (content === script) return episodes

  return [{ ...first, content: script }, ...rest]
}

/** 用户已手动规划分集（多集或任一集 content 手改过）→ 不再自动镜像 Step1 全文 */
export function hasManualEpisodeLayout(episodes: WorkflowEpisode[]): boolean {
  if (episodes.length > 1) return true
  return episodes.some((ep) => ep.contentManuallyEdited)
}

/** 进入 Step2：补首集占位 + bootstrap 时同步全文到首集脚本 */
export function ensureEpisodesWithScriptPreview(
  data: Pick<WorkflowProjectData, 'episodePlan' | 'script' | 'episodes'>,
): WorkflowEpisode[] {
  const bootstrapped = bootstrapFirstEpisodeView(data)
  if (!canMirrorStep1ScriptToEpisodes({ ...data, episodes: bootstrapped })) {
    return bootstrapped
  }
  return syncScriptToPlaceholderEpisode({ ...data, episodes: bootstrapped })
}

/** 加载/保存前：保证至少一集，并将无归属分镜挂到默认分集 */
export function normalizeWorkflowEpisodes(data: WorkflowProjectData): WorkflowProjectData {
  const episodePlan = inferEpisodePlan(data)
  let episodes = ensureDefaultEpisode(Array.isArray(data.episodes) ? data.episodes : [])
  if (canMirrorStep1ScriptToEpisodes({ ...data, episodePlan, episodes })) {
    episodes = syncScriptToPlaceholderEpisode({ ...data, episodePlan, episodes })
  }
  const defaultEpisode = episodes[0]
  if (!defaultEpisode) {
    const planPatch = data.episodePlan === episodePlan ? {} : { episodePlan }
    return Object.keys(planPatch).length > 0 ? { ...data, episodePlan } : data
  }

  const episodeIds = new Set(episodes.map((ep) => ep.id))
  let shots = data.shots ?? []
  const needsShotBind = shots.some((shot) => !shot.episodeId || !episodeIds.has(shot.episodeId))
  if (needsShotBind) {
    shots = shots.map((shot) => {
      if (shot.episodeId && episodeIds.has(shot.episodeId)) return shot
      return {
        ...shot,
        episodeId: defaultEpisode.id,
        episodeIndex: defaultEpisode.episodeIndex,
      }
    })
  }

  const planPatch = data.episodePlan === episodePlan ? {} : { episodePlan }
  if (shots === data.shots && episodes === data.episodes && !planPatch.episodePlan) {
    return data
  }
  return { ...data, episodes, ...planPatch, ...(shots === data.shots ? {} : { shots }) }
}

export function createEmptyEpisode(index: number): WorkflowEpisode {
  return {
    id: `ep_${generateUUID()}`,
    episodeIndex: index,
    title: `第 ${index} 集`,
    summary: '',
    content: '',
    assetScope: '',
    characters: [],
    scenes: [],
    items: [],
  }
}

function normalizeEpisodeLabel(text: string): string {
  return text.trim().replace(/\s+/g, '').toLowerCase()
}

/** title 是否与集号标签语义重复（如「第1集」「第 1 集」「全文」） */
export function isDefaultEpisodeTitle(title: string, episodeIndex: number): boolean {
  const normalized = normalizeEpisodeLabel(title)
  if (!normalized) return true
  if (normalized === '全文') return true
  const variants = [
    `第${episodeIndex}集`,
    `第${episodeIndex}话`,
    `ep${episodeIndex}`,
    `episode${episodeIndex}`,
  ]
  return variants.includes(normalized)
}

/** 分集展示名：集号 + 非重复副标题（避免「第1集 · 第1集」） */
export function formatEpisodeDisplayLabel(
  episode: Pick<WorkflowEpisode, 'episodeIndex' | 'title'>,
): string {
  const indexLabel = `第${episode.episodeIndex}集`
  const title = episode.title?.trim()
  if (!title || isDefaultEpisodeTitle(title, episode.episodeIndex)) {
    return indexLabel
  }
  return `${indexLabel} · ${title}`
}

export function reindexEpisodes(episodes: WorkflowEpisode[]): WorkflowEpisode[] {
  return episodes.map((ep, idx) => ({
    ...ep,
    episodeIndex: idx + 1,
    title: ep.title.trim() || `第 ${idx + 1} 集`,
  }))
}

export function updateEpisode(
  episodes: WorkflowEpisode[],
  episodeId: string,
  patch: Partial<WorkflowEpisode>,
): WorkflowEpisode[] {
  return episodes.map((ep) => (ep.id === episodeId ? { ...ep, ...patch } : ep))
}

export function removeEpisode(episodes: WorkflowEpisode[], episodeId: string): WorkflowEpisode[] {
  return reindexEpisodes(episodes.filter((ep) => ep.id !== episodeId))
}

export function collectEpisodeEntities(episode: WorkflowEpisode | null) {
  if (!episode) {
    return { characters: [], scenes: [], items: [] }
  }
  return {
    characters: episode.characters,
    scenes: episode.scenes,
    items: episode.items,
  }
}

export function isValidEpisodeId(
  episodes: WorkflowEpisode[],
  episodeId?: string | null,
): episodeId is string {
  return Boolean(episodeId && episodes.some((ep) => ep.id === episodeId))
}

/** 解析当前应展示的分集 id，无效时回退第一集 */
export function resolveActiveEpisodeId(
  episodes: WorkflowEpisode[],
  activeEpisodeId?: string | null,
): string | null {
  if (isValidEpisodeId(episodes, activeEpisodeId)) return activeEpisodeId
  return episodes[0]?.id ?? null
}

export function resolveActiveEpisode(
  episodes: WorkflowEpisode[],
  activeEpisodeId?: string | null,
): WorkflowEpisode | null {
  const id = resolveActiveEpisodeId(episodes, activeEpisodeId)
  if (!id) return null
  return episodes.find((ep) => ep.id === id) ?? null
}
