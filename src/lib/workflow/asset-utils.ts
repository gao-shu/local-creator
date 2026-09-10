import type { AppSettings, PromptTemplate } from '@/types/settings'
import { EXTRACT_TEMPLATE_LITE_KEY, EXTRACT_TEMPLATE_V2_KEY } from '@/constants/asset-extract'
import type {
  AssetKind,
  AssetListKey,
  EpisodeEntity,
  WorkflowAsset,
  WorkflowEpisode,
  WorkflowProjectData,
  WorkflowShot,
} from '@/types/workflow'
import { generateUUID } from '@/lib/utils'
import { applyPromptAffix } from '@/lib/workflow/prompt-affix-utils'
import { normalizeLayoutKey } from '@/lib/workflow/layout-presets'
import { DEFAULT_CHARACTER_STYLE_KEY } from '@/lib/workflow/style-presets'
import { normalizeLocalVoiceType } from '@/types/voice-library'
import {
  isAbsoluteMediaPath,
  isProjectRelativeMediaPath,
  normalizeStoredMediaPath,
} from '@/lib/storage/media-path-resolver'
export const ASSET_LIST_KEY: Record<AssetKind, AssetListKey> = {
  character: 'characters',
  scene: 'scenes',
  prop: 'props',
}

export const ASSET_KIND_LABEL: Record<AssetKind, string> = {
  character: '人物',
  scene: '场景',
  prop: '物品',
}

export function resolveAssetDisplayLabel(
  asset: Pick<WorkflowAsset, 'name' | 'kind'>,
): string {
  return asset.name?.trim() || ASSET_KIND_LABEL[asset.kind]
}

export const ASSET_IMAGE_GENERATED_LABEL = '资产图已生成'
export const ASSET_IMAGE_FAILED_LABEL = '资产图生成失败'

function withGenerationToastErrorDetail(base: string, errorMessage?: string): string {
  const detail = errorMessage?.trim()
  if (!detail || detail === base || base.endsWith(`：${detail}`)) return base
  return `${base}（${detail}）`
}

/** 单张资产图生成成功 toast / 任务文案 */
export function formatAssetImageGeneratedToast(
  asset: Pick<WorkflowAsset, 'name' | 'kind'>,
): string {
  return `${resolveAssetDisplayLabel(asset)}：${ASSET_IMAGE_GENERATED_LABEL}`
}

/** 单张资产图生成失败 toast / 任务文案 */
export function formatAssetImageFailedToast(
  asset: Pick<WorkflowAsset, 'name' | 'kind'>,
  errorMessage?: string,
): string {
  const base = `${resolveAssetDisplayLabel(asset)}：${ASSET_IMAGE_FAILED_LABEL}`
  return withGenerationToastErrorDetail(base, errorMessage)
}

/** 批量生图 toast：列出资产名称，过多时截断 */
export function formatAssetNameList(
  assets: Array<Pick<WorkflowAsset, 'name' | 'kind'>>,
  maxNames = 4,
): string {
  if (!assets.length) return ''
  const labels = assets.map(resolveAssetDisplayLabel)
  if (labels.length === 1) return labels[0]!
  if (labels.length <= maxNames) return labels.join('、')
  return `${labels.slice(0, maxNames).join('、')} 等 ${labels.length} 个`
}

export function formatBatchAssetImageToast(
  successAssets: Array<Pick<WorkflowAsset, 'name' | 'kind'>>,
  failedAssets: Array<Pick<WorkflowAsset, 'name' | 'kind'>>,
): string {
  const prefix = '批量生成资产图完成'
  if (failedAssets.length === 0) {
    return `${prefix}：${formatAssetNameList(successAssets)}`
  }
  if (successAssets.length > 0) {
    return `${prefix}：成功 ${formatAssetNameList(successAssets)}，失败 ${formatAssetNameList(failedAssets)}`
  }
  return `批量生成资产图失败：${formatAssetNameList(failedAssets)}`
}

const ASSET_DESCRIPTION_FIELD: Record<AssetKind, string> = {
  character: '角色描述',
  scene: '场景描述',
  prop: '物品描述',
}

/** 资产正文描述（优先 description，兼容旧数据 prompt） */
export function resolveAssetDescription(
  asset: Pick<WorkflowAsset, 'description' | 'prompt'>,
): string {
  return asset.description.trim() || asset.prompt.trim()
}

export function assetDescriptionRequiredMessage(kind: AssetKind): string {
  return `请先填写${ASSET_DESCRIPTION_FIELD[kind]}`
}

export function validateAssetDescription(
  asset: Pick<WorkflowAsset, 'kind' | 'description' | 'prompt'>,
): string | null {
  if (resolveAssetDescription(asset)) return null
  return assetDescriptionRequiredMessage(asset.kind)
}

