import type { CanvasMediaOwnerKind } from '@/types/canvas-nodes'
import type { AssetKind, WorkflowAsset } from '@/types/workflow'
import { collectAssetPreviewPaths } from '@/lib/workflow/asset-utils'
import { resolveVoiceLabel, type VoiceLibraryEntry } from '@/types/voice-library'

export type MentionEntityType = AssetKind | 'voice' | 'image'

export interface MentionCandidate {
  id: string
  name: string
  mentionName: string
  kind: MentionEntityType
  description: string
  thumbnailPath?: string
  /** 全部可预览图片路径，悬停时依次尝试 */
  previewPaths?: string[]
  /** 是否已同步到素材库 */
  syncedToLibrary?: boolean
  /** 角色绑定的本地音色（local:voice_xxx） */
  voiceType?: string
  /** 音色库显示名（如「爷爷音色」） */
  voiceLabel?: string
  /** 无限画布来源节点 ID */
  canvasNodeId?: string
  canvasOwnerKind?: CanvasMediaOwnerKind
  canvasOwnerProjectId?: string
}

const KIND_LABEL: Record<MentionEntityType, string> = {
  character: '角色',
  scene: '场景',
  prop: '物品',
  voice: '音色',
  image: '图片',
}

export function mentionKindLabel(kind: MentionEntityType): string {
  return KIND_LABEL[kind]
}

export function mentionKindClass(kind: MentionEntityType | 'unknown'): string {
  if (kind === 'character') {
    return 'bg-violet-500/15 text-violet-700 dark:bg-violet-500/25 dark:text-violet-200'
  }
  if (kind === 'scene') {
    return 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-200'
  }
  if (kind === 'prop') {
    return 'bg-amber-500/15 text-amber-800 dark:bg-amber-500/25 dark:text-amber-200'
  }
  if (kind === 'voice') {
    return 'bg-cyan-500/15 text-cyan-700 dark:bg-cyan-500/25 dark:text-cyan-200'
  }
  if (kind === 'image') {
    return 'bg-sky-500/15 text-sky-700 dark:bg-sky-500/25 dark:text-sky-200'
  }
  return 'bg-cyan-500/15 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200'
}

/** 分镜提示词内 @ 引用：仅文字色区分，无背景块 */
export function mentionKindTextClass(kind: MentionEntityType | 'unknown'): string {
  if (kind === 'character') return 'text-violet-500 dark:text-violet-300'
  if (kind === 'scene') return 'text-emerald-600 dark:text-emerald-300'
  if (kind === 'prop') return 'text-amber-600 dark:text-amber-300'
  if (kind === 'voice') return 'text-cyan-600 dark:text-cyan-300'
  if (kind === 'image') return 'text-sky-600 dark:text-sky-300'
  return 'text-cyan-600 dark:text-cyan-300'
}

/** 将全角 @ 等变体规范为半角，便于推理结果与手动输入一致识别 */
export function normalizeMentionSource(text: string): string {
  return text.replace(/\uFF20/g, '@')
}

export interface MentionSpan {
  start: number
  end: number
  name: string
  candidate: MentionCandidate | null
}

/** @ 引用名主体字符 */
const MENTION_NAME_CHARS = /^[\u4e00-\u9fffA-Za-z0-9_·-]+/

/** 名称后常见叙述字：@旧铜铃在… 只高亮「旧铜铃」 */
const MENTION_NAME_STOP = new Set(
  '在的与和及占穿坐站向从把被让将对于而但了着蹲躺靠贴邻近旁侧中里对跟为以到由自上下前后内外手持眼用向朝望看听言说'.split(
    '',
  ),
)

function trimMentionNameTail(raw: string): string {
  let end = raw.length
  for (let j = 0; j < raw.length; j++) {
    if (MENTION_NAME_STOP.has(raw[j]!)) {
      end = j
      break
    }
  }
  const name = raw.slice(0, end)
  return name.length > 16 ? name.slice(0, 16) : name
}

function sortedMentionNames(candidates: MentionCandidate[]): string[] {
  const names = new Set<string>()
  for (const candidate of candidates) {
    if (candidate.mentionName) names.add(candidate.mentionName)
    if (candidate.name) names.add(candidate.name)
  }
  return [...names].sort((a, b) => b.length - a.length)
}

function matchMentionAt(
  source: string,
  atIndex: number,
  candidates: MentionCandidate[],
): { candidate: MentionCandidate; matchedName: string } | null {
  const afterAt = source.slice(atIndex + 1)
  for (const name of sortedMentionNames(candidates)) {
    if (!afterAt.startsWith(name)) continue
    const candidate = lookupMentionCandidate(name, candidates)
    if (candidate) return { candidate, matchedName: name }
  }
  return null
}

