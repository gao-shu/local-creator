// Copyright (c) local-creator contributors. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import type { AppSettings } from '@/types/settings'
import { buildAssetNodesFromPromptText } from '@/lib/canvas/canvas-prompt-extract'
import {
  getCanvasExtractLlmErrorHint,
  resolveCanvasExtractLlmModelId,
} from '@/lib/canvas/canvas-extract-llm'
import { formatUserFacingBillingError } from '@/lib/utils'
import { extractScriptAssets } from '@/lib/workflow/extract-service'
import { resolveQuickExtractTemplateKey } from '@/lib/workflow/asset-utils'

export interface RunCanvasPromptExtractInput {
  sourceNode: Node
  content: string
  settings: AppSettings
  canvasProjectId?: string
  existingNodes: Node[]
  existingEdges?: Edge[]
  signal?: AbortSignal
}

export interface RunCanvasPromptExtractResult {
  characters: Array<{ name: string; description: string }>
  scenes: Array<{ name: string; description: string }>
  assetNodes: Node[]
  assetEdges: ReturnType<typeof buildAssetNodesFromPromptText>['edges']
  summary: string
}

export async function runCanvasPromptExtract(
  input: RunCanvasPromptExtractInput,
): Promise<RunCanvasPromptExtractResult> {
  const text = input.content.trim()
  if (!text) {
    throw new Error('请先输入文本内容')
  }

  const llmModelId = resolveCanvasExtractLlmModelId(input.settings)
  if (!llmModelId) {
    throw new Error('请先在系统设置中配置 LLM 模型')
  }

  const extractTemplateKey = resolveQuickExtractTemplateKey(input.settings)
  const parsed = await extractScriptAssets({
    content: text,
    settings: input.settings,
    extractTemplateKey,
    signal: input.signal,
  })

  const characters = parsed.characters
  const scenes = parsed.scenes
  if (!characters.length && !scenes.length) {
    throw new Error('未提取到角色或场景')
  }

  const { nodes: assetNodes, edges: assetEdges } = buildAssetNodesFromPromptText(
    input.sourceNode,
    characters,
    scenes,
    input.existingNodes,
    input.existingEdges ?? [],
  )

  const summary = `角色 ${characters.length} · 场景 ${scenes.length}`
  return { characters, scenes, assetNodes, assetEdges, summary }
}

export function resolveCanvasPromptExtractErrorMessage(error: unknown): string {
  const fallback = '提取失败'
  const message = formatUserFacingBillingError(error, fallback)
  return getCanvasExtractLlmErrorHint(message) || message
}