export const MAX_REFERENCE_IMAGES = 10

export function getReferenceImagePaths(
  asset: Pick<WorkflowAsset | WorkflowShot, 'referenceImagePaths' | 'referenceImagePath'>,
): string[] {
  if (asset.referenceImagePaths?.length) return asset.referenceImagePaths
  if (asset.referenceImagePath) return [asset.referenceImagePath]
  return []
}

export function getSelectedReferenceImageIndex(
  asset: Pick<WorkflowAsset, 'selectedReferenceImageIndex'>,
  refCount: number,
): number {
  if (refCount <= 0) return 0
  const idx = asset.selectedReferenceImageIndex ?? 0
  return Math.min(Math.max(0, idx), refCount - 1)
}

/** 生图时使用的单张参考图（画廊当前选中项） */
export function getSelectedReferenceImagePath(asset: WorkflowAsset): string | undefined {
  const refs = getReferenceImagePaths(asset)
  if (!refs.length) return undefined
  return refs[getSelectedReferenceImageIndex(asset, refs.length)]
}

export function getGeneratedImagePaths(
  asset: Pick<WorkflowAsset, 'generatedImagePaths' | 'generatedImagePath'>,
): string[] {
  if (asset.generatedImagePaths?.length) return asset.generatedImagePaths
  if (asset.generatedImagePath) return [asset.generatedImagePath]
  return []
}

/** 清理卡住的「生成中」资产（无活跃任务 / inflight 会话时） */
export function resetStuckGeneratingAssets(
  data: WorkflowProjectData,
  preserveAssetIds: Set<string> = new Set(),
): WorkflowProjectData {
  const resetList = (assets: WorkflowAsset[]) => {
    let changed = false
    const next = assets.map((asset) => {
      if (asset.status !== 'generating' || preserveAssetIds.has(asset.id)) return asset
      changed = true
      const hasImage = getGeneratedImagePaths(asset).length > 0
      return { ...asset, status: hasImage ? ('done' as const) : ('failed' as const) }
    })
    return changed ? next : assets
  }

  const characters = resetList(data.characters ?? [])
  const scenes = resetList(data.scenes ?? [])
  const props = resetList(data.props ?? [])
  if (characters === data.characters && scenes === data.scenes && props === data.props) {
    return data
  }
  return { ...data, characters, scenes, props }
}

export function findWorkflowAssetById(
  data: WorkflowProjectData,
  assetId: string,
): WorkflowAsset | undefined {
  return [...(data.characters ?? []), ...(data.scenes ?? []), ...(data.props ?? [])].find(
    (asset) => asset.id === assetId,
  )
}

export function getPrimaryGeneratedIndex(
  asset: Pick<WorkflowAsset, 'primaryGeneratedImageIndex'>,
  genCount: number,
): number {
  if (genCount <= 0) return 0
  const idx = asset.primaryGeneratedImageIndex ?? 0
  return Math.min(Math.max(0, idx), genCount - 1)
}

export function getPrimaryGeneratedImagePath(asset: WorkflowAsset): string | undefined {
  const gens = getGeneratedImagePaths(asset)
  if (!gens.length) return undefined
  return gens[getPrimaryGeneratedIndex(asset, gens.length)]
}

/** 同步审核时使用的本地图片：优先生成主图，否则参考图 */
export function pickAssetReviewImagePath(asset: WorkflowAsset): string | undefined {
  return (
    getPrimaryGeneratedImagePath(asset) ||
    getSelectedReferenceImagePath(asset) ||
    getReferenceImagePaths(asset)[0]
  )
}

export function normalizeAssetMediaPath(path?: string): string {
  return normalizeStoredMediaPath(String(path || '').trim())
}

export function isSameAssetMediaPath(a?: string, b?: string): boolean {
  const left = normalizeAssetMediaPath(a)
  const right = normalizeAssetMediaPath(b)
  if (!left || !right) return false
  if (left === right) return true

  const leftNorm = left.replace(/\\/g, '/')
  const rightNorm = right.replace(/\\/g, '/')
  for (const [abs, rel] of [
    [leftNorm, rightNorm],
    [rightNorm, leftNorm],
  ] as const) {
    if (isAbsoluteMediaPath(abs) && isProjectRelativeMediaPath(rel)) {
      if (abs.toLowerCase().endsWith(`/${rel.toLowerCase()}`)) return true
    }
  }
  return false
}

export function hasAssetReviewSynced(
  asset: Pick<WorkflowAsset, 'jimengAssetId'>,
): boolean {
  return Boolean(asset.jimengAssetId?.trim())
}

export function clearAssetReviewPatch(): Pick<
  WorkflowAsset,
  'jimengAssetId' | 'jimengAssetStatus' | 'reviewImagePath'
