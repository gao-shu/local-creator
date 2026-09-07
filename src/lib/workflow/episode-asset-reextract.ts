// Copyright (c) Haode AI. All rights reserved.

/**
 * Step2「重提本集资产」：对本集做增删 diff，同名复用全库已有资产（保留 id / 生图）。
 * 与「一键提取资产」的整库替换（buildExtractedAssets）分离。
 */

import type { ExtractResult } from '@/lib/workflow/extract-prompt'
import {
  ASSET_LIST_KEY,
  createEmptyAsset,
  filterAssetsByEpisode,
  getGeneratedImagePaths,
  mergeExtractedAssets,
  removeWorkflowAssetFromData,
  resolveAssetDescription,
  syncEpisodeEntityTagsFromAssets,
} from '@/lib/workflow/asset-utils'
import type {
  AssetKind,
  WorkflowAsset,
  WorkflowEpisode,
  WorkflowProjectData,
} from '@/types/workflow'

export type EpisodeAssetReextractAction = 'reuse' | 'add' | 'unbind' | 'delete'

export interface EpisodeAssetReextractItem {
  kind: AssetKind
  name: string
  action: EpisodeAssetReextractAction
  assetId?: string
  hasGeneratedImage?: boolean
}

export interface EpisodeAssetReextractSummary {
  reuse: number
  add: number
  unbind: number
  delete: number
}

export interface EpisodeAssetReextractPlan {
  episodeId: string
  episodeIndex: number
  items: EpisodeAssetReextractItem[]
  summary: EpisodeAssetReextractSummary
}

const ASSET_KINDS: AssetKind[] = ['character', 'scene', 'prop']

function incomingForKind(
  parsed: ExtractResult,
  kind: AssetKind,
): Array<{ name: string; description: string }> {
  if (kind === 'character') return parsed.characters
  if (kind === 'scene') return parsed.scenes
  return parsed.items
}

export function assetHasGeneratedImage(asset: WorkflowAsset): boolean {
  return getGeneratedImagePaths(asset).length > 0
}

function episodeEntityField(kind: AssetKind): 'characters' | 'scenes' | 'items' {
  if (kind === 'character') return 'characters'
  if (kind === 'scene') return 'scenes'
  return 'items'
}

function resolveAssetEpisodeIndexes(asset: WorkflowAsset): number[] {
  if (asset.episodeIndexes?.length) return [...asset.episodeIndexes]
  if (asset.episodeIndex != null) return [asset.episodeIndex]
  return []
}

/** 资产名出现在哪些分集的实体标签上 */
function episodeIndexesFromEntityTags(
  assetName: string,
  kind: AssetKind,
  episodes: WorkflowEpisode[],
): number[] {
  const field = episodeEntityField(kind)
  const name = assetName.trim()
  if (!name) return []
  return episodes
    .filter((ep) =>
      (ep[field] ?? []).some((entity) => entity.name.trim() === name),
    )
    .map((ep) => ep.episodeIndex)
}

export interface IsAssetExclusiveToEpisodeOptions {
  kind?: AssetKind
  episodes?: WorkflowEpisode[]
}

/** 资产是否仅归属当前集（可安全删库） */
export function isAssetExclusiveToEpisode(
  asset: WorkflowAsset,
  episode: WorkflowEpisode,
  options?: IsAssetExclusiveToEpisodeOptions,
): boolean {
  const name = asset.name.trim()
  const indexes = resolveAssetEpisodeIndexes(asset)
  if (indexes.length === 1 && indexes[0] === episode.episodeIndex) return true
  if (indexes.length > 1) return false

  const kind = options?.kind
  const episodes = options?.episodes ?? []
  if (kind && episodes.length > 0) {
    const tagIndexes = episodeIndexesFromEntityTags(name, kind, episodes)
    const linked = Array.from(new Set([...indexes, ...tagIndexes])).sort((a, b) => a - b)
    if (linked.length === 1 && linked[0] === episode.episodeIndex) return true
    if (linked.length > 1) return false

    // 无 indexes / 跨集标签：仅当前集标签仍挂名 → 本集专属
    const field = episodeEntityField(kind)
    const onCurrentTag = (episode[field] ?? []).some((entity) => entity.name.trim() === name)
    const onOtherTags = episodes.some(
      (ep) =>
        ep.id !== episode.id &&
        (ep[field] ?? []).some((entity) => entity.name.trim() === name),
    )
    if (onCurrentTag && !onOtherTags) return true
  }

  return false
}

