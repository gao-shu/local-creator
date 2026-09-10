// Copyright (c) Local Creator. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import { resolveCanvasProjectRoot } from '@/lib/canvas/canvas-project-paths'
import {
  collectReferenceImageSources,
  resolveCanvasVideoNodeShotBody,
  resolvePrimaryImageSource,
} from '@/lib/canvas/canvas-graph-utils'
import { resolveCanvasMediaProjectRootSync } from '@/lib/canvas/canvas-media-resolve'
import {
  buildCanvasVideoReferenceAudioItems,
  prepareCanvasVideoPromptContext,
} from '@/lib/canvas/canvas-mention-utils'
import { readCanvasVideoAutoMentionEnabled } from '@/lib/canvas/canvas-video-auto-mention'
import {
  buildCanvasVideoReferenceItems,
  resolveCanvasVideoReferenceItems,
} from '@/lib/canvas/canvas-video-reference-utils'
import { appendMissingCharacterRefImages } from '@/lib/workflow/shot-video-utils'
import type { ShotVideoReferenceAudioItem } from '@/lib/workflow/shot-audio-reference-utils'
import type { ShotVideoReferenceItem } from '@/lib/workflow/shot-video-utils'
import { pickVideoModel } from '@/lib/video/video-client'
import { readSettings } from '@/lib/storage/settings-service'
import {
  normalizeVideoReferenceMode,
  VIDEO_REFERENCE_MODE_LABELS,
} from '@/lib/workflow/storyboard-video-presets'
import { getUnsupportedVideoReferenceModeMessage } from '@/lib/models/video-model-capability'
import { resolveCanvasVideoNodeParamsFromSettings } from '@/lib/canvas/canvas-video-params-sync'
import { shouldUseOpenAiVideoClient } from '@/lib/video/openai-video-client'
import { isZhipuVideoModel, prepareZhipuVideoRequestPreview } from '@/lib/video/zhipu-video-client'
import {
  isGrokVideoModel,
  prepareGrokVideoRequestPreview,
} from '@/lib/video/grok-video-client'
import { prepareOpenAiVideoRequestPreview } from '@/lib/video/openai-video-client'
import { resolveVideoProviderKind } from '@/lib/video/video-provider'
import { listVoiceLibraryEntries } from '@/lib/voice/voice-library-service'
import type { VideoRequestPreview } from '@/lib/video/video-request-preview'
import type { ModelConfig } from '@/types/settings'
import type { CanvasVideoNodeData } from '@/types/canvas-nodes'
import { useSettingsStore } from '@/stores/settings-store'
import { mergeModelsForKind } from '@/lib/models/model-merge'

export interface CanvasVideoGenerateContext {
  projectId: string
  nodes: Node[]
  edges: Edge[]
}

export interface ResolvedCanvasVideoGenerateInput {
  prompt: string
  referenceMode: ReturnType<typeof normalizeVideoReferenceMode>
  referenceImagePaths: string[]
  referenceImageItems: ShotVideoReferenceItem[]
  referenceAudioPaths: string[]
  referenceAudioItems: ShotVideoReferenceAudioItem[]
  videoProjectRoot: string
  canvasProjectRoot: string
  model: ModelConfig
  durationSec: number
  aspectRatio: string
  resolution: string
}