> {
  return {
    jimengAssetId: undefined,
    jimengAssetStatus: undefined,
    reviewImagePath: undefined,
  }
}

/** 当前预览/主图与审核绑定图不一致时清除审核 */
export function shouldClearReviewForImageChange(
  asset: WorkflowAsset,
  nextImagePath?: string,
): boolean {
  if (!hasAssetReviewSynced(asset)) return false
  const next = normalizeAssetMediaPath(nextImagePath)
  if (!next) return false

  const reviewed = normalizeAssetMediaPath(asset.reviewImagePath)
  if (reviewed) {
    return !isSameAssetMediaPath(reviewed, next)
  }

  // 有审核 id 但未写 reviewImagePath：与当前主图不一致则清除
  const currentPrimary = pickAssetReviewImagePath(asset)
  return !isSameAssetMediaPath(currentPrimary, next)
}

export function isAssetReviewValidForImage(
  asset: WorkflowAsset,
  imagePath?: string,
): boolean {
  if (!hasAssetReviewSynced(asset)) return false
  const target = normalizeAssetMediaPath(imagePath)
  if (!target) return false

  const reviewed = normalizeAssetMediaPath(asset.reviewImagePath)
  if (!reviewed) return false

  return isSameAssetMediaPath(reviewed, target)
}

export function adjustPrimaryAfterRemove(
  currentPrimary: number,
  removedIndex: number,
  newLen: number,
): number {
  if (newLen <= 0) return 0
  if (removedIndex < currentPrimary) return currentPrimary - 1
  if (removedIndex === currentPrimary) return Math.min(currentPrimary, newLen - 1)
  return Math.min(currentPrimary, newLen - 1)
}

export function buildImageFieldsFromPaths(
  refs: string[],
  gens: string[],
  primaryGeneratedIndex = 0,
): Pick<
  WorkflowAsset,
  | 'referenceImagePath'
  | 'referenceImagePaths'
  | 'generatedImagePath'
  | 'generatedImagePaths'
  | 'primaryGeneratedImageIndex'
> {
  const primaryIdx = gens.length
    ? Math.min(Math.max(0, primaryGeneratedIndex), gens.length - 1)
    : undefined
  return {
    referenceImagePaths: refs.length ? refs : undefined,
    referenceImagePath: refs[0],
    generatedImagePaths: gens.length ? gens : undefined,
    generatedImagePath: gens.length ? gens[primaryIdx ?? 0] : undefined,
    primaryGeneratedImageIndex: primaryIdx,
  }
}

export function normalizeAsset(raw: unknown, kind: AssetKind): WorkflowAsset | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const name = String(row.name || '').trim()
  if (!name) return null

  const refPaths = Array.isArray(row.referenceImagePaths)
    ? row.referenceImagePaths.map((p) => String(p)).filter(Boolean)
    : row.referenceImagePath
      ? [String(row.referenceImagePath)]
      : []
  const genPaths = Array.isArray(row.generatedImagePaths)
    ? row.generatedImagePaths.map((p) => String(p)).filter(Boolean)
    : row.generatedImagePath
      ? [String(row.generatedImagePath)]
      : []

  const reviewFields = pickAssetReviewFields(row)

  return {
    id: String(row.id || `asset_${generateUUID()}`),
    kind,
    name,
    description: String(row.description || '').trim(),
    prompt: String(row.prompt || row.description || '').trim(),
    layoutKey: normalizeLayoutKey(
      row.layoutKey ? String(row.layoutKey) : undefined,
      kind,
    ),
    styleKey: (() => {
      const raw = row.styleKey ? String(row.styleKey).trim() : ''
      // 保留自定义 key；未知系统 key 也原样保留，生图时再回退写实
      if (raw) return raw
      return DEFAULT_CHARACTER_STYLE_KEY
    })(),
    ...buildImageFieldsFromPaths(
      refPaths,
      genPaths,
      typeof row.primaryGeneratedImageIndex === 'number' ? row.primaryGeneratedImageIndex : 0,
    ),
    episodeIndex: typeof row.episodeIndex === 'number' ? row.episodeIndex : undefined,
    episodeIndexes: Array.isArray(row.episodeIndexes)
      ? row.episodeIndexes.filter((n): n is number => typeof n === 'number')
      : typeof row.episodeIndex === 'number'
        ? [row.episodeIndex]
        : undefined,
    selectedReferenceImageIndex:
      typeof row.selectedReferenceImageIndex === 'number'
        ? row.selectedReferenceImageIndex
        : undefined,
    ...reviewFields,
    reviewImagePath: pickStringField(row, ['reviewImagePath', 'review_image_path']),
    voiceType: normalizeLocalVoiceType(pickStringField(row, ['voiceType', 'voice_type'])),
    status: (row.status as WorkflowAsset['status']) || 'draft',
    updatedAt: Number(row.updatedAt) || Date.now(),
  }
}