/** 从 episodeIndexes 去掉本集，保留其他集 */
export function unbindAssetFromEpisode(
  asset: WorkflowAsset,
  episodeIndex: number,
): WorkflowAsset {
  const prev = asset.episodeIndexes?.length
    ? asset.episodeIndexes
    : asset.episodeIndex != null
      ? [asset.episodeIndex]
      : []
  const next = prev.filter((n) => n !== episodeIndex)
  return {
    ...asset,
    episodeIndexes: next.length > 0 ? next : undefined,
    episodeIndex: next[0],
    updatedAt: Date.now(),
  }
}

function emptySummary(): EpisodeAssetReextractSummary {
  return { reuse: 0, add: 0, unbind: 0, delete: 0 }
}

function countSummary(items: EpisodeAssetReextractItem[]): EpisodeAssetReextractSummary {
  const summary = emptySummary()
  for (const item of items) {
    summary[item.action] += 1
  }
  return summary
}

function findAssetByName(assets: WorkflowAsset[], name: string): WorkflowAsset | undefined {
  const key = name.trim()
  return assets.find((a) => a.name.trim() === key)
}

/** 对比本集 before / LLM incoming，生成增删复用计划（不落盘） */
export function buildEpisodeAssetReextractPlan(
  data: Pick<WorkflowProjectData, 'characters' | 'scenes' | 'props' | 'episodes'>,
  episode: WorkflowEpisode,
  parsed: ExtractResult,
): EpisodeAssetReextractPlan {
  const items: EpisodeAssetReextractItem[] = []
  const episodes = data.episodes ?? []

  for (const kind of ASSET_KINDS) {
    const listKey = ASSET_LIST_KEY[kind]
    const allAssets = data[listKey] ?? []
    const before = filterAssetsByEpisode(allAssets, episode, kind)
    const incoming = incomingForKind(parsed, kind)
    const incomingNames = new Set(incoming.map((item) => item.name.trim()).filter(Boolean))
    const exclusiveOptions = { kind, episodes }

    for (const entity of incoming) {
      const name = entity.name.trim()
      if (!name) continue
      const existing = findAssetByName(allAssets, name)
      if (existing) {
        items.push({
          kind,
          name,
          action: 'reuse',
          assetId: existing.id,
          hasGeneratedImage: assetHasGeneratedImage(existing),
        })
      } else {
        items.push({ kind, name, action: 'add' })
      }
    }

    for (const asset of before) {
      const name = asset.name.trim()
      if (!name || incomingNames.has(name)) continue
      if (isAssetExclusiveToEpisode(asset, episode, exclusiveOptions)) {
        items.push({
          kind,
          name,
          action: 'delete',
          assetId: asset.id,
          hasGeneratedImage: assetHasGeneratedImage(asset),
        })
      } else {
        items.push({
          kind,
          name,
          action: 'unbind',
          assetId: asset.id,
          hasGeneratedImage: assetHasGeneratedImage(asset),
        })
      }
    }
  }

  return {
    episodeId: episode.id,
    episodeIndex: episode.episodeIndex,
    items,
    summary: countSummary(items),
  }
}

function ensureEpisodeIndex(asset: WorkflowAsset, episodeIndex: number): WorkflowAsset {
  const prev = asset.episodeIndexes?.length
    ? asset.episodeIndexes
    : asset.episodeIndex != null
      ? [asset.episodeIndex]
      : []
  if (prev.includes(episodeIndex)) {
    return {
      ...asset,
      episodeIndexes: prev,
      episodeIndex: prev[0] ?? episodeIndex,
    }
  }
  const next = [...prev, episodeIndex]
  return {
    ...asset,
    episodeIndexes: next,
    episodeIndex: next[0] ?? episodeIndex,
    updatedAt: Date.now(),
  }
}

/**
 * 有生图的复用项：保留原 description/prompt，仅补本集归属。
 * 无生图：允许用 LLM 描述更新（与 mergeExtractedAssets 一致）。
 */