export async function resolveCanvasVideoGenerateInput(
  node: Node,
  ctx: CanvasVideoGenerateContext,
): Promise<ResolvedCanvasVideoGenerateInput> {
  const data = node.data as CanvasVideoNodeData
  let prompt = resolveCanvasVideoNodeShotBody(node.id, ctx.nodes, ctx.edges, data)
  const hasReferenceImages =
    collectReferenceImageSources(node.id, ctx.nodes, ctx.edges).length > 0 ||
    (data.consoleReferenceImagePaths?.length ?? 0) > 0
  if (!prompt.trim()) {
    if (hasReferenceImages) {
      prompt = '根据参考图生成视频'
    } else {
      throw new Error('请先连接 Prompt 节点或填写视频描述')
    }
  }

  const voiceLibrary = await listVoiceLibraryEntries()
  const autoMentionEnabled = readCanvasVideoAutoMentionEnabled()
  const mentionPrepared = prepareCanvasVideoPromptContext(prompt, ctx.nodes, {
    voiceLibrary,
    edges: ctx.edges,
    autoMentionEnabled,
  })
  prompt = mentionPrepared.prompt

  const settingsRes = await readSettings()
  const settings = settingsRes.data
  const appDataDir = settingsRes.appDataDir

  // 软件级 lastUsed* 为唯一来源（与控制台 UI 一致）；勿优先读可能滞后的 node.data
  const systemByKind = useSettingsStore.getState().systemModelsByKind
  const videoModels = mergeModelsForKind('video', settings.videoModels, systemByKind)
  const model = pickVideoModel(
    videoModels,
    settings.lastUsedStoryboardVideoModelId?.trim() || data.videoModelId?.trim(),
  )
  const generateParams = resolveCanvasVideoNodeParamsFromSettings(settings, model)
  const referenceMode = normalizeVideoReferenceMode(generateParams.referenceMode)

  const orderedRefItems = buildCanvasVideoReferenceItems({
    prompt,
    candidates: mentionPrepared.candidates,
    nodes: ctx.nodes,
    videoNodeId: node.id,
    edges: ctx.edges,
    consoleReferenceImagePaths: data.consoleReferenceImagePaths,
  })

  const canvasProjectRoot = resolveCanvasProjectRoot(settings, appDataDir, ctx.projectId)

  const referenceAudioItems = buildCanvasVideoReferenceAudioItems(
    prompt,
    mentionPrepared.candidates,
    ctx.nodes,
    voiceLibrary,
    orderedRefItems,
    {
      videoNodeId: node.id,
      edges: ctx.edges,
      projectRoot: canvasProjectRoot,
    },
  )
  const referenceImageItems = resolveCanvasVideoReferenceItems(
    appendMissingCharacterRefImages(orderedRefItems, {
      audioItems: referenceAudioItems,
      mentionCandidates: mentionPrepared.candidates,
    }),
    referenceMode,
  )
  const referenceImagePaths = referenceImageItems.map((item) => item.path)
  const referenceAudioPaths = referenceAudioItems.map((item) => item.path)

  const primarySource = resolvePrimaryImageSource(node.id, ctx.nodes, ctx.edges)

  const firstRefPath = referenceImagePaths[0]
  const rootSource =
    (firstRefPath
      ? mentionPrepared.mentionSources.find((item) => item.path === firstRefPath) ??
        collectReferenceImageSources(node.id, ctx.nodes, ctx.edges).find(
          (item) => item.path === firstRefPath,
        )
      : null) ?? primarySource
  const videoProjectRoot = rootSource
    ? await resolveCanvasMediaProjectRootSync(ctx.projectId, settings, appDataDir, rootSource)
    : canvasProjectRoot

  const unsupported = getUnsupportedVideoReferenceModeMessage(referenceMode, model)
  if (unsupported) {
    throw new Error(unsupported)
  }

  let effectiveReferenceMode = referenceMode
  if (effectiveReferenceMode !== 'text_to_video' && !referenceImagePaths.length) {
    const provider = resolveVideoProviderKind(model)
    if (provider === 'zhipu' || provider === 'openai_compatible' || provider === 'system') {
      effectiveReferenceMode = 'text_to_video'
    } else {
      throw new Error('请先连接参考图或生图节点')
    }
  }

  return {
    prompt,
    referenceMode: effectiveReferenceMode,
    referenceImagePaths,
    referenceImageItems,
    referenceAudioPaths,
    referenceAudioItems,
    videoProjectRoot,
    canvasProjectRoot,
    model,
    durationSec: generateParams.durationSec,
    aspectRatio: generateParams.aspectRatio ?? '16:9',
    resolution: generateParams.resolution,
  }
}

export interface PreparedCanvasVideoRequestPreview {
  preview: VideoRequestPreview
}

/** 对齐创作工坊：构建确认弹窗预览（智谱 / Grok / OpenAI 兼容） */
export async function prepareCanvasVideoGeneratePreview(
  node: Node,
  ctx: CanvasVideoGenerateContext,
): Promise<PreparedCanvasVideoRequestPreview | null> {
  const input = await resolveCanvasVideoGenerateInput(node, ctx)
  const settingsRes = await readSettings()
  const settings = settingsRes.data
  const referenceModeLabel =
    VIDEO_REFERENCE_MODE_LABELS[input.referenceMode] ?? input.referenceMode

  if (isZhipuVideoModel(input.model.model || '', input.model.endpoint, input.model.apiFormat)) {
    const prepared = await prepareZhipuVideoRequestPreview({
      model: input.model,
      prompt: input.prompt,
      durationSec: input.durationSec,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      referenceMode: input.referenceMode,
      referenceImagePath: input.referenceImagePaths[0] ?? null,
      referenceImagePaths: input.referenceImagePaths,
      referenceImageItems: input.referenceImageItems,
      projectRoot: input.videoProjectRoot,
      apiBaseUrl: settings.apiBaseUrl,
      referenceModeLabel,
    })
    return { preview: prepared.preview }
  }

  if (isGrokVideoModel(input.model)) {
    const prepared = await prepareGrokVideoRequestPreview({
      model: input.model,
      prompt: input.prompt,
      durationSec: input.durationSec,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      referenceMode: input.referenceMode,
      referenceImagePath: input.referenceImagePaths[0] ?? null,
      referenceImagePaths: input.referenceImagePaths,
      referenceImageItems: input.referenceImageItems,
      projectRoot: input.videoProjectRoot,
      apiBaseUrl: settings.apiBaseUrl,
      referenceModeLabel,
    })
    return { preview: prepared.preview }
  }

  if (shouldUseOpenAiVideoClient(input.model)) {
    const prepared = await prepareOpenAiVideoRequestPreview({
      model: input.model,
      prompt: input.prompt,
      durationSec: input.durationSec,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      referenceMode: input.referenceMode,
      referenceImagePath: input.referenceImagePaths[0] ?? null,
      referenceImagePaths: input.referenceImagePaths,
      referenceImageItems: input.referenceImageItems,
      projectRoot: input.videoProjectRoot,
      apiBaseUrl: settings.apiBaseUrl,
      referenceModeLabel,
    })
    return { preview: prepared.preview }
  }

  return null
}