function pickStringField(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key]
    if (value == null || value === '') continue
    const text = String(value).trim()
    if (text) return text
  }
  return undefined
}

function normalizeReviewStatus(raw?: string): string | undefined {
  const status = String(raw || '')
    .trim()
    .toLowerCase()
  if (!status) return undefined
  if (status === 'ready') return 'active'
  return status
}

/** 兼容多种审核字段命名，读写统一为 camelCase（仅保留即梦遗留字段） */
export function pickAssetReviewFields(
  row: Record<string, unknown>,
): Pick<WorkflowAsset, 'jimengAssetId' | 'jimengAssetStatus'> {
  const jimengAssetId = pickStringField(row, [
    'jimengAssetId',
    'assetJimengId',
    'jimeng_asset_id',
    'remoteAssetId',
    'assetId',
  ])
  const jimengAssetStatus =
    normalizeReviewStatus(
      pickStringField(row, ['jimengAssetStatus', 'jimeng_asset_status']),
    ) ||
    (jimengAssetId
      ? normalizeReviewStatus(pickStringField(row, ['assetStatus', 'asset_status', 'status']))
      : undefined)

  return {
    jimengAssetId,
    jimengAssetStatus,
  }
}

export function getAssetPreviewPath(asset: WorkflowAsset): string | undefined {
  return collectAssetPreviewPaths(asset)[0]
}

/** 收集资产全部可用预览路径（主生成图优先，再其余生成图与参考图） */
export function collectAssetPreviewPaths(asset: WorkflowAsset): string[] {
  const paths: string[] = []
  const seen = new Set<string>()
  const push = (value?: string) => {
    const trimmed = value?.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    paths.push(trimmed)
  }

  push(getPrimaryGeneratedImagePath(asset))
  for (const path of getGeneratedImagePaths(asset)) push(path)
  for (const path of getReferenceImagePaths(asset)) push(path)
  return paths
}

export function normalizeAssetList(raw: unknown, kind: AssetKind): WorkflowAsset[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => normalizeAsset(item, kind))
    .filter((item): item is WorkflowAsset => item != null)
}

export function normalizeWorkflowProjectAssets(
  data: Pick<WorkflowProjectData, 'characters' | 'scenes' | 'props'>,
): Pick<WorkflowProjectData, 'characters' | 'scenes' | 'props'> {
  return {
    characters: normalizeAssetList(data.characters, 'character'),
    scenes: normalizeAssetList(data.scenes, 'scene'),
    props: normalizeAssetList(data.props, 'prop'),
  }
}

export function createEmptyAsset(kind: AssetKind, name = '新资产'): WorkflowAsset {
  return {
    id: `asset_${generateUUID()}`,
    kind,
    name,
    description: '',
    prompt: '',
    status: 'draft',
    updatedAt: Date.now(),
    styleKey: DEFAULT_CHARACTER_STYLE_KEY,
  }
}

export function updateAssetList(
  assets: WorkflowAsset[],
  assetId: string,
  patch: Partial<WorkflowAsset>,
): WorkflowAsset[] {
  return assets.map((asset) =>
    asset.id === assetId ? { ...asset, ...patch, updatedAt: Date.now() } : asset,
  )
}

/** 在完整项目数据上按 id 增量更新单条资产（供异步任务从 store 最新快照合并） */
export function patchWorkflowAssetInData(
  data: WorkflowProjectData,
  kind: AssetKind,
  assetId: string,
  patch: Partial<WorkflowAsset>,
): WorkflowProjectData {
  const listKey = ASSET_LIST_KEY[kind]
  const nextList = updateAssetList(data[listKey], assetId, patch)
  const nextData = { ...data, [listKey]: nextList }
  return data.episodes.length > 0 ? syncProjectAssetEpisodeLinks(nextData) : nextData
}

export function findWorkflowAsset(
  data: WorkflowProjectData,
  kind: AssetKind,
  assetId: string,
): WorkflowAsset | undefined {
  return data[ASSET_LIST_KEY[kind]].find((asset) => asset.id === assetId)
}

const ASSET_IMAGE_PERSIST_KEYS = [
  'primaryGeneratedImageIndex',
  'generatedImagePath',
  'generatedImagePaths',
  'reviewImagePath',
  'jimengAssetId',
] as const

export function shouldPersistAssetPatchImmediately(patch: Partial<WorkflowAsset>): boolean {
  return ASSET_IMAGE_PERSIST_KEYS.some((key) => key in patch)
}

export function removeAssetFromList(assets: WorkflowAsset[], assetId: string): WorkflowAsset[] {
  return assets.filter((asset) => asset.id !== assetId)
}