function preserveGeneratedAssetFields(
  existing: WorkflowAsset[],
  merged: WorkflowAsset[],
  plan: EpisodeAssetReextractPlan,
  kind: AssetKind,
  episodeIndex: number,
): WorkflowAsset[] {
  const reuseWithImage = new Set(
    plan.items
      .filter(
        (item) =>
          item.kind === kind &&
          item.action === 'reuse' &&
          item.hasGeneratedImage &&
          item.assetId,
      )
      .map((item) => item.assetId!),
  )
  const byId = new Map(existing.map((a) => [a.id, a]))

  return merged.map((asset) => {
    let next = ensureEpisodeIndex(asset, episodeIndex)
    if (reuseWithImage.has(asset.id)) {
      const prev = byId.get(asset.id)
      if (prev) {
        next = {
          ...next,
          description: resolveAssetDescription(prev) || next.description,
          prompt: prev.prompt || next.prompt,
          // 生图 / 审核字段已随 merge 保留 prev 展开，此处只防 description 被覆盖
        }
      }
    }
    return next
  })
}

/** 按计划落库：merge 新增/复用 → unbind → delete → 回写分集实体标签 */
export function applyEpisodeAssetReextractPlan(
  data: WorkflowProjectData,
  episode: WorkflowEpisode,
  parsed: ExtractResult,
  plan?: EpisodeAssetReextractPlan,
): { data: WorkflowProjectData; plan: EpisodeAssetReextractPlan } {
  const resolvedPlan = plan ?? buildEpisodeAssetReextractPlan(data, episode, parsed)
  const episodeIndex = episode.episodeIndex
  const episodes = data.episodes ?? []

  let characters = preserveGeneratedAssetFields(
    data.characters ?? [],
    mergeExtractedAssets(data.characters ?? [], parsed.characters, 'character', episodes),
    resolvedPlan,
    'character',
    episodeIndex,
  )
  let scenes = preserveGeneratedAssetFields(
    data.scenes ?? [],
    mergeExtractedAssets(data.scenes ?? [], parsed.scenes, 'scene', episodes),
    resolvedPlan,
    'scene',
    episodeIndex,
  )
  let props = preserveGeneratedAssetFields(
    data.props ?? [],
    mergeExtractedAssets(data.props ?? [], parsed.items, 'prop', episodes),
    resolvedPlan,
    'prop',
    episodeIndex,
  )

  // unbind：从列表中解绑本集
  const unbindIds = new Set(
    resolvedPlan.items
      .filter((item) => item.action === 'unbind' && item.assetId)
      .map((item) => item.assetId!),
  )
  const applyUnbind = (list: WorkflowAsset[]) =>
    list.map((asset) =>
      unbindIds.has(asset.id) ? unbindAssetFromEpisode(asset, episodeIndex) : asset,
    )
  characters = applyUnbind(characters)
  scenes = applyUnbind(scenes)
  props = applyUnbind(props)

  let next: WorkflowProjectData = {
    ...data,
    characters,
    scenes,
    props,
  }

  // delete：仅本集专属，从库移除
  for (const item of resolvedPlan.items) {
    if (item.action !== 'delete' || !item.assetId) continue
    next = removeWorkflowAssetFromData(next, item.kind, item.assetId)
  }

  let syncedEpisodes = syncEpisodeEntityTagsFromAssets({
    episodes: next.episodes ?? [],
    characters: next.characters ?? [],
    scenes: next.scenes ?? [],
    props: next.props ?? [],
  })

  // fuzzy 全局资产无 episodeIndexes 时，sync 可能按脚本名再次挂回本集；按计划强制摘掉
  const stripByKind: Record<AssetKind, Set<string>> = {
    character: new Set(),
    scene: new Set(),
    prop: new Set(),
  }
  for (const item of resolvedPlan.items) {
    if (item.action !== 'unbind' && item.action !== 'delete') continue
    stripByKind[item.kind].add(item.name.trim())
  }
  syncedEpisodes = syncedEpisodes.map((ep) => {
    if (ep.id !== episode.id) return ep
    return {
      ...ep,
      characters: (ep.characters ?? []).filter((e) => !stripByKind.character.has(e.name.trim())),
      scenes: (ep.scenes ?? []).filter((e) => !stripByKind.scene.has(e.name.trim())),
      items: (ep.items ?? []).filter((e) => !stripByKind.prop.has(e.name.trim())),
    }
  })

  return {
    data: {
      ...next,
      episodes: syncedEpisodes,
    },
    plan: resolvedPlan,
  }
}

