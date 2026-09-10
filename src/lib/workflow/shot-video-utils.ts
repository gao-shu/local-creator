import type { WorkflowAsset, WorkflowShot } from '@/types/workflow'

import {
  collectAssetPreviewPaths,
  getGeneratedImagePaths,
  getPrimaryGeneratedImagePath,
  getReferenceImagePaths,
  isSameAssetMediaPath,
  pickAssetReviewImagePath,
} from '@/lib/workflow/asset-utils'
import type { ShotVideoReferenceAudioItem } from '@/lib/workflow/shot-audio-reference-utils'

import {
  mentionKindLabel,
  parseMentionSpans,
  resolveMentionCandidatesByIds,
  resolveMentionsInText,
  type MentionCandidate,
} from '@/lib/workflow/mention-utils'

import type { VideoReferenceMode } from '@/lib/workflow/storyboard-video-presets'



export function getGeneratedVideoPaths(

  shot: Pick<WorkflowShot, 'generatedVideoPaths' | 'generatedVideoPath'>,

): string[] {

  if (shot.generatedVideoPaths?.length) return shot.generatedVideoPaths

  if (shot.generatedVideoPath) return [shot.generatedVideoPath]

  return []

}



export function getPrimaryGeneratedVideoIndex(

  shot: Pick<WorkflowShot, 'primaryGeneratedVideoIndex'>,

  count: number,

): number {

  if (count <= 0) return 0

  const idx = shot.primaryGeneratedVideoIndex ?? 0

  return Math.min(Math.max(0, idx), count - 1)

}



export function getShotPreviewVideoPath(shot: WorkflowShot): string | undefined {

  const paths = getGeneratedVideoPaths(shot)

  if (!paths.length) return undefined

  return paths[getPrimaryGeneratedVideoIndex(shot, paths.length)]

}



export function buildVideoFieldsFromPaths(

  paths: string[],

  primaryIndex = 0,

): Pick<

  WorkflowShot,

  'generatedVideoPath' | 'generatedVideoPaths' | 'primaryGeneratedVideoIndex'

> {

  const idx = paths.length ? Math.min(Math.max(0, primaryIndex), paths.length - 1) : undefined

  return {

    generatedVideoPaths: paths.length ? paths : undefined,

    generatedVideoPath: paths.length ? paths[idx ?? 0] : undefined,

    primaryGeneratedVideoIndex: idx,

  }

}



export function appendShotGeneratedVideo(

  shot: WorkflowShot,

  videoPath: string,

): Partial<WorkflowShot> {

  const prev = getGeneratedVideoPaths(shot)

  const next = [...prev, videoPath]

  return {

    ...buildVideoFieldsFromPaths(next, next.length - 1),

    videoStatus: 'done' as const,

  }

}



export function hasShotVideo(shot: WorkflowShot): boolean {

  return getGeneratedVideoPaths(shot).length > 0

}



/** 指定分镜图路径是否已人工审核通过 */
export function isShotImagePathValidated(
  shot: Pick<WorkflowShot, 'validated' | 'validatedImagePath' | 'validatedImagePaths'>,
  imagePath?: string,
): boolean {
  const target = imagePath?.trim()
  if (!target) return false

  const paths = shot.validatedImagePaths ?? []
  if (paths.length) {
    return paths.some((p) => isSameAssetMediaPath(p, target))
  }

  if (shot.validatedImagePath) {
    return isSameAssetMediaPath(shot.validatedImagePath, target)
  }

  return false
}

/** 当前主分镜图是否已通过人工审核 */
export function isStoryboardImageValidated(shot: WorkflowShot): boolean {
  const current = getPrimaryGeneratedImagePath(
    shot as Parameters<typeof getPrimaryGeneratedImagePath>[0],
  )
  if (!current) return false
  return isShotImagePathValidated(shot, current)
}