/** 从项目数据中删除指定资产，并同步移除各分集实体标签 */
export function removeWorkflowAssetFromData(
  data: WorkflowProjectData,
  kind: AssetKind,
  assetId: string,
): WorkflowProjectData {
  const listKey = ASSET_LIST_KEY[kind]
  const assets = data[listKey] ?? []
  const asset = assets.find((item) => item.id === assetId)
  const nextList = removeAssetFromList(assets, assetId)
  let next: WorkflowProjectData = { ...data, [listKey]: nextList }

  const assetName = asset?.name?.trim()
  if (assetName && (next.episodes?.length ?? 0) > 0) {
    const field = episodeEntityKey(kind)
    next = {
      ...next,
      episodes: next.episodes.map((ep) => ({
        ...ep,
        [field]: (ep[field] ?? []).filter((entity) => entity.name.trim() !== assetName),
      })),
    }
    next = { ...next, ...syncProjectAssetEpisodeLinks(next) }
  }

  return next
}

export function mergeEntityList(
  existing: EpisodeEntity[],
  incoming: Array<{ name: string; description: string }>,
): EpisodeEntity[] {
  const map = new Map(existing.map((e) => [e.name.trim(), e]))
  for (const item of incoming) {
    const name = item.name.trim()
    if (!name) continue
    const prev = map.get(name)
    map.set(name, {
      name,
      description: item.description.trim() || prev?.description || '',
    })
  }
  return Array.from(map.values())
}

/** 分集可用于匹配资产名称的文本（正文 + 摘要 + 标题等） */
function getEpisodeMatchText(episode: WorkflowEpisode): string {
  return [
    episode.content,
    episode.title,
    episode.assetScope,
  ]
    .filter(Boolean)
    .join('\n')
}

function hasEpisodeSubstance(episode: WorkflowEpisode): boolean {
  return Boolean(episode.content?.trim() || episode.title?.trim())
}

/** 从资产名称与描述生成匹配 token（支持「慈祥爷爷」↔ 正文「爷爷」、后缀「守河」等） */
function buildAssetNameMatchTokens(name: string, description?: string): string[] {
  const tokens = new Set<string>()
  const trimmed = name.trim()
  if (trimmed) {
    tokens.add(trimmed)
    for (let len = 2; len <= Math.min(4, trimmed.length); len++) {
      tokens.add(trimmed.slice(-len))
      tokens.add(trimmed.slice(0, len))
    }
  }
  if (description) {
    for (const match of description.matchAll(/名叫([^的，,。\s]+)的/g)) {
      const embedded = match[1]?.trim()
      if (embedded && embedded.length >= 2) tokens.add(embedded)
    }
  }
  return [...tokens].filter((token) => token.length >= 2)
}

/** 资产名称是否出现在分集文本中（精确或 token 模糊） */
export function assetMatchesEpisodeText(
  assetName: string,
  episodeText: string,
  description?: string,
): boolean {
  return textIncludesAssetName(assetName, episodeText, description)
}

/** 资产名称是否出现在任意文本中（分镜标题/提示词等） */
export function textIncludesAssetName(
  assetName: string,
  text: string,
  description?: string,
): boolean {
  const source = text.trim()
  if (!source) return false
  const tokens = buildAssetNameMatchTokens(assetName, description)
  return tokens.some((token) => source.includes(token))
}

/** 资产全名是否出现在文本中（不含后缀 token 模糊） */
export function textIncludesAssetFullName(assetName: string, text: string): boolean {
  const name = assetName.trim()
  const source = text.trim()
  return Boolean(name && source && source.includes(name))
}

function assetMatchesEpisode(
  episode: WorkflowEpisode,
  assetName: string,
  description?: string,
): boolean {
  return assetMatchesEpisodeText(assetName, getEpisodeMatchText(episode), description)
}

function assetBelongsToEpisode(
  asset: WorkflowAsset,
  episode: WorkflowEpisode,
  kind?: AssetKind,
): boolean {
  if (asset.episodeIndexes?.includes(episode.episodeIndex)) return true
  if (asset.episodeIndex === episode.episodeIndex) return true

  if (kind) {
    const field = episodeEntityKey(kind)
    const names = (episode[field] ?? []).map((entity) => entity.name.trim()).filter(Boolean)
    if (names.includes(asset.name.trim())) return true
  }

  if (!asset.episodeIndexes?.length && asset.episodeIndex == null) {
    return assetMatchesEpisode(episode, asset.name, resolveAssetDescription(asset))
  }
  return false
}

