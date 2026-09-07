// Copyright (c) local-creator contributors. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import type { CanvasMediaLocation } from '@/lib/canvas/canvas-media-resolve'
import {
  collectUpstreamReferenceAssets,
  getUpstreamNodes,
  type CanvasUpstreamReferenceAsset,
} from '@/lib/canvas/canvas-graph-utils'
import {
  CANVAS_IMAGE_ROLE_MENTION_LABELS,
  generateCanvasConvertedAssetName,
  generateCanvasDefaultImageName,
} from '@/lib/canvas/canvas-image-role'
import {
  applySecondaryMentionRecognition,
  enrichPromptWithMentions,
  mentionKindLabel,
  normalizeMentionSource,
  resolveMentionsInText,
  type MentionCandidate,
  type MentionEntityType,
} from '@/lib/workflow/mention-utils'
import type { VoiceLibraryEntry } from '@/types/voice-library'
import type {
  CanvasImageAssetRole,
  CanvasImageNodeData,
  CanvasReferenceImageNodeData,
  CanvasVoiceNodeData,
} from '@/types/canvas-nodes'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import {
  MAX_REFERENCE_AUDIOS,
  type ShotVideoReferenceAudioItem,
} from '@/lib/workflow/shot-audio-reference-utils'
import type { ShotVideoReferenceItem } from '@/lib/workflow/shot-video-utils'
import { decodeLocalVoiceType, isLocalVoiceType, resolveVoiceLabel } from '@/types/voice-library'

export const CANVAS_MENTION_ID_PREFIX = 'canvas-node:'

function mapAssetRoleToMentionKind(role?: CanvasImageAssetRole): MentionEntityType {
  if (role === 'scene') return 'scene'
  if (role === 'item') return 'prop'
  return 'character'
}

function buildCanvasMentionId(nodeId: string): string {
  return `${CANVAS_MENTION_ID_PREFIX}${nodeId}`
}

function parseCanvasMentionNodeId(candidateId: string): string | null {
  if (!candidateId.startsWith(CANVAS_MENTION_ID_PREFIX)) return null
  return candidateId.slice(CANVAS_MENTION_ID_PREFIX.length) || null
}

function resolveCanvasImageNodeStoredPath(data: CanvasImageNodeData): string {
  return String(data.outputPath || '').trim()
}

function resolveReferenceImageNodeStoredPath(data: CanvasReferenceImageNodeData): string {
  return String(data.imagePath || '').trim()
}

/** 为画布 @ 分配唯一 mention 名（冲突时自动递增，绝不跳过节点） */
function allocateCanvasMentionName(
  preferred: string | undefined,
  usedNames: Set<string>,
  fallbackFactory: () => string,
): string {
  const trimmed = String(preferred || '').trim()
  if (trimmed && trimmed !== '未命名') {
    const key = trimmed.toLowerCase()
    if (!usedNames.has(key)) {
      usedNames.add(key)
      return trimmed
    }
  }

  let candidate = fallbackFactory()
  let guard = 0
  while (usedNames.has(candidate.toLowerCase()) && guard < 1000) {
    candidate = fallbackFactory()
    guard += 1
  }
  usedNames.add(candidate.toLowerCase())
  return candidate
}

function buildImageNodeMentionName(
  data: CanvasImageNodeData,
  usedNames: Set<string>,
): string {
  const entityName = String(data.entityName || '').trim()
  if (entityName) {
    return allocateCanvasMentionName(
      entityName,
      usedNames,
      () => generateCanvasDefaultImageName([...usedNames]),
    )
  }

  if (data.assetRoleConverted) {
    const role = data.assetRole ?? 'character'
    return allocateCanvasMentionName(
      data.imageName,
      usedNames,
      () => generateCanvasConvertedAssetName(role, [...usedNames]),
    )
  }

  return allocateCanvasMentionName(
    data.imageName,
    usedNames,
    () => generateCanvasDefaultImageName([...usedNames]),
  )
}

function resolveImageMentionKind(data: CanvasImageNodeData): MentionEntityType {
  return data.assetRoleConverted ? mapAssetRoleToMentionKind(data.assetRole) : 'image'
}

/** 自动@ 仅识别已标记的人物/场景/道具资产 */
export function filterCanvasAssetMentionCandidates(
  candidates: MentionCandidate[],
): MentionCandidate[] {
  return candidates.filter(
    (item) => item.kind === 'character' || item.kind === 'scene' || item.kind === 'prop',
  )
}

