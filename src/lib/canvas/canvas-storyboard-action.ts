// Copyright (c) local-creator contributors. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import type { AppSettings } from '@/types/settings'
import type { WorkflowEpisode, WorkflowShot } from '@/types/workflow'
import { collectCanvasPromptAssets } from '@/lib/canvas/canvas-collect-prompt-assets'
import {
  getCanvasExtractLlmErrorHint,
  resolveCanvasExtractLlmModelId,
} from '@/lib/canvas/canvas-extract-llm'
import { buildCanvasGraphFromShots } from '@/lib/canvas/canvas-import-service'
import { formatUserFacingBillingError } from '@/lib/utils'
import { callChatCompletions } from '@/lib/models/llm-client'
import { pickMergedLlmModel } from '@/lib/models/merged-model-picker'
import { getE2eMockDelayMs, shouldUseE2eMockAi } from '@/lib/e2e/e2e-mock-ai'
import { isWorkflowApiAvailable } from '@/lib/storage/workflow-service'
import { delayWithAbortSignal } from '@/lib/canvas/canvas-prompt-ai-cancel'
import { buildMentionCandidates, normalizeMentionSource } from '@/lib/workflow/mention-utils'
import {
  buildStoryboardPrompt,
  parseStoryboardResult,
  resolveCanvasStoryboardTemplateKey,
  resolveStoryboardTemplate,
  type ParsedStoryboardItem,
} from '@/lib/workflow/storyboard-prompt'
import { normalizeShot, syncShotReferencedAssets } from '@/lib/workflow/shot-utils'
import { generateUUID } from '@/lib/utils'

const MOCK_STORYBOARD = [
  {
    shot_number: 1,
    dialogue: '午后阳光洒落长椅',
    prompt:
      '中景，平视，固定机位，公园全景。阳光透过树叶洒在空荡木质长椅上，微风拂动，画面宁静温暖，高清写实',
    spatial_anchor: '长椅居中偏右，树荫从左上方投射',
  },
  {
    shot_number: 2,
    dialogue: '她翻动书页的侧影',
    prompt:
      '近景，平视，缓慢横移。少女坐于长椅左侧低头翻阅旧书，手指轻拨书页，发丝被风吹起，背景虚化',
    spatial_anchor: '人物居画面左侧三分之一，光源来自右上方',
  },
  {
    shot_number: 3,
    dialogue: '蝴蝶闯入画面',
    prompt: '特写，平视，固定。蓝色蝴蝶从右侧飞入落在书页边缘，翅膀缓慢扇动，背景柔焦',
    spatial_anchor: '蝴蝶落于书页右下，书页占画面主体',
  },
]

function buildCanvasPseudoEpisode(content: string): WorkflowEpisode {
  return {
    id: `canvas_ep_${generateUUID()}`,
    episodeIndex: 1,
    title: '画布文本',
    summary: '',
    content,
    characters: [],
    scenes: [],
    items: [],
  }
}

function canvasStoryboardItemsToShots(
  items: ParsedStoryboardItem[],
  episode: WorkflowEpisode,
  assets: ReturnType<typeof collectCanvasPromptAssets>,
): WorkflowShot[] {
  const now = Date.now()
  const candidates = buildMentionCandidates(assets)
  return items.map((item) => {
    const shot = normalizeShot(
      {
        id: `cv_shot_${generateUUID()}`,
        episodeId: episode.id,
        episodeIndex: episode.episodeIndex,
        shotNumber: item.shotNumber,
        dialogue: item.dialogue,
        prompt: normalizeMentionSource(item.prompt),
        spatialAnchor: item.spatialAnchor
          ? normalizeMentionSource(item.spatialAnchor)
          : item.spatialAnchor,
        status: 'draft',
        updatedAt: now,
      },
      episode,
    )
    if (!shot) throw new Error('分镜数据解析失败')
    return candidates.length ? syncShotReferencedAssets(shot, candidates) : shot
  })
}

export interface RunCanvasPromptStoryboardInput {
  sourceNode: Node
  content: string
  settings: AppSettings
  canvasProjectId: string
  existingNodes: Node[]
  existingEdges: Edge[]
  signal?: AbortSignal
}

export interface RunCanvasPromptStoryboardResult {
  shots: WorkflowShot[]
  nodes: Node[]
  edges: Edge[]
  summary: string
  /** 保留字段；提取资产改由独立按钮触发，智能分镜不再自动写入 */
  assetNodes: Node[]
  assetEdges: Edge[]
  extractSummary?: string
}

export async function runCanvasPromptStoryboard(
  input: RunCanvasPromptStoryboardInput,
): Promise<RunCanvasPromptStoryboardResult> {
  const text = input.content.trim()
  if (!text) {
    throw new Error('请先在上方文本框输入小说或剧本内容')
  }

  const llmModelId = resolveCanvasExtractLlmModelId(input.settings)
  if (!llmModelId) {
    throw new Error('请先在系统设置中配置 LLM 模型')
  }

  const episode = buildCanvasPseudoEpisode(text)
  const assets = collectCanvasPromptAssets(
    input.sourceNode.id,
    input.existingNodes,
    input.existingEdges,
  )
  const templateKey = resolveCanvasStoryboardTemplateKey(input.settings)
  const template = resolveStoryboardTemplate(input.settings, templateKey)
  const prompt = buildStoryboardPrompt(episode, assets, template, input.settings)

  let shots: WorkflowShot[]
  // E2E mock / 无 workflow API：可控延迟，便于验证取消不落盘
  if (!isWorkflowApiAvailable() || shouldUseE2eMockAi()) {
    await delayWithAbortSignal(getE2eMockDelayMs() || 1200, input.signal)
    const parsed = parseStoryboardResult(JSON.stringify({ storyboard: MOCK_STORYBOARD }))
    shots = canvasStoryboardItemsToShots(parsed, episode, assets)
  } else {
    const model = pickMergedLlmModel(input.settings, llmModelId)
    const raw = await callChatCompletions(model, prompt, {
      signal: input.signal,
    })
    const parsed = parseStoryboardResult(raw)
    shots = canvasStoryboardItemsToShots(parsed, episode, assets)
  }

  if (!shots.length) {
    throw new Error('未生成有效分镜')
  }

  const { nodes, edges } = buildCanvasGraphFromShots({
    shots,
    canvasProjectId: input.canvasProjectId,
    existingNodes: input.existingNodes,
    existingEdges: input.existingEdges,
    sourceNode: input.sourceNode,
  })

  const assetHint =
    assets.characters.length || assets.scenes.length || assets.props.length
      ? ` · 资产 ${assets.characters.length + assets.scenes.length + assets.props.length}`
      : ''

  return {
    shots,
    nodes,
    edges,
    summary: `${shots.length} 镜${assetHint}`,
    assetNodes: [],
    assetEdges: [],
  }
}

export function resolveCanvasPromptStoryboardErrorMessage(error: unknown): string {
  const fallback = '分镜生成失败'
  const message = formatUserFacingBillingError(error, fallback)
  return getCanvasExtractLlmErrorHint(message) || message
}
