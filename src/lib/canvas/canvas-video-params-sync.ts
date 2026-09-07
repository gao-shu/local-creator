// Copyright (c) local-creator contributors. All rights reserved.

import type { Node } from '@xyflow/react'
import type { AppSettings } from '@/types/settings'
import type { ModelConfig } from '@/types/settings'
import { useSettingsStore } from '@/stores/settings-store'
import { CANVAS_NODE_TYPES, type CanvasVideoNodeData } from '@/types/canvas-nodes'
import { hasCanvasVideoLocalOutput } from '@/lib/canvas/canvas-video-drag-items'
import {
  normalizeVideoDurationValue,
  normalizeVideoResolutionValue,
  resolveStoryboardVideoGeneratePrefs,
} from '@/lib/workflow/storyboard-video-presets'
import { normalizeVideoCapabilitySelection } from '@/lib/models/video-model-capability'

export type CanvasVideoNodeParamsPatch = Pick<
  CanvasVideoNodeData,
  'videoModelId' | 'referenceMode' | 'durationSec' | 'aspectRatio' | 'resolution'
>

/** 画布视频参数（软件级 settings 为唯一来源，与全部视频节点保持一致） */
export type CanvasVideoProjectParams = CanvasVideoNodeParamsPatch

/** 从全局设置 + 当前视频模型解析画布视频节点默认参数 */
export function resolveCanvasVideoNodeParamsFromSettings(
  settings: AppSettings | null | undefined,
  videoModel: ModelConfig | null | undefined,
  overrides?: Partial<CanvasVideoNodeParamsPatch>,
): CanvasVideoProjectParams {
  const prefs = resolveStoryboardVideoGeneratePrefs(settings, videoModel)
  const duration = normalizeVideoDurationValue(prefs.duration, videoModel)
  const merged: CanvasVideoProjectParams = {
    videoModelId: videoModel?.id,
    referenceMode: prefs.referenceMode,
    durationSec: Number(duration) || 5,
    aspectRatio: prefs.aspectRatio,
    resolution: normalizeVideoResolutionValue(prefs.resolution, videoModel),
    ...overrides,
  }
  const clamped = normalizeVideoCapabilitySelection(videoModel, merged)
  return {
    videoModelId: merged.videoModelId,
    referenceMode: clamped.referenceMode,
    durationSec: clamped.durationSec,
    aspectRatio: clamped.aspectRatio,
    resolution: clamped.resolution,
  }
}


export function normalizeCanvasVideoProjectParams(
  params: Partial<CanvasVideoProjectParams> | undefined,
  settings: AppSettings | null | undefined,
  videoModels: ModelConfig[],
): CanvasVideoProjectParams {
  const preferredId =
    params?.videoModelId?.trim() ||
    settings?.lastUsedStoryboardVideoModelId?.trim() ||
    videoModels[0]?.id ||
    ''
  const videoModel =
    videoModels.find((item) => item.id === preferredId) ?? videoModels[0] ?? null
  return resolveCanvasVideoNodeParamsFromSettings(settings, videoModel, params)
}

export function inferCanvasVideoProjectParamsFromNodes(
  nodes: Node[],
  settings: AppSettings | null | undefined,
  videoModels: ModelConfig[],
): CanvasVideoProjectParams {
  const videoNode = nodes.find((node) => node.type === CANVAS_NODE_TYPES.storyVideo)
  if (!videoNode) {
    return normalizeCanvasVideoProjectParams(undefined, settings, videoModels)
  }
  const data = videoNode.data as CanvasVideoNodeData
  return normalizeCanvasVideoProjectParams(
    {
      videoModelId: data.videoModelId,
      referenceMode: data.referenceMode,
      durationSec: data.durationSec,
      aspectRatio: data.aspectRatio,
      resolution: data.resolution,
    },
    settings,
    videoModels,
  )
}

/** 从全局 settings 解析画布视频参数（软件级，不读项目 videoParams） */
export function resolveCanvasVideoParamsFromSettings(
  settings: AppSettings | null | undefined,
  videoModels: ModelConfig[],
): CanvasVideoProjectParams {
  return normalizeCanvasVideoProjectParams(undefined, settings, videoModels)
}

/** 将画布视频参数写入全局 settings（与创作工坊 Step4 共用 lastUsed*） */
export function persistCanvasVideoParamsToSettings(params: CanvasVideoProjectParams): void {
  const {
    rememberLastUsedStoryboardVideoModelId,
    rememberLastUsedStoryboardVideoGenerateParams,
  } = useSettingsStore.getState()
  if (params.videoModelId?.trim()) {
    rememberLastUsedStoryboardVideoModelId(params.videoModelId.trim())
  }
  rememberLastUsedStoryboardVideoGenerateParams({
    referenceMode: params.referenceMode,
    duration: String(params.durationSec ?? 5),
    aspectRatio: params.aspectRatio,
    resolution: params.resolution,
  })
}