/** 标记指定分镜图为已审核（默认当前主图） */
export function buildShotImageValidationPatch(
  shot: WorkflowShot,
  imagePath?: string,
): Partial<WorkflowShot> {
  const path =
    imagePath?.trim() ||
    getPrimaryGeneratedImagePath(shot as Parameters<typeof getPrimaryGeneratedImagePath>[0])
  if (!path) return {}

  const prev = shot.validatedImagePaths ?? []
  const already = prev.some((p) => isSameAssetMediaPath(p, path))
  const validatedImagePaths = already ? prev : [...prev, path]

  return {
    validated: true,
    validatedImagePath: path,
    validatedImagePaths,
  }
}



/** 未审核分镜图不允许生成视频 */

export function assertStoryboardImageValidated(shot: WorkflowShot): void {

  if (!isStoryboardImageValidated(shot)) {

    throw new Error(`镜号 ${shot.shotNumber} 的分镜图尚未审核，请先审核后再生成视频`)

  }

}



export function computeEpisodeVideoStats(shots: WorkflowShot[]) {

  const withVideo = shots.filter((s) => hasShotVideo(s))

  const passed = shots.filter((s) => s.videoValidated).length

  const pending = withVideo.filter((s) => !s.videoValidated && s.videoStatus === 'done').length

  const failed = shots.filter((s) => s.videoStatus === 'failed').length

  return { total: shots.length, passed, pending, failed, withVideo: withVideo.length }

}

/** 当前集分镜图审核统计：已审核数 / 总数，及待过审（已出图未审核）数 */
export function computeEpisodeStoryboardImageStats(shots: WorkflowShot[]) {
  const total = shots.length
  const validated = shots.filter((s) => isStoryboardImageValidated(s)).length
  const pending = shots.filter((s) => s.status === 'done' && !isStoryboardImageValidated(s)).length
  return { total, validated, pending }
}



export function getFirstFramePath(shot: WorkflowShot): string | undefined {

  return getPrimaryGeneratedImagePath(shot as Parameters<typeof getPrimaryGeneratedImagePath>[0])

}



export interface VideoReferenceResolveContext {

  /** 对齐 weifan keyframeMode：尾帧取下一分镜主图 */

  keyframeMode?: boolean

  nextShot?: WorkflowShot | null

}



export type ShotVideoReferenceKind = 'storyboard' | 'mention' | 'shot_reference' | 'end_frame'



export interface ShotVideoReferenceItem {

  kind: ShotVideoReferenceKind

  label: string

  path: string

  sourceAssetId?: string

}



export interface BuildShotVideoReferencesOptions {

  mentionCandidates?: MentionCandidate[]

  characters?: WorkflowAsset[]

  scenes?: WorkflowAsset[]

  props?: WorkflowAsset[]

}



function findWorkflowAssetById(
  id: string,
  options?: BuildShotVideoReferencesOptions,
): WorkflowAsset | undefined {
  for (const list of [options?.characters, options?.scenes, options?.props]) {
    const hit = list?.find((item) => item.id === id)
    if (hit) return hit
  }
  return undefined
}



function getShotMentionText(shot: WorkflowShot): string {

  return [shot.spatialAnchor, shot.prompt].filter(Boolean).join('\n')

}

function imageMentionCandidates(candidates: MentionCandidate[]): MentionCandidate[] {
  return candidates.filter((item) => item.kind !== 'voice')
}

function resolveAssetReferenceImagePath(
  asset: WorkflowAsset | undefined,
  mention?: MentionCandidate,
): string | undefined {
  const fromMention = (mention?.thumbnailPath || mention?.previewPaths?.[0])?.trim()
  if (fromMention) return fromMention
  if (!asset) return undefined
  return pickAssetReviewImagePath(asset) || collectAssetPreviewPaths(asset)[0]
}