/** 用户正在手动输入 @ 引用（含仅 @ 或 @筛选词），此间勿跑自动@改写以免菜单无法弹出 */
export function isTypingCanvasManualMention(text: string): boolean {
  return /@[^\s@]*$/.test(normalizeMentionSource(text))
}

function resolveImageMentionDescription(
  data: CanvasImageNodeData,
  mentionName: string,
): string {
  const prompt = String(data.prompt || '').trim()
  if (prompt) return prompt
  if (data.assetRoleConverted) {
    const role = data.assetRole ?? 'character'
    return `${CANVAS_IMAGE_ROLE_MENTION_LABELS[role]}素材`
  }
  return `画布图片 ${mentionName}`
}

/** 人物图 → 音色节点连线：source 为人物图，target 为音色节点 */
export function findCanvasVoiceNodeBoundToImage(
  imageNodeId: string,
  nodes: Node[],
  edges: Edge[] = [],
): Node | undefined {
  for (const edge of edges) {
    if (edge.source === imageNodeId) {
      const target = nodes.find((node) => node.id === edge.target)
      if (target?.type === CANVAS_NODE_TYPES.voiceNode) return target
    }
    if (edge.target === imageNodeId) {
      const source = nodes.find((node) => node.id === edge.source)
      if (source?.type === CANVAS_NODE_TYPES.voiceNode) return source
    }
  }
  return undefined
}

/** 人物图音色：优先节点自身 voiceType，否则读连线音色节点（兜底） */
export function resolveCanvasImageNodeVoiceType(
  imageNodeId: string,
  nodes: Node[],
  edges: Edge[] = [],
  imageData?: Pick<CanvasImageNodeData, 'voiceType'>,
): string | undefined {
  const fromImage = String(imageData?.voiceType || '').trim()
  if (isLocalVoiceType(fromImage)) return fromImage

  const voiceNode = findCanvasVoiceNodeBoundToImage(imageNodeId, nodes, edges)
  if (!voiceNode) return undefined
  const fromVoice = String((voiceNode.data as CanvasVoiceNodeData).voiceType || '').trim()
  return isLocalVoiceType(fromVoice) ? fromVoice : undefined
}

/** 从画布节点构建 @ 引用候选（含未标记为人物/场景/道具的图片节点） */
export function buildCanvasMentionCandidates(
  nodes: Node[],
  voiceLibrary: VoiceLibraryEntry[] = [],
  edges: Edge[] = [],
): MentionCandidate[] {
  const candidates: MentionCandidate[] = []
  const usedNames = new Set<string>()
  let voiceIndex = 0

  for (const node of nodes) {
    if (node.type === CANVAS_NODE_TYPES.voiceNode) {
      const data = node.data as CanvasVoiceNodeData
      const voiceType = String(data.voiceType || '').trim()
      if (!voiceType || !isLocalVoiceType(voiceType)) continue

      voiceIndex += 1
      const voiceId = decodeLocalVoiceType(voiceType)
      const libraryEntry = voiceLibrary.find((item) => item.id === voiceId)
      const preferredName =
        data.voiceName?.trim() || libraryEntry?.name?.trim() || `音色${voiceIndex}`
      const mentionName = allocateCanvasMentionName(
        preferredName,
        usedNames,
        () => `音色${voiceIndex}`,
      )

      candidates.push({
        id: buildCanvasMentionId(node.id),
        name: mentionName,
        mentionName,
        kind: 'voice',
        description: '画布音色',
        voiceType,
        voiceLabel: mentionName,
        canvasNodeId: node.id,
      })
      continue
    }

    if (node.type === CANVAS_NODE_TYPES.imageNode) {
      const data = node.data as CanvasImageNodeData
      const path = resolveCanvasImageNodeStoredPath(data)
      if (!path) continue

      const mentionName = buildImageNodeMentionName(data, usedNames)
      const kind = resolveImageMentionKind(data)
      const voiceType =
        kind === 'character'
          ? resolveCanvasImageNodeVoiceType(node.id, nodes, edges, data)
          : undefined
      const voiceLabel =
        voiceType && voiceLibrary.length
          ? resolveVoiceLabel(voiceType, voiceLibrary) || undefined
          : voiceType
            ? '已绑定音色'
            : undefined
      candidates.push({
        id: buildCanvasMentionId(node.id),
        name: mentionName,
        mentionName,
        kind,
        description: resolveImageMentionDescription(data, mentionName),
        thumbnailPath: path,
        previewPaths: [path],
        canvasNodeId: node.id,
        canvasOwnerKind: data.outputOwnerKind ?? 'canvas',
        canvasOwnerProjectId: data.outputOwnerProjectId,
        voiceType,
        voiceLabel,
        syncedToLibrary: Boolean(
          (data as CanvasImageNodeData & { materialLibraryEntryId?: string }).materialLibraryEntryId,
        ),
      })
      continue
    }

    if (node.type === CANVAS_NODE_TYPES.referenceImage) {
      const data = node.data as CanvasReferenceImageNodeData
      const path = resolveReferenceImageNodeStoredPath(data)
      if (!path) continue

      const mentionName = allocateCanvasMentionName(
        undefined,
        usedNames,
        () => generateCanvasDefaultImageName([...usedNames]),
      )

      candidates.push({
        id: buildCanvasMentionId(node.id),
        name: mentionName,
        mentionName,
        kind: 'image',
        description: '画布参考图',
        thumbnailPath: path,
        previewPaths: [path],
        canvasNodeId: node.id,
        canvasOwnerKind: data.mediaOwnerKind ?? 'canvas',
        canvasOwnerProjectId: data.mediaOwnerProjectId,
      })
    }
  }

  return candidates
}

