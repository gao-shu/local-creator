// Copyright (c) Haode AI. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import {
  collectCanvasVideoReferenceBarAssets,
} from '@/lib/canvas/canvas-mention-utils'
import type { CanvasUpstreamReferenceAsset } from '@/lib/canvas/canvas-graph-utils'
import { resolveCanvasMediaProjectRootSync } from '@/lib/canvas/canvas-media-resolve'
import { canvasImageNodeToReviewAsset } from '@/lib/canvas/canvas-image-character'
import type { ModelConfig } from '@/types/settings'
import { resolveWeishiAssetReferenceUrl } from '@/lib/models/weishi-asset-service'
import { syncCharacterToReview } from '@/lib/workflow/character-review-service'
import {
  mentionKindLabel,
  type MentionCandidate,
} from '@/lib/workflow/mention-utils'
import { type ShotVideoReferenceItem } from '@/lib/workflow/shot-video-utils'
import { isCharacterRefItem } from '@/lib/workflow/shot-video-utils'
import type { VideoReferenceMode } from '@/lib/workflow/storyboard-video-presets'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import type { CanvasImageNodeData } from '@/types/canvas-nodes'

function normalizePathKey(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

function mapBarAssetToReferenceItem(
  asset: CanvasUpstreamReferenceAsset,
  candidates: MentionCandidate[],
  resolveWeishiAssetUrl?: (path: string) => string | undefined,
): ShotVideoReferenceItem | null {
  const path = String(asset.path || '').trim()
  if (!path) return null

  const mention =
    candidates.find((item) => item.canvasNodeId === asset.nodeId) ??
    (asset.mentionName
      ? candidates.find(
          (item) =>
            item.mentionName === asset.mentionName &&
            (item.kind === 'character' || item.kind === 'scene' || item.kind === 'prop'),
        )
      : undefined)

  const weishiAssetUrl = resolveWeishiAssetUrl?.(path)

  if (asset.source === 'mention' && mention) {
    return {
      kind: 'mention',
      label: `@${mention.mentionName}（${mentionKindLabel(mention.kind)}）`,
      path,
      weishiAssetUrl,
      sourceAssetId: mention.id,
      allowDuplicatePath: mention.kind === 'character',
    } as ShotVideoReferenceItem & { allowDuplicatePath?: boolean }
  }

  if (asset.isMarkedAsset && mention) {
    return {
      kind: 'mention',
      label: `@${mention.mentionName}（${mentionKindLabel(mention.kind)}）`,
      path,
      weishiAssetUrl,
      sourceAssetId: mention.id,
      allowDuplicatePath: mention.kind === 'character',
    } as ShotVideoReferenceItem & { allowDuplicatePath?: boolean }
  }

  return {
    kind: 'shot_reference',
    label: asset.label || '参考图',
    path,
    weishiAssetUrl,
  }
}

/** 与视频控制台参考条一致：仅连线资产 + 描述中显式 @ + 本地上传 */
export function buildCanvasVideoReferenceItems(options: {
  prompt: string
  candidates: MentionCandidate[]
  nodes: Node[]
  videoNodeId: string
  edges: Edge[]
  consoleReferenceImagePaths?: string[]
  resolveWeishiAssetUrl?: (path: string) => string | undefined
}): ShotVideoReferenceItem[] {
  const barAssets = collectCanvasVideoReferenceBarAssets({
    videoNodeId: options.videoNodeId,
    prompt: options.prompt,
    nodes: options.nodes,
    edges: options.edges,
    mentionCandidates: options.candidates,
    consoleReferenceImagePaths: options.consoleReferenceImagePaths,
  })

  const items: ShotVideoReferenceItem[] = []
  const seenKeys = new Set<string>()
  const seenPaths = new Set<string>()

  for (const asset of barAssets) {
    const mapped = mapBarAssetToReferenceItem(asset, options.candidates, options.resolveWeishiAssetUrl)
    if (!mapped) continue

    const pathKey = normalizePathKey(mapped.path)
    const assetKey = mapped.sourceAssetId ? `asset:${mapped.sourceAssetId}` : ''
    const allowDuplicatePath =
      (mapped as ShotVideoReferenceItem & { allowDuplicatePath?: boolean }).allowDuplicatePath === true

    if (assetKey && seenKeys.has(assetKey)) continue
    if (!allowDuplicatePath && seenPaths.has(pathKey)) continue

    if (assetKey) seenKeys.add(assetKey)
    seenPaths.add(pathKey)

    const { allowDuplicatePath: _drop, ...item } = mapped as ShotVideoReferenceItem & {
      allowDuplicatePath?: boolean
    }
    items.push(item)
  }

  return items
}

/** 按参考模式过滤画布参考图（对齐 resolveVideoReferenceItems，无下一分镜尾帧） */
export function resolveCanvasVideoReferenceItems(
  items: ShotVideoReferenceItem[],
  mode: VideoReferenceMode,
): ShotVideoReferenceItem[] {
  if (mode === 'text_to_video') return []
  if (mode === 'first_frame') return items

  if (mode === 'first_last_frame') {
    const start = items.find((item) => item.kind === 'storyboard') ?? items[0]
    if (!start) return []

    const tail =
      items.find((item) => item.kind === 'shot_reference') ??
      items.find((item) => item.kind !== 'storyboard' && item.path !== start.path)
    const frames: ShotVideoReferenceItem[] = [start]
    if (tail && tail.path !== start.path) {
      frames.push({
        kind: 'end_frame',
        label: tail.kind === 'shot_reference' ? tail.label : '尾帧参考',
        path: tail.path,
      })
    }

    const used = new Set(frames.map((item) => item.path))
    const extras = items.filter(
      (item) =>
        item.kind !== 'storyboard' &&
        item.kind !== 'end_frame' &&
        !used.has(item.path),
    )
    return [...frames, ...extras]
  }

  return items
}

export function resolveWeishiAssetUrlForCanvasPath(path: string, nodes: Node[]): string | undefined {
  const normalized = normalizePathKey(path)
  for (const node of nodes) {
    if (node.type !== CANVAS_NODE_TYPES.imageNode) continue
    const data = node.data as CanvasImageNodeData
    const outputPath = String(data.outputPath || '').trim()
    if (!outputPath || normalizePathKey(outputPath) !== normalized) continue
    const asset = canvasImageNodeToReviewAsset(node.id, data)
    return resolveWeishiAssetReferenceUrl(asset, outputPath) ?? undefined
  }
  return undefined
}

function findCanvasImageNodeByPath(nodes: Node[], path: string): Node | undefined {
  const key = normalizePathKey(path)
  return nodes.find((node) => {
    if (node.type !== CANVAS_NODE_TYPES.imageNode) return false
    const outputPath = String((node.data as CanvasImageNodeData).outputPath || '').trim()
    return outputPath && normalizePathKey(outputPath) === key
  })
}

/** 角色参考图开白：对齐工坊 Step3，生视频前确保 asset:// 可用 */
export async function ensureCanvasWeishiCharacterWhitelist(options: {
  referenceImageItems: ShotVideoReferenceItem[]
  nodes: Node[]
  model: ModelConfig
  canvasProjectId: string
  settings: { dataRootPath?: string }
  appDataDir: string
  fallbackProjectRoot: string
  apiBaseUrl?: string
  onImageNodePatch?: (nodeId: string, patch: Partial<CanvasImageNodeData>) => void
}): Promise<ShotVideoReferenceItem[]> {

  const next: ShotVideoReferenceItem[] = []

  for (const item of options.referenceImageItems) {
    if (!isCharacterRefItem(item)) {
      next.push(item)
      continue
    }

    const imageNode = findCanvasImageNodeByPath(options.nodes, item.path)
    if (!imageNode) {
      next.push(item)
      continue
    }

    const data = imageNode.data as CanvasImageNodeData
    const asset = canvasImageNodeToReviewAsset(imageNode.id, data)
    let weishiAssetUrl = resolveWeishiAssetReferenceUrl(asset, item.path) ?? item.weishiAssetUrl

    if (!weishiAssetUrl) {
      const projectRoot = await resolveCanvasMediaProjectRootSync(
        options.canvasProjectId,
        options.settings,
        options.appDataDir,
        {
          ownerKind: data.outputOwnerKind,
          ownerProjectId: data.outputOwnerProjectId,
        },
      )
      const result = await syncCharacterToReview(asset, options.model, {
        projectRoot,
        apiBaseUrl: options.apiBaseUrl,
      })
      const patch: Partial<CanvasImageNodeData> = {
        weishiAssetId: result.weishiAssetId,
        weishiAssetUrl: result.weishiAssetUrl,
        weishiAssetStatus: result.weishiAssetStatus,
        reviewImagePath: result.reviewImagePath,
      }
      options.onImageNodePatch?.(imageNode.id, patch)
      weishiAssetUrl = result.weishiAssetUrl
    }

    next.push({
      ...item,
      weishiAssetUrl: weishiAssetUrl?.trim() || item.weishiAssetUrl,
    })
  }

  return next
}