function matchUnknownMentionAt(source: string, atIndex: number): string | null {
  const afterAt = source.slice(atIndex + 1)
  const matched = afterAt.match(MENTION_NAME_CHARS)
  if (!matched?.[0]) return null
  const name = trimMentionNameTail(matched[0])
  return name.length > 0 ? name : null
}

/** 按已知资产名精确匹配 @ 引用（最长优先）；未匹配到的 @xxx 仍保留为未知引用 */
export function parseMentionSpans(text: string, candidates: MentionCandidate[]): MentionSpan[] {
  const source = normalizeMentionSource(text)

  const spans: MentionSpan[] = []
  let i = 0
  while (i < source.length) {
    if (source[i] !== '@') {
      i += 1
      continue
    }
    const hit = candidates.length ? matchMentionAt(source, i, candidates) : null
    if (hit) {
      spans.push({
        start: i,
        end: i + 1 + hit.matchedName.length,
        name: hit.matchedName,
        candidate: hit.candidate,
      })
      i += 1 + hit.matchedName.length
      continue
    }
    const unknownName = matchUnknownMentionAt(source, i)
    if (unknownName) {
      const candidate =
        candidates.length > 0 ? lookupMentionCandidate(unknownName, candidates) : null
      spans.push({
        start: i,
        end: i + 1 + unknownName.length,
        name: unknownName,
        candidate,
      })
      i += 1 + unknownName.length
      continue
    }
    i += 1
  }
  return spans
}

export function hasAnyMentionSyntax(text: string): boolean {
  return /[@\uFF20][^\s@，。；：、[\]（）(){}「」『』""''\n]/.test(normalizeMentionSource(text))
}

export function containsMentionTokens(text: string, candidates: MentionCandidate[]): boolean {
  return parseMentionSpans(text, candidates).length > 0
}

export function buildMentionCandidates(
  assets: {
    characters: WorkflowAsset[]
    scenes: WorkflowAsset[]
    props: WorkflowAsset[]
  },
  voiceLibrary: VoiceLibraryEntry[] = [],
): MentionCandidate[] {
  const mapOne = (asset: WorkflowAsset, kind: MentionEntityType): MentionCandidate => {
    const previewPaths = collectAssetPreviewPaths(asset)
    const voiceType = kind === 'character' ? asset.voiceType : undefined
    const voiceLabel =
      voiceType && voiceLibrary.length
        ? resolveVoiceLabel(voiceType, voiceLibrary) || undefined
        : voiceType
          ? '已绑定音色'
          : undefined
    return {
      id: asset.id,
      name: asset.name.trim() || '未命名',
      mentionName: asset.name.trim() || '未命名',
      kind,
      description: asset.description || asset.prompt || '',
      previewPaths,
      thumbnailPath: previewPaths[0],
      voiceType,
      voiceLabel,
    }
  }

  return [
    ...assets.characters.map((a) => mapOne(a, 'character')),
    ...assets.scenes.map((a) => mapOne(a, 'scene')),
    ...assets.props.map((a) => mapOne(a, 'prop')),
  ].filter((c) => c.mentionName)
}

/** 标记已同步到素材库的 @ 候选资产 */
export function markMentionCandidatesSynced(
  candidates: MentionCandidate[],
  syncedAssetIds: ReadonlySet<string>,
): MentionCandidate[] {
  if (!syncedAssetIds.size) return candidates
  return candidates.map((candidate) =>
    syncedAssetIds.has(candidate.id) ? { ...candidate, syncedToLibrary: true } : candidate,
  )
}

export function parseMentionNames(text: string, candidates: MentionCandidate[]): string[] {
  return parseMentionSpans(text, candidates).map((span) => span.name)
}

export function lookupMentionCandidate(
  name: string,
  candidates: MentionCandidate[],
): MentionCandidate | null {
  const key = name.trim()
  if (!key) return null
  const lower = key.toLowerCase()
  for (const candidate of candidates) {
    if (candidate.mentionName === key || candidate.name === key) return candidate
  }
  for (const candidate of candidates) {
    if (
      candidate.mentionName.toLowerCase() === lower ||
      candidate.name.toLowerCase() === lower
    ) {
      return candidate
    }
  }
  return null
}

export function resolveMentionsInText(
  text: string,
  candidates: MentionCandidate[],
): MentionCandidate[] {
  const seen = new Set<string>()
  const resolved: MentionCandidate[] = []
  for (const span of parseMentionSpans(text, candidates)) {
    if (!span.candidate) continue
    if (seen.has(span.candidate.id)) continue
    seen.add(span.candidate.id)
    resolved.push(span.candidate)
  }
  return resolved
}

