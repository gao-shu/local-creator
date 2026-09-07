// Copyright (c) Haode AI. All rights reserved.

import { textIncludesAssetFullName } from '@/lib/workflow/asset-utils'
import {
  resolveMentionsInText,
  type MentionCandidate,
  type MentionEntityType,
} from '@/lib/workflow/mention-utils'
import type { WorkflowShot } from '@/types/workflow'

export type ShotAssetMatchSource = 'mention' | 'dialogue' | 'prompt_text'

/** 分镜资产匹配仅精确命中（@ 引用或文案含完整资产名） */
export type ShotAssetMatchConfidence = 'high'

export interface ShotAssetMatch {
  assetId: string
  kind: MentionEntityType
  mentionName: string
  confidence: ShotAssetMatchConfidence
  source: ShotAssetMatchSource
  evidence: string
}

export interface MatchShotAssetsOptions {
  includeDialogue?: boolean
  includePromptPlainText?: boolean
  excludeAssetIds?: string[]
}

const ASSET_KINDS = new Set<MentionEntityType>(['character', 'scene', 'prop'])

function isAssetCandidate(candidate: MentionCandidate): boolean {
  return ASSET_KINDS.has(candidate.kind)
}

function filterAssetCandidates(
  candidates: MentionCandidate[],
  excludeAssetIds?: string[],
): MentionCandidate[] {
  const exclude = new Set(excludeAssetIds ?? [])
  return candidates.filter((item) => isAssetCandidate(item) && !exclude.has(item.id))
}

function upsertMatch(
  results: Map<string, ShotAssetMatch>,
  candidate: MentionCandidate,
  match: Omit<ShotAssetMatch, 'assetId' | 'kind' | 'mentionName'>,
): void {
  if (results.has(candidate.id)) return
  results.set(candidate.id, {
    assetId: candidate.id,
    kind: candidate.kind,
    mentionName: candidate.mentionName,
    ...match,
  })
}

/** 仅当文案包含完整资产名时匹配（不做前后缀 token 模糊） */
function scanTextForAssets(
  results: Map<string, ShotAssetMatch>,
  text: string,
  candidates: MentionCandidate[],
  source: ShotAssetMatchSource,
): void {
  const trimmed = text.trim()
  if (!trimmed) return

  for (const candidate of candidates) {
    if (results.has(candidate.id)) continue
    const fullName = candidate.mentionName.trim()
    if (!fullName || !textIncludesAssetFullName(fullName, trimmed)) continue
    upsertMatch(results, candidate, {
      confidence: 'high',
      source,
      evidence: fullName,
    })
  }
}

/** 从分镜文案中精确匹配本集资产（@ 引用、完整资产名出现在标题/提示词） */
export function matchShotAssets(
  shot: WorkflowShot,
  candidates: MentionCandidate[],
  options?: MatchShotAssetsOptions,
): ShotAssetMatch[] {
  const includeDialogue = options?.includeDialogue !== false
  const includePromptPlainText = options?.includePromptPlainText !== false
  const assetCandidates = filterAssetCandidates(candidates, options?.excludeAssetIds)
  const results = new Map<string, ShotAssetMatch>()

  const mentionText = [shot.spatialAnchor, shot.prompt].filter(Boolean).join('\n')
  for (const mention of resolveMentionsInText(mentionText, candidates)) {
    if (!isAssetCandidate(mention)) continue
    upsertMatch(results, mention, {
      confidence: 'high',
      source: 'mention',
      evidence: `@${mention.mentionName}`,
    })
  }

  if (includeDialogue) {
    scanTextForAssets(results, shot.dialogue, assetCandidates, 'dialogue')
  }

  if (includePromptPlainText) {
    const promptBundle = [shot.spatialAnchor, shot.prompt].filter(Boolean).join('\n')
    scanTextForAssets(results, promptBundle, assetCandidates, 'prompt_text')
  }

  return [...results.values()]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 将纯文本中的资产名替换为 @引用（与画镜一致：提示词内可见高亮） */
function injectMentionsIntoText(text: string, names: string[]): string {
  if (!text || !names.length) return text
  let result = text
  for (const name of names) {
    const trimmed = name.trim()
    if (trimmed.length < 2) continue
    const escaped = escapeRegExp(trimmed)
    result = result.replace(new RegExp(`(?<!@)${escaped}`, 'g'), `@${trimmed}`)
  }
  return result
}

/** 根据匹配结果，把分镜标题/提示词中的纯文本资产名写成 @引用 */
export function injectMentionsIntoShot(
  shot: WorkflowShot,
  candidates: MentionCandidate[],
): WorkflowShot {
  const matches = matchShotAssets(shot, candidates)
  if (!matches.length) return shot
  const names = [...new Set(matches.map((item) => item.mentionName.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  )
  const dialogue = injectMentionsIntoText(shot.dialogue, names)
  const prompt = injectMentionsIntoText(shot.prompt, names)
  const spatialAnchor = shot.spatialAnchor
    ? injectMentionsIntoText(shot.spatialAnchor, names)
    : shot.spatialAnchor
  if (
    dialogue === shot.dialogue &&
    prompt === shot.prompt &&
    spatialAnchor === shot.spatialAnchor
  ) {
    return shot
  }
  return { ...shot, dialogue, prompt, spatialAnchor }
}

export function shotAssetSyncEqual(a: WorkflowShot, b: WorkflowShot): boolean {
  return (
    a.dialogue === b.dialogue &&
    a.prompt === b.prompt &&
    a.spatialAnchor === b.spatialAnchor &&
    referencedAssetIdsEqual(a.referencedAssetIds, b.referencedAssetIds)
  )
}
export function autoSyncShotReferencedAssets(
  shot: WorkflowShot,
  candidates: MentionCandidate[],
): WorkflowShot {
  const withMentions = injectMentionsIntoShot(shot, candidates)
  const matches = matchShotAssets(withMentions, candidates)
  const nextIds = matches.length ? matches.map((item) => item.assetId) : undefined
  const next: WorkflowShot = {
    ...withMentions,
    referencedAssetIds: nextIds,
    updatedAt: Date.now(),
  }
  if (shotAssetSyncEqual(shot, next)) return shot
  return next
}

export function autoSyncEpisodeShotsReferencedAssets(
  shots: WorkflowShot[],
  candidates: MentionCandidate[],
): WorkflowShot[] {
  return shots.map((shot) => autoSyncShotReferencedAssets(shot, candidates))
}

export function referencedAssetIdsEqual(a?: string[], b?: string[]): boolean {
  const left = [...(a ?? [])].sort()
  const right = [...(b ?? [])].sort()
  if (left.length !== right.length) return false
  return left.every((id, index) => id === right[index])
}
