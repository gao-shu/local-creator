// Copyright (c) Haode AI. All rights reserved.

import { parseMentionSpans, type MentionCandidate } from '@/lib/workflow/mention-utils'
import {
  buildUploadVoiceBodyReplacementEntries,
  type ShotVideoReferenceAudioItem,
} from '@/lib/workflow/shot-audio-reference-utils'
import type { ShotVideoReferenceItem, ShotVideoReferenceKind } from '@/lib/workflow/shot-video-utils'

type WeishiPromptAsset =
  | {
      type: 'image'
      placeholderIndex: number
      kind: ShotVideoReferenceKind
      label: string
      mentionName?: string
      displayName: string
    }
  | {
      type: 'audio'
      placeholderIndex: number
      label: string
      linkedMentionName?: string
      linkedImagePlaceholderIndex?: number
    }

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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

function weishiImagePlaceholderToken(index: number): string {
  return `@图${index}`
}

function weishiAudioPlaceholderToken(index: number): string {
  return `@${index}`
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

function resolveImageDisplayName(item: ShotVideoReferenceItem): string {
  if (item.kind === 'storyboard') return '当前分镜图'
  if (item.kind === 'end_frame') return '尾帧参考'
  if (item.kind === 'shot_reference') {
    return item.label.replace(/^分镜参考\s*/, '') || '分镜参考'
  }
  return mentionLabelDisplayName(item.label) || item.label
}

function parseAudioLinkedMention(label: string): string | undefined {
  const matched = label.match(/@([\u4e00-\u9fff\w.·-]+)/)
  return matched?.[1]?.trim() || undefined
}

/** 与 collectWeishiReferences 一致：先全部参考图，再全部参考音频 */
function buildWeishiPromptOrderedAssets(
  imageItems: ShotVideoReferenceItem[],
  audioItems: ShotVideoReferenceAudioItem[],
): WeishiPromptAsset[] {
  const assets: WeishiPromptAsset[] = []
  let index = 0

  for (const item of imageItems) {
    index += 1
    const mentionName = item.kind === 'mention' ? mentionLabelDisplayName(item.label) : undefined
    assets.push({
      type: 'image',
      placeholderIndex: index,
      kind: item.kind,
      label: item.label,
      mentionName: mentionName || undefined,
      displayName: resolveImageDisplayName(item),
    })
  }

  const imageIndexByMention = new Map<string, number>()
  for (const asset of assets) {
    if (asset.type === 'image' && asset.mentionName) {
      imageIndexByMention.set(asset.mentionName, asset.placeholderIndex)
    }
  }

  for (const item of audioItems) {
    index += 1
    const linkedMentionName =
      item.source === 'character_voice'
        ? item.mentionName || parseAudioLinkedMention(item.label)
        : undefined
    assets.push({
      type: 'audio',
      placeholderIndex: index,
      label: item.label,
      linkedMentionName,
      linkedImagePlaceholderIndex: linkedMentionName
        ? imageIndexByMention.get(linkedMentionName)
        : undefined,
    })
  }

  return assets
}

function buildWeishiImageHeaderLine(
  asset: Extract<WeishiPromptAsset, { type: 'image' }>,
  isPrimaryScene: boolean,
): string {
  const token = weishiImagePlaceholderToken(asset.placeholderIndex)
  const name = asset.displayName

  if (asset.kind === 'storyboard') {
    return `${token}作为首帧参考`
  }
  if (asset.kind === 'end_frame') {
    return `${token}作为尾帧参考`
  }
  if (asset.kind === 'shot_reference') {
    return `${token}作为参考图`
  }

  const kind = mentionKindFromRefLabel(asset.label)
  if (kind === 'character') return `${token}作为${name}角色固定参考`
  if (kind === 'scene') {
    return isPrimaryScene ? `${token}作为主要场景参考` : `${token}作为${name}场景参考`
  }
  if (kind === 'prop') return `${token}作为${name}道具参考`
  return `${token}作为参考图`
}

function buildWeishiAudioHeaderLine(asset: Extract<WeishiPromptAsset, { type: 'audio' }>): string {
  const token = weishiAudioPlaceholderToken(asset.placeholderIndex)
  if (asset.linkedMentionName) {
    return `${token}作为${asset.linkedMentionName}声音参考`
  }
  const name = asset.label.replace(/^上传音色：/, '').trim() || '上传音色'
  return `${token}作为${name}声音参考`
}

function buildCharacterConsistencyBlock(
  characterAssets: Extract<WeishiPromptAsset, { type: 'image' }>[],
): string {
  if (!characterAssets.length) return ''

  const lockParts = characterAssets.map(
    (asset) =>
      `将${weishiImagePlaceholderToken(asset.placeholderIndex)}严格固定为${asset.displayName}`,
  )
  const consistencyTail =
    characterAssets.length === 1
      ? '全程保持其外貌、五官、身材、服饰高度一致，不换脸、不漂移'
      : characterAssets.length === 2
        ? '全程保持两人外貌、五官、身材、服饰高度一致，不换脸、不漂移'
        : '全程保持各角色外貌、五官、身材、服饰高度一致，不换脸、不漂移'

  return `${lockParts.join('，')}，${consistencyTail}`
}

function buildWeishiPlaceholderHeader(assets: WeishiPromptAsset[]): string {
  const imageAssets = assets.filter(
    (asset): asset is Extract<WeishiPromptAsset, { type: 'image' }> => asset.type === 'image',
  )
  const audioAssets = assets.filter(
    (asset): asset is Extract<WeishiPromptAsset, { type: 'audio' }> => asset.type === 'audio',
  )

  let primarySceneAssigned = false
  const imageLines: string[] = []
  const characterAssets: Extract<WeishiPromptAsset, { type: 'image' }>[] = []

  for (const asset of imageAssets) {
    const kind = asset.kind === 'mention' ? mentionKindFromRefLabel(asset.label) : null
    const isPrimaryScene = kind === 'scene' && !primarySceneAssigned
    if (isPrimaryScene) primarySceneAssigned = true
    imageLines.push(buildWeishiImageHeaderLine(asset, isPrimaryScene))
    if (kind === 'character') characterAssets.push(asset)
  }

  const sections: string[] = []
  if (imageLines.length) sections.push(`${imageLines.join('，')}。`)

  if (audioAssets.length) {
    sections.push(`${audioAssets.map(buildWeishiAudioHeaderLine).join('，')}。`)
  }

  const consistency = buildCharacterConsistencyBlock(characterAssets)
  if (consistency) {
    if (sections.length) sections.push('')
    sections.push(`${consistency}。`)
  }

  return sections.join('\n')
}

function replaceMentionsWithWeishiPlaceholders(
  prompt: string,
  imageItems: ShotVideoReferenceItem[],
  assets: WeishiPromptAsset[],
): string {
  const indexByMention = new Map<string, number>()
  for (const asset of assets) {
    if (asset.type !== 'image' || !asset.mentionName) continue
    indexByMention.set(asset.mentionName, asset.placeholderIndex)
  }
  if (!indexByMention.size) return prompt

  const candidates = mentionCandidatesFromRefItems(imageItems)
  const spans = parseMentionSpans(prompt, candidates)
  if (!spans.length) return prompt

  let text = prompt
  for (const span of [...spans].sort((a, b) => b.start - a.start)) {
    const mentionName = span.candidate?.mentionName || span.name
    const imageIndex = indexByMention.get(mentionName)
    if (imageIndex === undefined) continue
    text = text.slice(0, span.start) + weishiImagePlaceholderToken(imageIndex) + text.slice(span.end)
  }

  return text
}

function replaceUploadVoiceMentionsInBody(
  prompt: string,
  audioItems: ShotVideoReferenceAudioItem[],
  assets: WeishiPromptAsset[],
): string {
  const audioAssets = assets.filter(
    (asset): asset is Extract<WeishiPromptAsset, { type: 'audio' }> => asset.type === 'audio',
  )
  const placeholderIndexes = audioItems.map((_, index) => audioAssets[index]?.placeholderIndex ?? 0)
  const entries = buildUploadVoiceBodyReplacementEntries(audioItems, placeholderIndexes)
  if (!entries.length) return prompt

  let text = prompt
  for (const entry of entries) {
    const re = new RegExp(`@${escapeRegExp(entry.key)}(?![\\u4e00-\\u9fffA-Za-z0-9_·-])`, 'g')
    text = text.replace(re, weishiAudioPlaceholderToken(entry.placeholderIndex))
  }
  return text
}

function replaceVoiceMentionsWithWeishiPlaceholders(
  prompt: string,
  audioItems: ShotVideoReferenceAudioItem[],
  assets: WeishiPromptAsset[],
): string {
  let text = replaceUploadVoiceMentionsInBody(prompt, audioItems, assets)
  const voiceCandidates = buildUploadedVoiceMentionCandidatesFromAudioItems(audioItems)
  if (!voiceCandidates.length) return text

  const audioAssets = assets.filter(
    (asset): asset is Extract<WeishiPromptAsset, { type: 'audio' }> => asset.type === 'audio',
  )
  const indexByVoiceId = new Map<string, number>()
  audioItems.forEach((item, index) => {
    if (item.source !== 'upload') return
    const placeholderIndex = audioAssets[index]?.placeholderIndex
    if (!placeholderIndex) return
    indexByVoiceId.set(item.path, placeholderIndex)
  })

  const spans = parseMentionSpans(text, voiceCandidates)
  if (!spans.length) return text

  for (const span of [...spans].sort((a, b) => b.start - a.start)) {
    const voiceItem = audioItems.find(
      (item) =>
        item.source === 'upload' &&
        span.candidate?.id === `voice_ref:${item.path.trim()}`,
    )
    if (!voiceItem) continue
    const placeholderIndex = indexByVoiceId.get(voiceItem.path)
    if (!placeholderIndex) continue
    text =
      text.slice(0, span.start) +
      weishiAudioPlaceholderToken(placeholderIndex) +
      text.slice(span.end)
  }

  return text
}

function buildUploadedVoiceMentionCandidatesFromAudioItems(
  audioItems: ShotVideoReferenceAudioItem[],
): MentionCandidate[] {
  const candidates: MentionCandidate[] = []
  for (const item of audioItems) {
    if (item.source !== 'upload') continue
    const id = `voice_ref:${item.path.trim()}`
    candidates.push({
      id,
      name: item.label,
      mentionName: item.mentionName || item.label,
      kind: 'voice',
      description: '上传音色',
    })
  }
  return candidates
}

export interface ComposeWeishiVideoPromptInput {
  shotBody: string
  imageItems: ShotVideoReferenceItem[]
  audioItems: ShotVideoReferenceAudioItem[]
  /** 前设置（项目固定前缀） */
  prefix?: string
  /** 后设置（项目固定后缀） */
  suffix?: string
}

/**
 * 微视生视频完整提示词：
 * @图N 参考声明 → 前设置 → 分镜正文 → 后设置。
 */
export function composeWeishiVideoPrompt(input: ComposeWeishiVideoPromptInput): string {
  const { shotBody, imageItems, audioItems, prefix, suffix } = input

  const pre = prefix?.trim()
  const suf = suffix?.trim()
  const sections: string[] = []

  let bodyText = shotBody.trim()
  const alreadyHasHeader = /^@图\d+作为/.test(bodyText)

  if (imageItems.length > 0 && bodyText) {
    const assets = buildWeishiPromptOrderedAssets(imageItems, audioItems)
    const header = buildWeishiPlaceholderHeader(assets)
    if (!alreadyHasHeader && header && !bodyText.includes(header)) {
      bodyText = replaceMentionsWithWeishiPlaceholders(bodyText, imageItems, assets).trim()
      bodyText = replaceVoiceMentionsWithWeishiPlaceholders(bodyText, audioItems, assets).trim()
      sections.push(header)
    } else if (!alreadyHasHeader) {
      bodyText = replaceMentionsWithWeishiPlaceholders(bodyText, imageItems, assets).trim()
      bodyText = replaceVoiceMentionsWithWeishiPlaceholders(bodyText, audioItems, assets).trim()
    }
  }

  if (pre && !sections.join('\n\n').includes(pre)) {
    sections.push(pre)
  }

  if (bodyText) sections.push(bodyText)

  if (suf && !sections.join('\n\n').includes(suf)) {
    sections.push(suf)
  }

  return sections.filter(Boolean).join('\n\n')
}

/**
 * 对齐画镜 Seedance 多参：头部声明各 @图N / @N 参考用途与角色固定约束，正文 @ 替换为 @图N / @N。
 * 占位序号与 content[] 中 image_url / audio_url 顺序一致（先图后音频）。
 */
export function enrichWeishiVideoPromptWithPlaceholders(
  prompt: string,
  imageItems: ShotVideoReferenceItem[],
  audioItems: ShotVideoReferenceAudioItem[],
): string {
  return composeWeishiVideoPrompt({ shotBody: prompt, imageItems, audioItems })
}