function episodeEntitiesFromAssets(
  assets: WorkflowAsset[],
  episode: WorkflowEpisode,
  kind: AssetKind,
): EpisodeEntity[] {
  return assets
    .filter((asset) => assetBelongsToEpisode(asset, episode, kind))
    .map((asset) => ({
      name: asset.name.trim(),
      description: resolveAssetDescription(asset),
    }))
    .filter((entity) => entity.name)
}

/** 提取资产后，按分集归属回写各集实体标签（单集时即更新第一集） */
export function syncEpisodeEntityTagsFromAssets(
  data: Pick<WorkflowProjectData, 'episodes' | 'characters' | 'scenes' | 'props'>,
): WorkflowEpisode[] {
  const episodes = data.episodes ?? []
  return episodes.map((ep) => ({
    ...ep,
    characters: episodeEntitiesFromAssets(data.characters ?? [], ep, 'character'),
    scenes: episodeEntitiesFromAssets(data.scenes ?? [], ep, 'scene'),
    items: episodeEntitiesFromAssets(data.props ?? [], ep, 'item'),
  }))
}

/** 从分集实体标签收集待同步条目（不调用 LLM） */
export function collectEpisodeEntitiesForKind(
  episodes: WorkflowEpisode[],
  kind: AssetKind,
  episodeId?: string | null,
): EpisodeEntity[] {
  const field = episodeEntityKey(kind)
  const source = episodeId ? episodes.filter((ep) => ep.id === episodeId) : episodes
  let merged: EpisodeEntity[] = []
  for (const ep of source) {
    merged = mergeEntityList(merged, ep[field] ?? [])
  }
  return merged
}

function episodeEntityKey(kind: AssetKind): 'characters' | 'scenes' | 'items' {
  if (kind === 'character') return 'characters'
  if (kind === 'scene') return 'scenes'
  return 'items'
}

/** 将全剧资产中名称出现在本集脚本里的项，写入本集实体标签 */
export function linkEpisodeEntitiesFromScript(
  episode: WorkflowEpisode,
  assets: WorkflowAsset[],
  kind: AssetKind,
): WorkflowEpisode {
  const field = episodeEntityKey(kind)
  const episodeText = getEpisodeMatchText(episode)
  const incoming = assets
    .filter((asset) => {
      const name = asset.name.trim()
      if (!name) return false
      return assetMatchesEpisodeText(name, episodeText, resolveAssetDescription(asset))
    })
    .map((asset) => ({ name: asset.name, description: asset.description }))

  return {
    ...episode,
    [field]: mergeEntityList(episode[field], incoming),
  }
}

/** 按分集实体标签或 episodeIndexes 匹配项目级资产 */
export function filterAssetsByEpisode(
  assets: WorkflowAsset[],
  episode: WorkflowEpisode | null,
  kind: AssetKind,
): WorkflowAsset[] {
  if (!episode) return assets

  return assets.filter((asset) => assetBelongsToEpisode(asset, episode, kind))
}

/** 根据各集实体标签，回写资产的 episodeIndexes */
export function syncProjectAssetEpisodeLinks(
  data: Pick<WorkflowProjectData, 'episodes' | 'characters' | 'scenes' | 'props'>,
): Pick<WorkflowProjectData, 'characters' | 'scenes' | 'props'> {
  const episodes = data.episodes ?? []

  const syncList = (assets: WorkflowAsset[], kind: AssetKind) => {
    const key = episodeEntityKey(kind)
    return assets.map((asset) => {
      const entityIndexes = episodes
        .filter((ep) =>
          (ep[key] ?? []).some((entity) => entity.name.trim() === asset.name.trim()),
        )
        .map((ep) => ep.episodeIndex)
      const manualIndexes = asset.episodeIndexes?.length
        ? asset.episodeIndexes
        : asset.episodeIndex != null
          ? [asset.episodeIndex]
          : []
      const indexes = Array.from(new Set([...entityIndexes, ...manualIndexes]))
      return {
        ...asset,
        episodeIndexes: indexes.length > 0 ? indexes : undefined,
        episodeIndex: indexes[0],
      }
    })
  }

  return {
    characters: syncList(data.characters ?? [], 'character'),
    scenes: syncList(data.scenes ?? [], 'scene'),
    props: syncList(data.props ?? [], 'prop'),
  }
}

/** 提取资产归属分集：仅一集时归第 1 集；多集时按各集正文/摘要模糊匹配，不默认全局 */
export function resolveExtractedAssetEpisodeIndexes(
  assetName: string,
  episodes: WorkflowEpisode[],
  description?: string,
): number[] | undefined {
  const name = assetName.trim()
  if (!name || episodes.length === 0) return undefined

  if (episodes.length === 1) {
    return [episodes[0].episodeIndex]
  }

  let matched = episodes
    .filter((ep) => assetMatchesEpisode(ep, name, description))
    .map((ep) => ep.episodeIndex)

  if (matched.length === 0) {
    const substantive = episodes.filter(hasEpisodeSubstance)
    if (substantive.length === 1) {
      matched = [substantive[0].episodeIndex]
    }
  }

  return matched.length > 0 ? matched : undefined
}