function pushAssetMentionReference(
  push: (
    path: string | undefined,
    kind: ShotVideoReferenceKind,
    label: string,
    extra?: Pick<ShotVideoReferenceItem, 'sourceAssetId'> & {
      allowDuplicatePath?: boolean
    },
  ) => void,
  mention: MentionCandidate,
  asset: WorkflowAsset | undefined,
) {
  const path = resolveAssetReferenceImagePath(asset, mention)
  if (!path) return

  push(path, 'mention', `@${mention.mentionName}（${mentionKindLabel(mention.kind)}）`, {
    sourceAssetId: asset?.id ?? mention.id,
    allowDuplicatePath: mention.kind === 'character',
  })
}

/**
 * 已收集角色音色时补齐角色设定图（避免 @ 名与音色节点冲突或仅有音色无图）
 */
export function appendMissingCharacterRefImages(
  items: ShotVideoReferenceItem[],
  options: {
    shot?: WorkflowShot
    audioItems?: ShotVideoReferenceAudioItem[]
    mentionCandidates?: MentionCandidate[]
    characters?: WorkflowAsset[]
    scenes?: WorkflowAsset[]
    props?: WorkflowAsset[]
    /** 画布：连线到视频节点的人物设定图（含未 @ 的角色） */
    connectedCharacterMentions?: MentionCandidate[]
  },
): ShotVideoReferenceItem[] {
  const shot = options.shot

  const candidates = options.mentionCandidates ?? []
  const seenKeys = new Set(items.map((item) => item.sourceAssetId).filter(Boolean))
  const seenPaths = new Set(items.map((item) => item.path.trim()))
  const next = [...items]

  const findCharacterByName = (name: string): WorkflowAsset | undefined => {
    const key = name.trim()
    if (!key) return undefined
    const lower = key.toLowerCase()
    return options.characters?.find(
      (item) => item.name.trim() === key || item.name.trim().toLowerCase() === lower,
    )
  }

  const findCharacterMention = (name: string): MentionCandidate | undefined => {
    const key = name.trim()
    if (!key) return undefined
    const lower = key.toLowerCase()
    return imageMentionCandidates(candidates).find(
      (item) =>
        item.kind === 'character' &&
        (item.mentionName === key ||
          item.name === key ||
          item.mentionName.toLowerCase() === lower ||
          item.name.toLowerCase() === lower),
    )
  }

  const pushCharacter = (
    mentionName: string,
    mention?: MentionCandidate,
    asset?: WorkflowAsset,
  ) => {
    const resolvedMention = mention ?? findCharacterMention(mentionName)
    const resolvedAsset =
      asset ??
      (resolvedMention ? findWorkflowAssetById(resolvedMention.id, options) : undefined) ??
      findCharacterByName(mentionName)

    const assetId = resolvedAsset?.id ?? resolvedMention?.id
    if (assetId && seenKeys.has(assetId)) return

    const path = resolveAssetReferenceImagePath(resolvedAsset, resolvedMention)
    if (!path) return

    const displayName =
      resolvedMention?.mentionName ||
      resolvedAsset?.name.trim() ||
      mentionName

    if (assetId) seenKeys.add(assetId)
    seenPaths.add(path)
    next.push({
      kind: 'mention',
      label: `@${displayName}（角色）`,
      path,
      sourceAssetId: assetId,
    })
  }

  for (const audio of options.audioItems ?? []) {
    if (audio.source !== 'character_voice') continue
    const name = audio.mentionName?.trim() || audio.label.replace(/的音色$/, '').trim()
    if (!name) continue
    pushCharacter(name)
  }

  if (shot) {
    for (const mention of resolveMentionsInText(
      getShotMentionText(shot),
      imageMentionCandidates(candidates),
    )) {
      if (mention.kind !== 'character') continue
      pushCharacter(mention.mentionName, mention, findWorkflowAssetById(mention.id, options))
    }
  }

  for (const mention of options.connectedCharacterMentions ?? []) {
    if (mention.kind !== 'character') continue
    pushCharacter(
      mention.mentionName,
      mention,
      findWorkflowAssetById(mention.id, options),
    )
  }

  return next
}



