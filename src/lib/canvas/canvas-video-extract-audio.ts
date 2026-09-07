// Copyright (c) local-creator contributors. All rights reserved.

import type { Node } from '@xyflow/react'
import type { CanvasMediaOwnerKind, CanvasVideoNodeData } from '@/types/canvas-nodes'
import type { CanvasAddNodeConnection } from '@/lib/canvas/canvas-add-node-connection'
import { isCanvasVideoNodeType } from '@/lib/canvas/canvas-video-drag-items'
import type { ExtractAudioFromProjectResult } from '@/lib/media/extract-audio-from-video'
import type { ExtractAudioRangeMode } from '@/lib/media/extract-audio-range'
import {
  resolveVideoExtractAudioAvailability,
  type VideoExtractAudioAvailability,
} from '@/lib/media/video-extract-audio-availability'

export type CanvasVideoExtractAudioAvailability = VideoExtractAudioAvailability

export interface CanvasVideoExtractAudioExtractedMeta {
  mode: ExtractAudioRangeMode
  startSec?: number
  endSec?: number
  videoDurationSec?: number | null
}

export interface BuildCanvasAudioNodeFromExtractOptions {
  videoNodeId: string
  videoLabel: string
  /** 抽音 mp3 落盘所在画布项目（画布弹窗默认 projectKind=canvas） */
  canvasProjectId: string
}

/** 画布抽音产物 voices/extract_* 的媒体归属（与视频 outputOwner 无关） */
export function resolveCanvasExtractAudioMediaOwner(canvasProjectId: string): {
  mediaOwnerKind: Extract<CanvasMediaOwnerKind, 'canvas'>
  mediaOwnerProjectId: string
} {
  return {
    mediaOwnerKind: 'canvas',
    mediaOwnerProjectId: String(canvasProjectId || '').trim(),
  }
}

export {
  resolveVideoExtractAudioAvailability as resolveCanvasVideoExtractAudioAvailability,
  type VideoExtractAudioAvailability,
} from '@/lib/media/video-extract-audio-availability'

export function resolveCanvasVideoExtractAudioAvailabilityFromNode(options: {
  data: CanvasVideoNodeData
  running?: boolean
  uploading?: boolean
  mediaMissing?: boolean
}): CanvasVideoExtractAudioAvailability {
  return resolveVideoExtractAudioAvailability({
    outputPath: options.data.outputPath,
    running: options.running,
    uploading: options.uploading,
    mediaMissing: options.mediaMissing,
  })
}

/** 导出音频的目标视频节点：优先连线锚点，否则单选视频 */
export function resolveCanvasVideoExtractSourceNode(
  nodes: Node[],
  addNodeAnchor?: { connection?: CanvasAddNodeConnection } | null,
): Node | null {
  const connNodeId = addNodeAnchor?.connection?.nodeId
  if (connNodeId) {
    const anchorNode = nodes.find((node) => node.id === connNodeId)
    if (anchorNode && isCanvasVideoNodeType(String(anchorNode.type || ''))) {
      return anchorNode
    }
    return null
  }

  const selected = nodes.filter(
    (node) => node.selected && isCanvasVideoNodeType(String(node.type || '')),
  )
  return selected.length === 1 ? selected[0]! : null
}

/** 仅单选视频节点，或从视频节点连线拉出添加菜单时展示「从视频」 */
export function shouldShowCanvasVideoMenuSection(
  nodes: Node[],
  addNodeAnchor?: { connection?: CanvasAddNodeConnection } | null,
): boolean {
  return resolveCanvasVideoExtractSourceNode(nodes, addNodeAnchor) != null
}

export function isVideoExtractAudioActionDisabled(
  nodes: Node[],
  addNodeAnchor?: { connection?: CanvasAddNodeConnection } | null,
  runningNodeIds?: ReadonlySet<string> | null,
): boolean {
  const node = resolveCanvasVideoExtractSourceNode(nodes, addNodeAnchor)
  if (!node) return true
  const availability = resolveCanvasVideoExtractAudioAvailabilityFromNode({
    data: node.data as CanvasVideoNodeData,
    running: runningNodeIds?.has(node.id),
  })
  return !availability.available
}

export function resolveCanvasAudioNodeExtractDurationSec(
  meta: CanvasVideoExtractAudioExtractedMeta,
): number | undefined {
  const videoDuration = meta.videoDurationSec
  if (meta.mode === 'full') {
    return videoDuration != null && Number.isFinite(videoDuration) ? videoDuration : undefined
  }

  const start = meta.startSec ?? 0
  const end = meta.endSec ?? videoDuration
  if (end != null && Number.isFinite(end)) {
    return Math.max(0, end - start)
  }
  if (videoDuration != null && Number.isFinite(videoDuration)) {
    return Math.max(0, videoDuration - start)
  }
  return undefined
}

/** 视频抽音成功后创建画布 audioNode 的初始 data */
export function buildCanvasAudioNodeDataFromExtract(
  result: ExtractAudioFromProjectResult,
  meta: CanvasVideoExtractAudioExtractedMeta,
  options: BuildCanvasAudioNodeFromExtractOptions,
): Record<string, unknown> | null {
  const relativePath = String(result.relativePath || '').trim()
  if (!result.success || !relativePath) return null

  const label = `提取音频 · ${String(options.videoLabel || '视频').trim() || '视频'}`
  const durationSec = resolveCanvasAudioNodeExtractDurationSec(meta)

  const data: Record<string, unknown> = {
    label,
    audioRelativePath: relativePath,
    sourceVideoNodeId: options.videoNodeId,
    sourceVideoLabel: options.videoLabel,
  }

  if (durationSec != null) {
    data.durationSec = durationSec
  }

  const owner = resolveCanvasExtractAudioMediaOwner(options.canvasProjectId)
  if (owner.mediaOwnerProjectId) {
    data.mediaOwnerKind = owner.mediaOwnerKind
    data.mediaOwnerProjectId = owner.mediaOwnerProjectId
  }

  if (meta.mode === 'range') {
    if (meta.startSec != null && Number.isFinite(meta.startSec)) {
      data.extractStartSec = meta.startSec
    }
    data.extractEndSec = meta.endSec ?? null
  }

  return data
}