function mergeAssetEpisodeIndexes(
  prev: number[] | undefined,
  incoming: number[] | undefined,
): number[] | undefined {
  if (!incoming?.length) return prev?.length ? prev : undefined
  return Array.from(new Set([...(prev ?? []), ...incoming]))
}

export interface MaterializeAssetsStats {
  created: number
  updated: number
  byKind: Record<AssetKind, { created: number; updated: number }>
}

export interface MaterializeAssetsResult extends Pick<
  WorkflowProjectData,
  'characters' | 'scenes' | 'props'
> {
  stats: MaterializeAssetsStats
}

function collectEpisodeEntitiesByKind(
  episodes: WorkflowEpisode[],
  kind: AssetKind,
): Map<string, { description: string; episodeIndexes: number[] }> {
  const field = episodeEntityKey(kind)
  const map = new Map<string, { description: string; episodeIndexes: Set<number> }>()

  for (const episode of episodes) {
    for (const entity of episode[field] ?? []) {
      const name = entity.name.trim()
      if (!name) continue
      const prev = map.get(name)
      const episodeIndexes = prev?.episodeIndexes ?? new Set<number>()
      episodeIndexes.add(episode.episodeIndex)
      const description = entity.description.trim() || prev?.description || ''
      map.set(name, { description, episodeIndexes })
    }
  }

  return new Map(
    [...map.entries()].map(([name, value]) => [
      name,
      {
        description: value.description,
        episodeIndexes: Array.from(value.episodeIndexes).sort((a, b) => a - b),
      },
    ]),
  )
}

function materializeAssetsForKind(
  episodes: WorkflowEpisode[],
  kind: AssetKind,
  stats: MaterializeAssetsStats,
): WorkflowAsset[] {
  const incoming = collectEpisodeEntitiesByKind(episodes, kind)
  const result: WorkflowAsset[] = []

  for (const [name, { description, episodeIndexes }] of incoming) {
    stats.created += 1
    stats.byKind[kind].created += 1
    result.push({
      ...createEmptyAsset(kind, name),
      description,
      prompt: description,
      episodeIndexes,
      episodeIndex: episodeIndexes[0],
    })
  }

  return result
}

function createEmptyMaterializeStats(): MaterializeAssetsStats {
  return {
    created: 0,
    updated: 0,
    byKind: {
      character: { created: 0, updated: 0 },
      scene: { created: 0, updated: 0 },
      prop: { created: 0, updated: 0 },
    },
  }
}

/** 从分集实体标签重建资产库（全量替换，不保留旧资产） */
export function materializeAssetsFromEpisodes(
  data: Pick<WorkflowProjectData, 'episodes' | 'characters' | 'scenes' | 'props'>,
): MaterializeAssetsResult {
  const episodes = data.episodes ?? []
  const stats = createEmptyMaterializeStats()

  const characters = materializeAssetsForKind(episodes, 'character', stats)
  const scenes = materializeAssetsForKind(episodes, 'scene', stats)
  const props = materializeAssetsForKind(episodes, 'prop', stats)

  return { characters, scenes, props, stats }
}

export function countWorkflowAssets(
  data: Pick<WorkflowProjectData, 'characters' | 'scenes' | 'props'>,
): number {
  return (data.characters?.length ?? 0) + (data.scenes?.length ?? 0) + (data.props?.length ?? 0)
}

/** AI 分集并提取资产：已有资产时需二次确认 */
export const REPLACE_ASSETS_CONFIRM = {
  title: '重建资产库？',
  description:
    '将按当前分集标签重建整部剧的角色、场景、物品资产库。原有资产（含已生图、参考图、审核状态）将被清空，此操作不可撤销。',
  confirmLabel: '继续重建',
  cancelLabel: '取消',
} as const

/** 本集当前关联资产数量（重提本集确认框 beforeAssetCount） */
export function countEpisodeLinkedAssets(
  data: Pick<WorkflowProjectData, 'characters' | 'scenes' | 'props'>,
  episode: WorkflowEpisode,
): number {
  return (
    filterAssetsByEpisode(data.characters ?? [], episode, 'character').length +
    filterAssetsByEpisode(data.scenes ?? [], episode, 'scene').length +
    filterAssetsByEpisode(data.props ?? [], episode, 'prop').length
  )
}

export function needsReplaceAssetsConfirm(
  data: Pick<WorkflowProjectData, 'characters' | 'scenes' | 'props'>,
): boolean {
  return countWorkflowAssets(data) > 0
}