export function resolveCanvasMentionMediaLocation(
  candidateId: string,
  nodes: Node[],
): CanvasMediaLocation | null {
  const nodeId = parseCanvasMentionNodeId(candidateId)
  if (!nodeId) return null

  const node = nodes.find((item) => item.id === nodeId)
  if (!node) return null

  if (node.type === CANVAS_NODE_TYPES.imageNode) {
    const data = node.data as CanvasImageNodeData
    const path = resolveCanvasImageNodeStoredPath(data)
    if (!path) return null
    return {
      path,
      ownerKind: data.outputOwnerKind,
      ownerProjectId: data.outputOwnerProjectId,
    }
  }

  if (node.type === CANVAS_NODE_TYPES.referenceImage) {
    const data = node.data as CanvasReferenceImageNodeData
    const path = resolveReferenceImageNodeStoredPath(data)
    if (!path) return null
    return {
      path,
      ownerKind: data.mediaOwnerKind,
      ownerProjectId: data.mediaOwnerProjectId,
    }
  }

  return null
}

export function collectCanvasMentionImageSources(
  text: string,
  candidates: MentionCandidate[],
  nodes: Node[],
): CanvasMediaLocation[] {
  const sources: CanvasMediaLocation[] = []
  const seen = new Set<string>()

  for (const mention of resolveMentionsInText(text, candidates)) {
    if (mention.kind === 'voice') continue
    const location = resolveCanvasMentionMediaLocation(mention.id, nodes)
    if (!location) continue
    const key = `${location.ownerKind || 'canvas'}:${location.ownerProjectId || ''}:${location.path}`
    if (seen.has(key)) continue
    seen.add(key)
    sources.push(location)
  }

  return sources
}

function resolveVoiceLibraryAudioPath(
  voiceType: string | undefined,
  voiceLibrary: VoiceLibraryEntry[],
): string | undefined {
  const voiceId = decodeLocalVoiceType(voiceType)
  if (!voiceId) return undefined
  return voiceLibrary.find((item) => item.id === voiceId)?.referenceAudio?.trim() || undefined
}

function normalizeComparableAudioPath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

function findCanvasImageNodeByOutputPath(path: string, nodes: Node[]): Node | undefined {
  const key = normalizeComparableAudioPath(path)
  for (const node of nodes) {
    if (node.type !== CANVAS_NODE_TYPES.imageNode) continue
    const outputPath = resolveCanvasImageNodeStoredPath(node.data as CanvasImageNodeData)
    if (outputPath && normalizeComparableAudioPath(outputPath) === key) return node
  }
  return undefined
}

function findCanvasMentionCandidateByNodeId(
  nodeId: string,
  candidates: MentionCandidate[],
): MentionCandidate | undefined {
  return candidates.find((item) => item.canvasNodeId === nodeId)
}