/**

 * 对齐画镜 E2：当前分镜图 → @ 引用资产 → 分镜参考图槽（不含历史生成图）

 */

export function buildShotVideoReferenceItems(

  shot: WorkflowShot,

  options?: BuildShotVideoReferencesOptions,

): ShotVideoReferenceItem[] {

  const candidates = options?.mentionCandidates ?? []
  const imageCandidates = imageMentionCandidates(candidates)

  const items: ShotVideoReferenceItem[] = []

  const seenKeys = new Set<string>()
  const seenPaths = new Set<string>()



  const push = (
    path: string | undefined,
    kind: ShotVideoReferenceKind,
    label: string,
    extra?: Pick<ShotVideoReferenceItem, 'sourceAssetId'> & {
      /** 角色设定图可与分镜图同路径，仍单独占位 @图N */
      allowDuplicatePath?: boolean
    },
  ) => {

    const trimmed = path?.trim()

    if (!trimmed) return

    const assetKey = extra?.sourceAssetId ? `asset:${extra.sourceAssetId}` : ''
    if (assetKey && seenKeys.has(assetKey)) return
    if (!extra?.allowDuplicatePath && seenPaths.has(trimmed)) return

    if (assetKey) seenKeys.add(assetKey)
    seenPaths.add(trimmed)
    items.push({
      kind,
      label,
      path: trimmed,
      sourceAssetId: extra?.sourceAssetId,
    })

  }



  const primary =

    getFirstFramePath(shot) || getGeneratedImagePaths(shot)[0]

  if (primary) {

    push(primary, 'storyboard', '当前分镜图')

  }



  const mentionText = getShotMentionText(shot)

  for (const mention of resolveMentionsInText(mentionText, imageCandidates)) {
    const asset = findWorkflowAssetById(mention.id, options)
    pushAssetMentionReference(push, mention, asset)
  }

  for (const mention of resolveMentionCandidatesByIds(shot.referencedAssetIds ?? [], imageCandidates)) {
    pushAssetMentionReference(push, mention, findWorkflowAssetById(mention.id, options))
  }



  const refs = getReferenceImagePaths(shot)

  refs.forEach((ref, index) => {

    push(ref, 'shot_reference', refs.length > 1 ? `分镜参考 ${index + 1}` : '分镜参考')

  })



  return items

}



/** @deprecated 请使用 buildShotVideoReferenceItems */

export function buildOrderedVideoImagePaths(

  shot: WorkflowShot,

  options?: BuildShotVideoReferencesOptions,

): string[] {

  return buildShotVideoReferenceItems(shot, options).map((item) => item.path)

}



/** 下一分镜主图，作为首尾帧模式的尾帧（对齐 weifan T2） */

export function getNextShotEndFramePath(nextShot?: WorkflowShot | null): string | undefined {

  if (!nextShot) return undefined

  return (

    getPrimaryGeneratedImagePath(nextShot as Parameters<typeof getPrimaryGeneratedImagePath>[0]) ||

    getReferenceImagePaths(nextShot)[0]

  )

}



export function resolveVideoReferenceContext(

  shot: WorkflowShot,

  episodeShots: WorkflowShot[],

  keyframeMode?: boolean,

): VideoReferenceResolveContext {

  const index = episodeShots.findIndex((item) => item.id === shot.id)

  const nextShot = index >= 0 && index < episodeShots.length - 1 ? episodeShots[index + 1] : null

  return { keyframeMode, nextShot }

}



/** 按参考模式收集可用参考图（含类型标签，供确认弹窗展示） */

