// Copyright (c) haode-ai-client. All rights reserved.

import type { WeishiVideoReferenceItem } from '@/lib/models/weishi-video-client'
import {
  getGeneratedImagePaths,
  getReferenceImagePaths,
  isSameAssetMediaPath,
  normalizeAssetMediaPath,
  updateAssetList,
} from '@/lib/workflow/asset-utils'
import {
  resolveMentionsInText,
  type MentionCandidate,
} from '@/lib/workflow/mention-utils'
import type { ShotVideoReferenceKind } from '@/lib/workflow/shot-video-utils'
import type {
  AssetListKey,
  WeishiShotMediaEntry,
  WorkflowAsset,
  WorkflowProjectData,
  WorkflowShot,
} from '@/types/workflow'

export type { WeishiShotMediaEntry }

export interface WeishiUploadPersistRefItem {
  path: string
  kind: ShotVideoReferenceKind
  sourceAssetId?: string
  /** 上传前是否已有可复用的 asset:// */
  weishiAssetUrl?: string
}

export interface WeishiShotMediaContextOptions {
  mentionCandidates?: MentionCandidate[]
  characters?: WorkflowAsset[]
  scenes?: WorkflowAsset[]
  props?: WorkflowAsset[]
}

function parseWeishiAssetId(url: string): string {
  const trimmed = String(url || '').trim()
  if (!/^asset:\/\//i.test(trimmed)) return trimmed
  return trimmed.replace(/^asset:\/\//i, '')
}

function normalizeEndpoint(endpoint?: string): string {
  return String(endpoint || '').trim()
}

function isWeishiEndpointCompatible(entryEndpoint?: string, currentEndpoint?: string): boolean {
  const current = normalizeEndpoint(currentEndpoint)
  const stored = normalizeEndpoint(entryEndpoint)
  if (!current || !stored) return true
  return stored === current
}

function findAssetLocation(
  assetId: string,
  characters: WorkflowAsset[],
  scenes: WorkflowAsset[],
  props: WorkflowAsset[],
): { listKey: AssetListKey; asset: WorkflowAsset } | null {
  if (characters.some((item) => item.id === assetId)) {
    return { listKey: 'characters', asset: characters.find((item) => item.id === assetId)! }
  }
  if (scenes.some((item) => item.id === assetId)) {
    return { listKey: 'scenes', asset: scenes.find((item) => item.id === assetId)! }
  }
  if (props.some((item) => item.id === assetId)) {
    return { listKey: 'props', asset: props.find((item) => item.id === assetId)! }
  }
  return null
}

function buildAssetReviewPatchFromUpload(
  localPath: string,
  assetUrl: string,
): Pick<
  WorkflowAsset,
  'weishiAssetId' | 'weishiAssetUrl' | 'weishiAssetStatus' | 'reviewImagePath'
> {
  const weishiAssetUrl = String(assetUrl || '').trim()
  const weishiAssetId = parseWeishiAssetId(weishiAssetUrl)
  return {
    weishiAssetId,
    weishiAssetUrl,
    weishiAssetStatus: 'active',
    reviewImagePath: normalizeAssetMediaPath(localPath),
  }
}

function getShotMentionText(shot: WorkflowShot): string {
  return [shot.spatialAnchor, shot.prompt].filter(Boolean).join('\n')
}

/** 当前分镜仍可能引用的本地图路径（用于缓存 prune） */
export function collectShotBoundWeishiMediaPaths(
  shot: WorkflowShot,
  options?: WeishiShotMediaContextOptions,
): string[] {
  const paths = new Set<string>()
  const push = (value?: string) => {
    const normalized = normalizeAssetMediaPath(value)
    if (normalized) paths.add(normalized)
  }

  for (const path of getGeneratedImagePaths(shot)) push(path)
  for (const path of getReferenceImagePaths(shot)) push(path)

  const candidates = options?.mentionCandidates ?? []
  const mentionText = getShotMentionText(shot)
  for (const mention of resolveMentionsInText(mentionText, candidates)) {
    push(mention.thumbnailPath || mention.previewPaths?.[0])
  }

  return [...paths]
}

/** 移除已废弃路径 / 不匹配 endpoint 的缓存条目 */
export function buildWeishiUploadedMediaPrunePatch(
  shot: WorkflowShot,
  options?: WeishiShotMediaContextOptions & { endpoint?: string; activePaths?: string[] },
): Partial<WorkflowShot> {
  const prev = shot.weishiUploadedMedia ?? []
  if (!prev.length) return {}

  const activePaths = options?.activePaths ?? collectShotBoundWeishiMediaPaths(shot, options)
  const endpoint = normalizeEndpoint(options?.endpoint)

  const next = prev.filter((entry) => {
    if (!isWeishiEndpointCompatible(entry.endpoint, endpoint)) return false
    return activePaths.some((path) => isSameAssetMediaPath(path, entry.localPath))
  })

  if (next.length === prev.length) return {}
  return {
    weishiUploadedMedia: next.length ? next : undefined,
    updatedAt: Date.now(),
  }
}

/** 分镜图/参考图变更时合并 patch 并 prune 过期缓存 */
export function mergeShotPatchWithWeishiPrune(
  shot: WorkflowShot,
  patch: Partial<WorkflowShot>,
  options?: WeishiShotMediaContextOptions & { endpoint?: string },
): Partial<WorkflowShot> {
  const merged: WorkflowShot = { ...shot, ...patch, updatedAt: patch.updatedAt ?? Date.now() }
  const prunePatch = buildWeishiUploadedMediaPrunePatch(merged, {
    ...options,
    activePaths: collectShotBoundWeishiMediaPaths(merged, options),
  })
  return { ...patch, ...prunePatch }
}

/** 从分镜已持久化的微视上传记录中解析 asset:// */
export function resolveWeishiShotMediaUrl(
  shot: Pick<WorkflowShot, 'weishiUploadedMedia'>,
  imagePath?: string,
  endpoint?: string,
): string | null {
  const target = normalizeAssetMediaPath(imagePath)
  if (!target || !shot.weishiUploadedMedia?.length) return null

  const hit = shot.weishiUploadedMedia.find(
    (entry) =>
      isSameAssetMediaPath(entry.localPath, target) &&
      isWeishiEndpointCompatible(entry.endpoint, endpoint),
  )
  const url = hit?.weishiAssetUrl?.trim()
  if (url && /^asset:\/\//i.test(url)) return url
  if (hit?.weishiAssetId?.trim()) return `asset://${hit.weishiAssetId.trim()}`
  return null
}

/**
 * 生视频 /v1/assets 上传成功后双写：
 * 1. 分镜 weishiUploadedMedia（分镜图/参考槽，不含 @ 资产冗余）
 * 2. @ 引用资产 weishiAssetId / reviewImagePath（与 Step3 同步审核字段一致）
 */
export function buildWeishiUploadPersistPatches(input: {
  shot: WorkflowShot
  refItems: WeishiUploadPersistRefItem[]
  preparedReferences: WeishiVideoReferenceItem[]
  characters: WorkflowAsset[]
  scenes: WorkflowAsset[]
  props: WorkflowAsset[]
  endpoint?: string
}): {
  shotPatch: Partial<WorkflowShot>
  dataPatch: Partial<Pick<WorkflowProjectData, 'characters' | 'scenes' | 'props'>>
} {
  const imageRefs = input.preparedReferences.filter(
    (ref) => ref.type === 'image_url' && /^asset:\/\//i.test(String(ref.url || '')),
  )
  if (!input.refItems.length || !imageRefs.length) {
    return { shotPatch: {}, dataPatch: {} }
  }

  const endpoint = normalizeEndpoint(input.endpoint)
  let characters = input.characters
  let scenes = input.scenes
  let props = input.props
  let nextShotMedia = [...(input.shot.weishiUploadedMedia ?? [])]
  let shotChanged = false
  let assetChanged = false

  const upsertShotMedia = (localPath: string, assetUrl: string) => {
    const normalized = normalizeAssetMediaPath(localPath)
    if (!normalized || !assetUrl) return
    const assetId = parseWeishiAssetId(assetUrl)
    const idx = nextShotMedia.findIndex((entry) => isSameAssetMediaPath(entry.localPath, normalized))
    const row: WeishiShotMediaEntry = {
      localPath: normalized,
      weishiAssetId: assetId,
      weishiAssetUrl: assetUrl,
      endpoint: endpoint || undefined,
    }
    if (idx >= 0) {
      const prev = nextShotMedia[idx]!
      if (
        prev.weishiAssetId === row.weishiAssetId &&
        prev.weishiAssetUrl === row.weishiAssetUrl &&
        isSameAssetMediaPath(prev.localPath, row.localPath) &&
        isWeishiEndpointCompatible(prev.endpoint, endpoint)
      ) {
        return
      }
      nextShotMedia[idx] = row
    } else {
      nextShotMedia.push(row)
    }
    shotChanged = true
  }

  const upsertWorkflowAsset = (workflowAssetId: string, localPath: string, assetUrl: string) => {
    const located = findAssetLocation(workflowAssetId, characters, scenes, props)
    if (!located) return

    const reviewPatch = buildAssetReviewPatchFromUpload(localPath, assetUrl)
    const current = located.asset
    const unchanged =
      current.weishiAssetId === reviewPatch.weishiAssetId &&
      current.weishiAssetUrl === reviewPatch.weishiAssetUrl &&
      isSameAssetMediaPath(current.reviewImagePath, reviewPatch.reviewImagePath)

    if (unchanged) return

    if (located.listKey === 'characters') {
      characters = updateAssetList(characters, workflowAssetId, reviewPatch)
    } else if (located.listKey === 'scenes') {
      scenes = updateAssetList(scenes, workflowAssetId, reviewPatch)
    } else {
      props = updateAssetList(props, workflowAssetId, reviewPatch)
    }
    assetChanged = true
  }

  const count = Math.min(input.refItems.length, imageRefs.length)
  for (let i = 0; i < count; i += 1) {
    const refItem = input.refItems[i]!
    const localPath = refItem.path
    const assetUrl = String(imageRefs[i]!.url)
    const hadCachedAsset = /^asset:\/\//i.test(String(refItem.weishiAssetUrl || '').trim())

    if (refItem.kind !== 'mention') {
      upsertShotMedia(localPath, assetUrl)
    }

    const workflowAssetId = refItem.sourceAssetId?.trim()
    if (workflowAssetId && refItem.kind === 'mention' && !hadCachedAsset) {
      upsertWorkflowAsset(workflowAssetId, localPath, assetUrl)
    }
  }

  const activePaths = input.refItems.map((item) => item.path)
  const prunePatch = buildWeishiUploadedMediaPrunePatch(
    { ...input.shot, weishiUploadedMedia: nextShotMedia },
    { activePaths, endpoint },
  )
  if (prunePatch.weishiUploadedMedia !== undefined) {
    nextShotMedia = prunePatch.weishiUploadedMedia ?? []
    shotChanged = true
  }

  const shotPatch: Partial<WorkflowShot> = shotChanged
    ? { weishiUploadedMedia: nextShotMedia.length ? nextShotMedia : undefined, updatedAt: Date.now() }
    : {}

  const dataPatch: Partial<Pick<WorkflowProjectData, 'characters' | 'scenes' | 'props'>> =
    assetChanged ? { characters, scenes, props } : {}

  return { shotPatch, dataPatch }
}