export function resolveInitialCanvasVideoProjectParams(
  settings: AppSettings | null | undefined,
  videoModels: ModelConfig[],
): CanvasVideoProjectParams {
  return resolveCanvasVideoParamsFromSettings(settings, videoModels)
}

export function canvasVideoProjectParamsToNodePatch(
  params: CanvasVideoProjectParams,
  videoModel?: ModelConfig | null,
): CanvasVideoNodeParamsPatch {
  const clamped = normalizeVideoCapabilitySelection(videoModel, params)
  return {
    videoModelId: params.videoModelId,
    referenceMode: clamped.referenceMode,
    durationSec: clamped.durationSec,
    aspectRatio: clamped.aspectRatio,
    resolution: clamped.resolution,
  }
}

/** 换模型：仅改 modelId 时，四维参数落入新模型开放列表 */
export function buildCanvasVideoModelSwitchPatch(
  videoModelId: string,
  videoModels: ModelConfig[],
  current: Pick<
    CanvasVideoProjectParams,
    'referenceMode' | 'durationSec' | 'aspectRatio' | 'resolution'
  >,
): CanvasVideoNodeParamsPatch {
  const nextModel =
    videoModels.find((item) => item.id === videoModelId) ?? videoModels[0] ?? null
  const next = normalizeVideoCapabilitySelection(nextModel, current)
  return {
    videoModelId,
    referenceMode: next.referenceMode,
    durationSec: next.durationSec,
    aspectRatio: next.aspectRatio,
    resolution: next.resolution,
  }
}

export function syncVideoNodesWithProjectParams(
  nodes: Node[],
  params: CanvasVideoProjectParams,
  videoModels: ModelConfig[],
): { nodes: Node[]; changed: boolean } {
  const patch = canvasVideoProjectParamsToNodePatch(
    params,
    videoModels.find((item) => item.id === params.videoModelId) ?? videoModels[0] ?? null,
  )
  let changed = false
  const next = nodes.map((node) => {
    if (node.type !== CANVAS_NODE_TYPES.storyVideo) return node
    const data = node.data as CanvasVideoNodeData
    const merged = mergeCanvasVideoNodeParamsPatch(data, patch)
    if (!Object.keys(merged).length) return node
    changed = true
    return { ...node, data: { ...data, ...merged } }
  })
  return { nodes: changed ? next : nodes, changed }
}

export function mergeCanvasVideoNodeParamsPatch(
  current: CanvasVideoNodeData,
  patch: Partial<CanvasVideoNodeParamsPatch>,
): Partial<CanvasVideoNodeData> {
  const next: Partial<CanvasVideoNodeData> = {}
  if (patch.videoModelId !== undefined && patch.videoModelId !== current.videoModelId) {
    next.videoModelId = patch.videoModelId
  }
  if (patch.referenceMode !== undefined && patch.referenceMode !== current.referenceMode) {
    next.referenceMode = patch.referenceMode
  }
  if (patch.durationSec !== undefined && patch.durationSec !== current.durationSec) {
    next.durationSec = patch.durationSec
  }
  if (
    patch.aspectRatio !== undefined &&
    patch.aspectRatio !== current.aspectRatio &&
    !hasCanvasVideoLocalOutput(current)
  ) {
    next.aspectRatio = patch.aspectRatio
  }
  if (patch.resolution !== undefined && patch.resolution !== current.resolution) {
    next.resolution = patch.resolution
  }
  return next
}

/**
 * 生视频前强制对齐软件级参数（含已有成片时的画幅）。
 * 日常 sync 会跳过有成片节点的 aspectRatio，避免预览框被改比例；发起生成时必须覆盖。
 */
export function forceCanvasVideoNodeParamsForGenerate(
  current: CanvasVideoNodeData,
  params: CanvasVideoProjectParams,
  videoModel?: ModelConfig | null,
): Partial<CanvasVideoNodeData> {
  const patch = canvasVideoProjectParamsToNodePatch(params, videoModel)
  const next: Partial<CanvasVideoNodeData> = {}
  if (patch.videoModelId !== undefined && patch.videoModelId !== current.videoModelId) {
    next.videoModelId = patch.videoModelId
  }
  if (patch.referenceMode !== undefined && patch.referenceMode !== current.referenceMode) {
    next.referenceMode = patch.referenceMode
  }
  if (patch.durationSec !== undefined && patch.durationSec !== current.durationSec) {
    next.durationSec = patch.durationSec
  }
  if (patch.aspectRatio !== undefined && patch.aspectRatio !== current.aspectRatio) {
    next.aspectRatio = patch.aspectRatio
  }
  if (patch.resolution !== undefined && patch.resolution !== current.resolution) {
    next.resolution = patch.resolution
  }
  return next
}