export function resolveVideoReferenceItems(

  shot: WorkflowShot,

  mode: VideoReferenceMode,

  context?: VideoReferenceResolveContext,

  options?: BuildShotVideoReferencesOptions,

): ShotVideoReferenceItem[] {

  const ordered = buildShotVideoReferenceItems(shot, options)



  if (mode === 'text_to_video') return []



  if (mode === 'first_frame') {
    // seedance：分镜图作 first_frame，@ 资产与参考图槽作 reference_image
    return ordered
  }

  if (mode === 'first_last_frame') {
    const start = ordered.find((item) => item.kind === 'storyboard') ?? ordered[0]
    if (!start) return []

    const endFromNext =
      context?.keyframeMode ? getNextShotEndFramePath(context.nextShot) : undefined

    const frames: ShotVideoReferenceItem[] = [start]

    if (endFromNext && endFromNext !== start.path) {
      frames.push({ kind: 'end_frame', label: '下一分镜图（尾帧）', path: endFromNext })
    } else {
      const tail =
        ordered.find((item) => item.kind === 'shot_reference') ??
        ordered.find((item) => item.kind !== 'storyboard' && item.path !== start.path)
      if (tail && tail.path !== start.path) {
        frames.push({
          kind: 'end_frame',
          label: tail.kind === 'shot_reference' ? tail.label : '尾帧参考',
          path: tail.path,
        })
      }
    }

    const used = new Set(frames.map((item) => item.path))
    const extras = ordered.filter(
      (item) =>
        item.kind !== 'storyboard' &&
        item.kind !== 'end_frame' &&
        !used.has(item.path),
    )
    return [...frames, ...extras]
  }



  return ordered

}



/** 按参考模式收集可用参考图路径 */

export function resolveVideoReferenceImagePaths(

  shot: WorkflowShot,

  mode: VideoReferenceMode,

  context?: VideoReferenceResolveContext,

  options?: BuildShotVideoReferencesOptions,

): string[] {

  return resolveVideoReferenceItems(shot, mode, context, options).map((item) => item.path)

}


const REF_IMAGE_INDEX_CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] as const

function refImageIndexCn(index: number): string {
  return REF_IMAGE_INDEX_CN[index] ?? String(index + 1)
}

