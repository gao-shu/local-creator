import type { AppSettings } from '@/types/settings'
import type { AssetKind } from '@/types/workflow'
import { EXTRACT_LLM_TEMPERATURE } from '@/constants/asset-extract'
import { callChatCompletions } from '@/lib/models/llm-client'
import { getE2eMockDelayMs, shouldUseE2eMockAi } from '@/lib/e2e/e2e-mock-ai'
import { callChatCompletions } from '@/lib/models/llm-client'
import { pickMergedLlmModel } from '@/lib/models/merged-model-picker'
import { isWorkflowApiAvailable } from '@/lib/storage/workflow-service'
import { buildExtractPrompt, parseExtractResult } from '@/lib/workflow/extract-prompt'
import { resolveExtractTemplate } from '@/lib/workflow/asset-utils'

export interface ExtractEpisodeParams {
  content: string
  kind: AssetKind
  settings: AppSettings
  extractTemplateKey?: string
  signal?: AbortSignal
}

const MOCK: Record<AssetKind, Array<{ name: string; description: string }>> = {
  character: [{ name: '主角', description: '青年，现代都市装扮，神情坚定' }],
  scene: [{ name: '城市街道', description: '夜晚霓虹灯下的主干道，湿润路面反光' }],
  prop: [{ name: '旧照片', description: '泛黄的相片，边角磨损' }],
}

export async function extractScriptAssets(
  params: Omit<ExtractEpisodeParams, 'kind'>,
): Promise<{
  characters: Array<{ name: string; description: string }>
  scenes: Array<{ name: string; description: string }>
  items: Array<{ name: string; description: string }>
}> {
  const { content, settings, extractTemplateKey, signal } = params
  if (!content.trim()) throw new Error('剧本为空，无法提取')

  if (!isWorkflowApiAvailable() || shouldUseE2eMockAi()) {
    await delayWithAbortSignal(getE2eMockDelayMs(800), signal)
    return {
      characters: MOCK.character,
      scenes: MOCK.scene,
      items: MOCK.prop,
    }
  }

  const template = resolveExtractTemplate(settings, extractTemplateKey)
  const prompt = buildExtractPrompt(content, template)
  const model = pickMergedLlmModel(settings)

  const raw = await callChatCompletions(model, prompt, {
    temperature: EXTRACT_LLM_TEMPERATURE,
    signal,
  })
  return parseExtractResult(raw)
}

export async function extractEpisodeEntities(params: ExtractEpisodeParams) {
  const { kind, ...rest } = params
  const parsed = await extractScriptAssets(rest)
  const entities =
    kind === 'character' ? parsed.characters : kind === 'scene' ? parsed.scenes : parsed.items
  return { kind, entities }
}