function resolveCanvasVoiceTypeFromMention(
  mention: MentionCandidate,
  nodes: Node[],
  edges: Edge[] = [],
): string | undefined {
  const fromCandidate = String(mention.voiceType || '').trim()
  if (fromCandidate) return fromCandidate
  if (!mention.canvasNodeId) return undefined
  const node = nodes.find((item) => item.id === mention.canvasNodeId)
  if (!node) return undefined
  if (node.type === CANVAS_NODE_TYPES.voiceNode) {
    return String((node.data as CanvasVoiceNodeData).voiceType || '').trim() || undefined
  }
  if (node.type === CANVAS_NODE_TYPES.imageNode) {
    return resolveCanvasImageNodeVoiceType(
      node.id,
      nodes,
      edges,
      node.data as CanvasImageNodeData,
    )
  }
  return undefined
}

/** 从 @ 引用收集音色参考音频（含标签，供微视预览弹窗） */
export function collectCanvasMentionAudioItems(
  text: string,
  candidates: MentionCandidate[],
  nodes: Node[],
  voiceLibrary: VoiceLibraryEntry[],
): Array<{ label: string; path: string }> {
  const items: Array<{ label: string; path: string }> = []
  const seen = new Set<string>()

  for (const mention of resolveMentionsInText(text, candidates)) {
    if (mention.kind !== 'voice' && mention.kind !== 'character') continue
    const voiceType = resolveCanvasVoiceTypeFromMention(mention, nodes)
    const audioPath = resolveVoiceLibraryAudioPath(voiceType, voiceLibrary)
    if (!audioPath) continue
    const key = audioPath.replace(/\\/g, '/').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    items.push({
      label: mention.mentionName || mention.name || '参考音频',
      path: audioPath,
    })
  }

  return items
}

/** 从 @ 引用收集音色参考音频路径（视频生视频/多参） */
export function collectCanvasMentionAudioPaths(
  text: string,
  candidates: MentionCandidate[],
  nodes: Node[],
  voiceLibrary: VoiceLibraryEntry[],
): string[] {
  const paths: string[] = []
  const seen = new Set<string>()

  for (const mention of resolveMentionsInText(text, candidates)) {
    if (mention.kind === 'voice') {
      const voiceType = resolveCanvasVoiceTypeFromMention(mention, nodes)
      const audioPath = resolveVoiceLibraryAudioPath(voiceType, voiceLibrary)
      if (!audioPath) continue
      const key = audioPath.replace(/\\/g, '/').toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      paths.push(audioPath)
      continue
    }
    if (mention.kind === 'character') {
      const voiceType = resolveCanvasVoiceTypeFromMention(mention, nodes)
      const audioPath = resolveVoiceLibraryAudioPath(voiceType, voiceLibrary)
      if (!audioPath) continue
      const key = audioPath.replace(/\\/g, '/').toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      paths.push(audioPath)
    }
  }

  return paths
}