export function splitResolvedMentions(
  text: string,
  candidates: MentionCandidate[],
): { characters: MentionCandidate[]; references: MentionCandidate[] } {
  const resolved = resolveMentionsInText(text, candidates)
  const seen = new Set<string>()
  const characters: MentionCandidate[] = []
  const references: MentionCandidate[] = []
  for (const item of resolved) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    if (item.kind === 'character') characters.push(item)
    else references.push(item)
  }
  return { characters, references }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 扫描正文中的资产名并补记 @ 引用（对齐上游实现 参考二次识别） */
export function applySecondaryMentionRecognition(
  text: string,
  candidates: MentionCandidate[],
): { text: string; inserted: string[] } {
  let result = text
  const inserted: string[] = []
  const sorted = [...candidates].sort((a, b) => b.mentionName.length - a.mentionName.length)

  for (const candidate of sorted) {
    const labels = Array.from(
      new Set(
        [candidate.mentionName, candidate.name]
          .map((item) => item?.trim())
          .filter(Boolean) as string[],
      ),
    ).sort((a, b) => b.length - a.length)

    for (const label of labels) {
      const re = new RegExp(`(?<!@)${escapeRegExp(label)}`, 'gi')
      let hit = false
      result = result.replace(re, () => {
        hit = true
        return `@${candidate.mentionName}`
      })
      if (hit && !inserted.includes(candidate.mentionName)) {
        inserted.push(candidate.mentionName)
      }
    }
  }

  return { text: result, inserted }
}

export function filterMentionCandidates(
  candidates: MentionCandidate[],
  query: string,
): MentionCandidate[] {
  const q = query.trim().toLowerCase()
  if (!q) return candidates
  return candidates.filter(
    (c) =>
      c.mentionName.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q),
  )
}

export function insertMentionAt(
  text: string,
  cursor: number,
  atStart: number,
  mentionName: string,
): { value: string; cursor: number } {
  const before = text.slice(0, atStart)
  const after = text.slice(cursor)
  const insert = `@${mentionName} `
  const value = before + insert + after
  return { value, cursor: before.length + insert.length }
}

/** 生图时补充 @ 引用资产的描述，提升一致性 */
export function enrichPromptWithMentions(
  prompt: string,
  candidates: MentionCandidate[],
): string {
  const resolved = resolveMentionsInText(prompt, candidates)
  if (!resolved.length) return prompt
  const lines = resolved.map(
    (c) => `- @${c.mentionName}（${mentionKindLabel(c.kind)}）：${c.description || '暂无描述'}`,
  )
  return `${prompt.trim()}\n\n【引用资产】\n${lines.join('\n')}`
}

/** 从 @ 引用解析每个资产的主预览图（角色卡/场景图优先） */
export function collectMentionReferenceImagePaths(
  text: string,
  candidates: MentionCandidate[],
): string[] {
  const paths: string[] = []
  const seen = new Set<string>()
  for (const mention of resolveMentionsInText(text, candidates)) {
    const path = (mention.thumbnailPath || mention.previewPaths?.[0])?.trim()
    if (!path || seen.has(path)) continue
    seen.add(path)
    paths.push(path)
  }
  return paths
}

/** 根据提示词 @ 同步参考内容资产 ID 列表（增删 @ 时实时更新） */
export function syncReferencedAssetIdsFromMentions(
  text: string,
  candidates: MentionCandidate[],
): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const span of parseMentionSpans(text, candidates)) {
    if (!span.candidate || seen.has(span.candidate.id)) continue
    seen.add(span.candidate.id)
    ids.push(span.candidate.id)
  }
  return ids
}

export function resolveMentionCandidatesByIds(
  assetIds: string[],
  candidates: MentionCandidate[],
): MentionCandidate[] {
  if (!assetIds.length) return []
  const byId = new Map(candidates.map((item) => [item.id, item]))
  const resolved: MentionCandidate[] = []
  const seen = new Set<string>()
  for (const id of assetIds) {
    const item = byId.get(id)
    if (!item || seen.has(id)) continue
    seen.add(id)
    resolved.push(item)
  }
  return resolved
}

/** 从分镜已绑定的参考内容资产收集生图用预览图路径 */
export function collectReferencedAssetImagePaths(
  referencedAssetIds: string[],
  candidates: MentionCandidate[],
): string[] {
  const paths: string[] = []
  const seen = new Set<string>()
  for (const item of resolveMentionCandidatesByIds(referencedAssetIds, candidates)) {
    const path = (item.thumbnailPath || item.previewPaths?.[0])?.trim()
    if (!path || seen.has(path)) continue
    seen.add(path)
    paths.push(path)
  }
  return paths
}