/** 从 `@小孙子（角色）` 提取展示名 */
function mentionLabelDisplayName(label: string): string {
  const trimmed = label.trim()
  const matched = trimmed.match(/^@([^（(]+)/)
  return matched?.[1]?.trim() || trimmed
}

function mentionKindFromRefLabel(label: string): MentionCandidate['kind'] {
  if (/（场景）|\(场景\)/.test(label)) return 'scene'
  if (/（物品）|\(物品\)/.test(label)) return 'prop'
  return 'character'
}

/** @ 角色引用判定 */
export function isCharacterRefItem(item: Pick<ShotVideoReferenceItem, 'kind' | 'label'>): boolean {
  return item.kind === 'mention' && mentionKindFromRefLabel(item.label) === 'character'
}

function mentionCandidatesFromRefItems(
  items: Pick<ShotVideoReferenceItem, 'kind' | 'label' | 'sourceAssetId'>[],
): MentionCandidate[] {
  const seen = new Set<string>()
  const candidates: MentionCandidate[] = []
  for (const item of items) {
    if (item.kind !== 'mention') continue
    const mentionName = mentionLabelDisplayName(item.label)
    if (!mentionName || seen.has(mentionName)) continue
    seen.add(mentionName)
    candidates.push({
      id: item.sourceAssetId || mentionName,
      name: mentionName,
      mentionName,
      kind: mentionKindFromRefLabel(item.label),
      description: '',
    })
  }
  return candidates
}

export interface VideoMentionFigureMapping {
  mentionName: string
  displayName: string
  /** 0-based，与 content[].image_url 顺序一致 */
  imageIndex: number
}

/** @ 引用 → 参考图序号（与 buildShotVideoReferenceItems 顺序一致） */
export function buildVideoMentionFigureMappings(
  items: Pick<ShotVideoReferenceItem, 'kind' | 'label'>[],
): VideoMentionFigureMapping[] {
  const mappings: VideoMentionFigureMapping[] = []
  const seen = new Set<string>()

  items.forEach((item, index) => {
    if (item.kind !== 'mention') return
    const displayName = mentionLabelDisplayName(item.label)
    if (!displayName) return
    const mentionName = displayName
    if (seen.has(mentionName)) return
    seen.add(mentionName)
    mappings.push({ mentionName, displayName, imageIndex: index })
  })

  return mappings
}

/**
 * 对齐画镜 hv：将 `@小孙子` 替换为 `小孙子（图一）`（图序与参考图数组一致）。
 * 使用 parseMentionSpans 定位，兼容 `@爷爷和@小孙子` 等中文连写。
 */
export function replaceAtMentionsWithFigureLabels(
  prompt: string,
  items: Pick<ShotVideoReferenceItem, 'kind' | 'label' | 'sourceAssetId'>[],
): string {
  const indexByMentionName = new Map<string, number>()
  items.forEach((item, index) => {
    if (item.kind !== 'mention') return
    const mentionName = mentionLabelDisplayName(item.label)
    if (!mentionName || indexByMentionName.has(mentionName)) return
    indexByMentionName.set(mentionName, index)
  })
  if (!indexByMentionName.size) return prompt

  const candidates = mentionCandidatesFromRefItems(items)
  const spans = parseMentionSpans(prompt, candidates)
  if (!spans.length) return prompt

  let text = prompt
  for (const span of [...spans].sort((a, b) => b.start - a.start)) {
    const mentionName = span.candidate?.mentionName || span.name
    const imageIndex = indexByMentionName.get(mentionName)
    if (imageIndex === undefined) continue
    const replacement = `${mentionName}（图${refImageIndexCn(imageIndex)}）`
    text = text.slice(0, span.start) + replacement + text.slice(span.end)
  }

  return text
}

/**
 * 对齐画镜：对白字段首说话人包为 【角色（图N）】。
 * 例：对白：小孙子（图二），… → 对白：【小孙子（图二）】…
 */
function wrapDialogueSpeakersWithFigureBrackets(text: string): string {
  return text.replace(/(对白(?:\/独白)?[：:])([^\n]*)/g, (full, prefix: string, body: string) => {
    const rest = body.trim()
    if (!rest) return full

    if (/^【[^】]+（图[一二三四五六七八九十\d]+）】/.test(rest)) {
      return `${prefix}${rest}`
    }

    const speakerMatch = rest.match(/^([\u4e00-\u9fff\w.·-]+)（图([一二三四五六七八九十\d]+)）/)
    if (!speakerMatch) return full

    const speakerLabel = speakerMatch[0]
    const after = rest.slice(speakerLabel.length).replace(/^[，,、：:\s]+/, '')
    return `${prefix}【${speakerLabel}】${after}`
  })
}

/**
 * 对齐画镜：末尾仅追加角色图序说明（图二是小孙子，图三是爷爷）。
 * 分镜/场景/道具/参考槽占图序但不写入 suffix。
 */
export function buildVideoReferenceImageIndexHint(
  items: Pick<ShotVideoReferenceItem, 'kind' | 'label'>[],
): string {
  const parts: string[] = []

  items.forEach((item, index) => {
    if (!isCharacterRefItem(item)) return
    const name = mentionLabelDisplayName(item.label)
    if (!name) return
    parts.push(`图${refImageIndexCn(index)}是${name}`)
  })

  return parts.join('，')
}

/** 生视频 API 用 prompt：@→名（图N）、对白包【】、末尾仅角色图序 */
export function enrichVideoPromptWithReferenceImageHints(
  prompt: string,
  items: Pick<ShotVideoReferenceItem, 'kind' | 'label' | 'sourceAssetId'>[],
): string {
  let base = replaceAtMentionsWithFigureLabels(prompt, items).trim()
  base = wrapDialogueSpeakersWithFigureBrackets(base)
  const hint = buildVideoReferenceImageIndexHint(items)
  if (!hint) return base
  if (base.includes(hint)) return base

  const sep = /[，,。！？!?；;]$/.test(base) ? '' : '，'
  return `${base}${sep}${hint}`
}