export function mergeCanvasMediaSources(
  ...lists: CanvasMediaLocation[][]
): CanvasMediaLocation[] {
  const result: CanvasMediaLocation[] = []
  const seen = new Set<string>()
  for (const list of lists) {
    for (const item of list) {
      const key = `${item.ownerKind || 'canvas'}:${item.ownerProjectId || ''}:${item.path}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push(item)
    }
  }
  return result
}

/** 视频生图：仅识别 @；自动@ 开启时才做二次名称识别 */
export function prepareCanvasVideoPromptContext(
  rawPrompt: string,
  nodes: Node[],
  options?: {
    voiceLibrary?: VoiceLibraryEntry[]
    edges?: Edge[]
    /** 输入框实时补 @ 时保留首尾空白，避免 trim 干扰编辑 */
    preserveWhitespace?: boolean
    /** 与参考条「自动@资产」一致；关闭时仅保留用户手写 @ */
    autoMentionEnabled?: boolean
  },
): {
  prompt: string
  mentionSources: CanvasMediaLocation[]
  candidates: MentionCandidate[]
} {
  const candidates = buildCanvasMentionCandidates(
    nodes,
    options?.voiceLibrary ?? [],
    options?.edges ?? [],
  )
  let prompt = options?.preserveWhitespace
    ? String(rawPrompt ?? '')
    : String(rawPrompt || '').trim()
  const assetCandidates = filterCanvasAssetMentionCandidates(candidates)
  if (options?.autoMentionEnabled !== false) {
    prompt = applySecondaryMentionRecognition(prompt, assetCandidates).text
  }
  const mentionSources = collectCanvasMentionImageSources(prompt, candidates, nodes)
  return { prompt, mentionSources, candidates }
}

/** 画布视频：仅收集描述中显式 @ 引用的音色/音频 */
export function buildCanvasVideoReferenceAudioItems(
  text: string,
  candidates: MentionCandidate[],
  nodes: Node[],
  voiceLibrary: VoiceLibraryEntry[],
  _referenceImageItems: ShotVideoReferenceItem[] = [],
  options?: {
    videoNodeId?: string
    edges?: Edge[]
    /** @deprecated 音色库路径已由 IPC 解析为绝对路径，保留兼容 */
    projectRoot?: string
  },
): ShotVideoReferenceAudioItem[] {
  const items: ShotVideoReferenceAudioItem[] = []
  const seenPaths = new Set<string>()

  const push = (
    path: string | undefined,
    label: string,
    source: ShotVideoReferenceAudioItem['source'],
    mentionName?: string,
  ) => {
    const trimmed = path?.trim()
    if (!trimmed) return
    const key = normalizeComparableAudioPath(trimmed)
    if (seenPaths.has(key)) return
    seenPaths.add(key)
    items.push({ label, path: trimmed, source, mentionName })
  }

  const pushCharacterVoice = (
    voiceType: string,
    mention: MentionCandidate | undefined,
    fallbackMentionName?: string,
  ) => {
    if (!isLocalVoiceType(voiceType)) return
    const audioPath = resolveVoiceLibraryAudioPath(voiceType, voiceLibrary)
    if (!audioPath) return
    const mentionName = mention?.mentionName || fallbackMentionName
    const voiceLabel =
      resolveVoiceLabel(voiceType, voiceLibrary) ||
      mention?.voiceLabel ||
      (mentionName ? `${mentionName}的音色` : '角色音色')
    push(audioPath, voiceLabel, 'character_voice', mentionName)
  }

  const edges = options?.edges ?? []

  for (const mention of resolveMentionsInText(text, candidates)) {
    const voiceType = resolveCanvasVoiceTypeFromMention(mention, nodes, edges)
    if (!voiceType || !isLocalVoiceType(voiceType)) continue
    const audioPath = resolveVoiceLibraryAudioPath(voiceType, voiceLibrary)
    if (!audioPath) continue

    if (mention.kind === 'voice') {
      push(audioPath, mention.mentionName || mention.name || '参考音频', 'upload', mention.mentionName)
      continue
    }

    pushCharacterVoice(voiceType, mention)
  }

  return items.slice(0, MAX_REFERENCE_AUDIOS)
}

function mentionLabelDisplayName(label: string): string | undefined {
  const trimmed = label.trim()
  const matched = trimmed.match(/^@([^（(]+)/)
  return matched?.[1]?.trim() || undefined
}

/**
 * 收集引用图 + 可选自动@ + 补充资产描述。
 * `autoMentionEnabled` 默认 false：仅手写 @ / 连线 / 控制台上传参考图才带图（避免静默 edits）。
 */
export function prepareCanvasPromptWithMentions(
  rawPrompt: string,
  nodes: Node[],
  options?: {
    voiceLibrary?: VoiceLibraryEntry[]
    edges?: Edge[]
    autoMentionEnabled?: boolean
  },
): {
  prompt: string
  mentionSources: CanvasMediaLocation[]
  candidates: MentionCandidate[]
} {
  const candidates = buildCanvasMentionCandidates(
    nodes,
    options?.voiceLibrary ?? [],
    options?.edges ?? [],
  )
  let prompt = String(rawPrompt || '').trim()
  const assetCandidates = filterCanvasAssetMentionCandidates(candidates)
  if (options?.autoMentionEnabled) {
    prompt = applySecondaryMentionRecognition(prompt, assetCandidates).text
  }
  const mentionSources = collectCanvasMentionImageSources(prompt, candidates, nodes)
  if (resolveMentionsInText(prompt, candidates).length) {
    prompt = enrichPromptWithMentions(prompt, candidates)
  }
  return { prompt, mentionSources, candidates }
}

/** 控制台上传参考图 → 媒体定位（画布项目内相对路径） */
export function canvasConsoleReferencePathsToMediaLocations(
  paths: string[] | undefined,
  canvasProjectId: string,
): CanvasMediaLocation[] {
  const projectId = String(canvasProjectId || '').trim()
  const result: CanvasMediaLocation[] = []
  const seen = new Set<string>()
  for (const raw of paths ?? []) {
    const path = String(raw || '').trim()
    if (!path) continue
    const key = path.replace(/\\/g, '/').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push({
      path,
      ownerKind: 'canvas',
      ownerProjectId: projectId || undefined,
    })
  }
  return result
}

function canvasReferenceAssetKey(
  asset: Pick<CanvasUpstreamReferenceAsset, 'path' | 'ownerKind' | 'ownerProjectId'>,
): string {
  return `${asset.ownerKind || 'canvas'}:${asset.ownerProjectId || ''}:${asset.path.replace(/\\/g, '/').toLowerCase()}`
}

function imageMentionCandidatesForRefBar(candidates: MentionCandidate[]): MentionCandidate[] {
  return candidates.filter(
    (item) =>
      item.kind === 'character' ||
      item.kind === 'scene' ||
      item.kind === 'prop' ||
      item.kind === 'image',
  )
}

function mentionToReferenceBarLabel(mention: MentionCandidate): string {
  if (mention.kind === 'character' || mention.kind === 'scene' || mention.kind === 'prop') {
    return `${mentionKindLabel(mention.kind)} · ${mention.mentionName}`
  }
  return mention.mentionName || mention.name || '参考图'
}

/** 视频控制台参考条：连线资产 + 描述中 @ 引用的画布资产 + 本地上传 */
export function collectCanvasVideoReferenceBarAssets(options: {
  videoNodeId: string
  prompt: string
  nodes: Node[]
  edges: Edge[]
  mentionCandidates: MentionCandidate[]
  consoleReferenceImagePaths?: string[]
}): CanvasUpstreamReferenceAsset[] {
  const mentionNameByNodeId = new Map(
    options.mentionCandidates
      .filter((item) => item.canvasNodeId)
      .map((item) => [item.canvasNodeId!, item.mentionName]),
  )

  const result = collectUpstreamReferenceAssets(
    options.videoNodeId,
    options.nodes,
    options.edges,
    mentionNameByNodeId,
  )
  const seen = new Set(result.map((item) => canvasReferenceAssetKey(item)))

  const imageCandidates = imageMentionCandidatesForRefBar(options.mentionCandidates)
  // 参考条仅展示显式 @ 引用，不做二次名称识别（避免删掉连线/@ 后仍残留）
  const promptForMentions = String(options.prompt || '')

  for (const mention of resolveMentionsInText(promptForMentions, imageCandidates)) {
    const path = (mention.thumbnailPath || mention.previewPaths?.[0])?.trim()
    if (!path) continue

    const asset: CanvasUpstreamReferenceAsset = {
      nodeId: mention.canvasNodeId || mention.id,
      label: mentionToReferenceBarLabel(mention),
      path,
      ownerKind: mention.canvasOwnerKind,
      ownerProjectId: mention.canvasOwnerProjectId,
      mentionName: mention.mentionName,
      isMarkedAsset:
        mention.kind === 'character' || mention.kind === 'scene' || mention.kind === 'prop',
      source: 'mention',
    }
    const key = canvasReferenceAssetKey(asset)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(asset)
  }

  const uploads = options.consoleReferenceImagePaths ?? []
  uploads.forEach((rawPath, index) => {
    const path = String(rawPath || '').trim()
    if (!path) return
    const asset: CanvasUpstreamReferenceAsset = {
      nodeId: `${options.videoNodeId}_upload_${index}`,
      label: uploads.length > 1 ? `参考图 ${index + 1}` : '参考图',
      path,
      ownerKind: 'canvas',
      isMarkedAsset: false,
      source: 'upload',
      removable: true,
      uploadIndex: index,
    }
    const key = canvasReferenceAssetKey(asset)
    if (seen.has(key)) return
    seen.add(key)
    result.push(asset)
  })

  return result
}

/** 描述中显式 @ 引用的人物/场景/道具（参考条下方标签行） */
export function collectCanvasVideoPromptMentionAssets(options: {
  prompt: string
  mentionCandidates: MentionCandidate[]
}): MentionCandidate[] {
  const assetCandidates = filterCanvasAssetMentionCandidates(options.mentionCandidates)
  return resolveMentionsInText(String(options.prompt || ''), assetCandidates)
}