export function formatMaterializeAssetsSummary(stats: MaterializeAssetsStats): string {
  const parts: string[] = []
  if (stats.byKind.character.created > 0) {
    parts.push(`${stats.byKind.character.created} 人物`)
  }
  if (stats.byKind.scene.created > 0) {
    parts.push(`${stats.byKind.scene.created} 场景`)
  }
  if (stats.byKind.prop.created > 0) {
    parts.push(`${stats.byKind.prop.created} 物品`)
  }
  if (!parts.length) return '无资产'
  return parts.join('、')
}

export function mergeExtractedAssets(
  existing: WorkflowAsset[],
  incoming: Array<{ name: string; description: string }>,
  kind: AssetKind,
  episodes: WorkflowEpisode[] = [],
): WorkflowAsset[] {
  const map = new Map(existing.map((a) => [a.name, a]))
  for (const item of incoming) {
    const incomingIndexes = resolveExtractedAssetEpisodeIndexes(
      item.name,
      episodes,
      item.description,
    )
    const prev = map.get(item.name)
    if (prev) {
      const episodeIndexes = mergeAssetEpisodeIndexes(prev.episodeIndexes, incomingIndexes)
      map.set(item.name, {
        ...prev,
        description: item.description || prev.description,
        prompt: item.description || prev.prompt,
        episodeIndexes,
        episodeIndex: episodeIndexes?.[0] ?? prev.episodeIndex,
        updatedAt: Date.now(),
      })
    } else {
      map.set(item.name, {
        ...createEmptyAsset(kind, item.name),
        description: item.description,
        prompt: item.description,
        episodeIndexes: incomingIndexes,
        episodeIndex: incomingIndexes?.[0],
      })
    }
  }
  return Array.from(map.values())
}

/** 从提取结果构建全新资产列表（成功提取后替换旧资产，不合并保留） */
export function buildExtractedAssets(
  incoming: Array<{ name: string; description: string }>,
  kind: AssetKind,
  episodes: WorkflowEpisode[] = [],
): WorkflowAsset[] {
  const result: WorkflowAsset[] = []
  const seen = new Set<string>()

  for (const item of incoming) {
    const name = item.name.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)

    const episodeIndexes = resolveExtractedAssetEpisodeIndexes(name, episodes, item.description)
    result.push({
      ...createEmptyAsset(kind, name),
      description: item.description,
      prompt: item.description,
      episodeIndexes,
      episodeIndex: episodeIndexes?.[0],
    })
  }

  return result
}

export function resolveExtractTemplate(
  settings: AppSettings,
  key?: string,
): PromptTemplate | undefined {
  const templates = settings.extractTemplates ?? []
  if (!key) return templates[0]
  return templates.find((t) => t.key === key || t.id === key) ?? templates[0]
}

/** Step2 提取模板：全局上次选用 > 项目字段 > 默认 V2 */
export function resolveStep2ExtractTemplateKey(
  settings: AppSettings | null | undefined,
  options: Array<{ value: string; label: string }>,
  projectKey?: string,
): string {
  const valid = (key?: string) => {
    if (!key) return undefined
    return options.some((item) => item.value === key) ? key : undefined
  }

  return (
    valid(settings?.lastUsedExtractTemplateKey) ??
    valid(projectKey) ??
    valid(EXTRACT_TEMPLATE_V2_KEY) ??
    options[0]?.value ??
    ''
  )
}

/** 一键快速提取：优先全局/显式 key，否则「提取模板Lite」 */
export function resolveQuickExtractTemplateKey(
  settings: AppSettings,
  explicitKey?: string,
): string {
  const templates = settings.extractTemplates ?? []
  const pick = (key?: string) => {
    if (!key) return undefined
    return templates.some((t) => t.key === key || t.id === key) ? key : undefined
  }

  return (
    pick(explicitKey?.trim()) ??
    pick(settings.lastUsedExtractTemplateKey) ??
    pick(EXTRACT_TEMPLATE_LITE_KEY) ??
    templates[0]?.key ??
    ''
  )
}

/** 一键快速提取：优先使用「提取模板Lite」 */
export function resolveQuickExtractTemplate(settings: AppSettings): PromptTemplate | undefined {
  const key = resolveQuickExtractTemplateKey(settings)
  return key ? resolveExtractTemplate(settings, key) : undefined
}

export function buildAssetPrompt(
  asset: WorkflowAsset,
  layoutValue: string,
  styleValue: string,
  affix?: { prefix?: string; suffix?: string },
): string {
  const description = applyPromptAffix(
    resolveAssetDescription(asset),
    affix?.prefix,
    affix?.suffix,
  )
  const parts = [styleValue.trim(), description, layoutValue.trim()].filter(Boolean)
  return parts.join('\n\n')
}