/** 确认框 / toast 摘要文案 */
export function formatEpisodeReextractPlanSummary(plan: EpisodeAssetReextractPlan): string {
  const { summary } = plan
  const parts: string[] = []
  if (summary.reuse > 0) parts.push(`复用 ${summary.reuse}`)
  if (summary.add > 0) parts.push(`新增 ${summary.add}`)
  if (summary.unbind > 0) parts.push(`解绑 ${summary.unbind}`)
  if (summary.delete > 0) parts.push(`移除 ${summary.delete}`)
  if (!parts.length) return '本集资产无变化'
  return parts.join('、')
}

/** 将删除且含生图的资产名列出（确认提示用） */
export function listEpisodeReextractDeleteWithImages(plan: EpisodeAssetReextractPlan): string[] {
  return plan.items
    .filter((item) => item.action === 'delete' && item.hasGeneratedImage)
    .map((item) => item.name)
}

/** Step2「重提本集资产」确认框（与一键提取的 REPLACE_ASSETS_CONFIRM 语义不同） */
export const EPISODE_REEXTRACT_ASSETS_CONFIRM = {
  title: '重提本集资产？',
  confirmLabel: '继续重提',
  cancelLabel: '取消',
} as const

export interface FormatEpisodeReextractConfirmOptions {
  /** 项目分集总数；>1 时强调其他分集不受影响 */
  episodeCount?: number
  /** 当前本集已关联资产数（点击前可知，无需等 LLM） */
  beforeAssetCount?: number
  /** 本集脚本文字数 */
  scriptCharCount?: number
  /**
   * 可选：若已有 plan（少见，一般确认在 LLM 前）。
   * 有 plan 时追加复用/新增/解绑/移除摘要与含生图的删除名单。
   */
  plan?: EpisodeAssetReextractPlan
}

/** 重提本集资产确认框 description（LLM 前即可用） */
export function formatEpisodeReextractConfirmDescription(
  episode: WorkflowEpisode,
  options: FormatEpisodeReextractConfirmOptions = {},
): string {
  const episodeCount = options.episodeCount ?? 1
  const scriptChars =
    options.scriptCharCount ?? episode.content?.trim().length ?? 0
  const beforeCount = options.beforeAssetCount
  const lines: string[] = [
    `将根据第 ${episode.episodeIndex} 集本集脚本（${scriptChars.toLocaleString('zh-CN')} 字）重新识别角色、场景、物品。`,
    '• 全库已有同名资产将保留（含已生图、审核状态）',
    '• 仅新增本集新出现的实体',
    '• 不再出现于本集脚本的本集专属资产将移除；多集共有资产仅从本集解绑',
  ]

  if (episodeCount > 1) {
    lines.push('• 其他分集资产不受影响（非整库重建）')
  }

  if (typeof beforeCount === 'number') {
    lines.push(
      beforeCount > 0
        ? `当前本集已关联约 ${beforeCount} 个资产，将按识别结果做增删同步。`
        : '当前本集尚无关联资产，将按识别结果新增。',
    )
  }

  if (options.plan) {
    const summary = formatEpisodeReextractPlanSummary(options.plan)
    lines.push(`预估变更：${summary}。`)
    const deleteWithImages = listEpisodeReextractDeleteWithImages(options.plan)
    if (deleteWithImages.length > 0) {
      lines.push(
        `以下本集专属资产含已生图，确认后将从库中移除：${deleteWithImages.join('、')}。`,
      )
    }
  }

  lines.push('此操作调用 AI，结果以模型输出为准。')
  return lines.join('\n')
}

/** 测试 / 调试：新建空资产并挂本集（便于构造 fixture） */
export function createEpisodeScopedAsset(
  kind: AssetKind,
  name: string,
  episodeIndexes: number[],
  extras?: Partial<WorkflowAsset>,
): WorkflowAsset {
  return {
    ...createEmptyAsset(kind, name),
    episodeIndexes: [...episodeIndexes],
    episodeIndex: episodeIndexes[0],
    ...extras,
  }
}
