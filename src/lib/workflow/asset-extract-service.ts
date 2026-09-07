// Copyright (c) local-creator contributors. All rights reserved.

import type { AppSettings } from '@/types/settings'
import type { WorkflowEpisode, WorkflowTask } from '@/types/workflow'
import { shouldUseE2eMockAi } from '@/lib/e2e/e2e-mock-ai'
import { EXTRACT_LLM_TEMPERATURE } from '@/constants/asset-extract'
import { callChatCompletions } from '@/lib/models/llm-client'
import { pickMergedLlmModel } from '@/lib/models/merged-model-picker'
import { generateUUID } from '@/lib/utils'
import { buildExtractPrompt, parseExtractResult } from '@/lib/workflow/extract-prompt'
import { formatDescriptionStyleBlock } from '@/lib/workflow/episode-split-prompt'
import {
  applyEpisodeAssetReextractPlan,
  formatEpisodeReextractPlanSummary,
  type EpisodeAssetReextractPlan,
} from '@/lib/workflow/episode-asset-reextract'
import { resolveEpisodeReextractScript } from '@/lib/workflow/episode-utils'
import {
  buildExtractedAssets,
  formatMaterializeAssetsSummary,
  resolveExtractTemplate,
  resolveQuickExtractTemplate,
  resolveQuickExtractTemplateKey,
  syncEpisodeEntityTagsFromAssets,
  type MaterializeAssetsStats,
} from '@/lib/workflow/asset-utils'
import {
  isWorkflowApiAvailable,
  patchWorkflowData,
} from '@/lib/storage/workflow-service'
import { upsertWorkflowTask } from '@/lib/workflow/task-service'

export type AssetExtractMode = 'replace_all' | 'episode_delta'

export interface AssetExtractParams {
  script: string
  /** 不传则自动使用「提取模板Lite」 */
  extractTemplateKey?: string
  /** Step2 描述风格，注入提取 Prompt */
  descriptionStyle?: string
  settings: AppSettings
  llmModelId?: string
  /**
   * replace_all：一键提取，整库替换（默认）
   * episode_delta：重提本集，同名复用 + 本集增删
   */
  mode?: AssetExtractMode
  /** episode_delta 必填：目标分集 id */
  episodeId?: string
}

export interface EpisodeAssetReextractParams {
  episode: WorkflowEpisode
  extractTemplateKey?: string
  descriptionStyle?: string
  settings: AppSettings
  llmModelId?: string
}

const MOCK_EXTRACT = {
  characters: [{ name: '主角', description: '青年，现代都市装扮，神情坚定' }],
  scenes: [{ name: '城市街道', description: '夜晚霓虹灯下的主干道，湿润路面反光' }],
  items: [{ name: '旧照片', description: '泛黄的相片，边角磨损' }],
}

function emptyStats(): MaterializeAssetsStats {
  return {
    created: 0,
    updated: 0,
    byKind: {
      character: { created: 0, updated: 0 },
      scene: { created: 0, updated: 0 },
      prop: { created: 0, updated: 0 },
    },
  }
}

function countExtractedAssets(parsed: {
  characters: unknown[]
  scenes: unknown[]
  items: unknown[]
}): MaterializeAssetsStats {
  const stats = emptyStats()
  stats.byKind.character.created = parsed.characters.length
  stats.byKind.scene.created = parsed.scenes.length
  stats.byKind.prop.created = parsed.items.length
  stats.created =
    stats.byKind.character.created + stats.byKind.scene.created + stats.byKind.prop.created
  return stats
}

async function upsertTask(projectId: string, task: WorkflowTask) {
  await upsertWorkflowTask(projectId, task)
}

async function executeAssetExtract(
  projectId: string,
  taskId: string,
  params: AssetExtractParams,
): Promise<void> {
  const mode: AssetExtractMode = params.mode ?? 'replace_all'
  const script = params.script.trim()
  if (!script) {
    throw new Error(mode === 'episode_delta' ? '本集脚本为空，无法重提资产' : '剧本为空，无法提取资产')
  }
  if (mode === 'episode_delta' && !params.episodeId?.trim()) {
    throw new Error('未指定分集，无法重提本集资产')
  }

  const episodeId = params.episodeId?.trim()
  const initialProgress =
    mode === 'episode_delta' ? '正在重提本集资产…' : '正在从全文剧本提取资产…'

  await upsertTask(projectId, {
    id: taskId,
    type: 'extract',
    status: 'running',
    progressMessage: initialProgress,
    episodeId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  try {
    let parsed = MOCK_EXTRACT
    const templateKey = resolveQuickExtractTemplateKey(params.settings, params.extractTemplateKey)

    if (isWorkflowApiAvailable() && !shouldUseE2eMockAi()) {
      const model = pickMergedLlmModel(params.settings, params.llmModelId)
      const template = templateKey
        ? resolveExtractTemplate(params.settings, templateKey)
        : resolveQuickExtractTemplate(params.settings)
      const prompt = buildExtractPrompt(script, template, {
        descriptionStyleBlock: formatDescriptionStyleBlock(params.descriptionStyle),
      })
      const templateLabel = template?.name?.trim() || template?.key || '默认'

      await upsertTask(projectId, {
        id: taskId,
        type: 'extract',
        status: 'running',
        progressMessage:
          mode === 'episode_delta'
            ? `正在使用「${model.name}」重提本集资产（${templateLabel}）…`
            : `正在使用「${model.name}」提取资产（${templateLabel}）…`,
        episodeId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      const raw = await callChatCompletions(model, prompt, {
        temperature: EXTRACT_LLM_TEMPERATURE,
      })
      parsed = parseExtractResult(raw)
    } else {
      await new Promise((r) => setTimeout(r, 800))
    }

    let materializeStats = emptyStats()
    let deltaPlan: EpisodeAssetReextractPlan | null = null

    await patchWorkflowData(projectId, (data) => {
      if (mode === 'episode_delta') {
        const episode = (data.episodes ?? []).find((ep) => ep.id === episodeId)
        if (!episode) {
          throw new Error('目标分集不存在，无法重提本集资产')
        }
        const applied = applyEpisodeAssetReextractPlan(data, episode, parsed)
        deltaPlan = applied.plan
        return {
          ...applied.data,
          extractTemplateKey: templateKey || params.extractTemplateKey || data.extractTemplateKey,
        }
      }

      const episodes = data.episodes ?? []
      const characters = buildExtractedAssets(parsed.characters, 'character', episodes)
      const scenes = buildExtractedAssets(parsed.scenes, 'scene', episodes)
      const props = buildExtractedAssets(parsed.items, 'prop', episodes)
      materializeStats = countExtractedAssets(parsed)
      const syncedEpisodes = syncEpisodeEntityTagsFromAssets({
        episodes,
        characters,
        scenes,
        props,
      })

      return {
        ...data,
        extractTemplateKey: templateKey || params.extractTemplateKey || data.extractTemplateKey,
        episodes: syncedEpisodes,
        characters,
        scenes,
        props,
      }
    })

    let progressMessage: string
    if (mode === 'episode_delta' && deltaPlan) {
      const summary = formatEpisodeReextractPlanSummary(deltaPlan)
      progressMessage =
        summary === '本集资产无变化'
          ? '本集资产无变化'
          : `已重提本集资产：${summary}`
    } else {
      const assetSummary = formatMaterializeAssetsSummary(materializeStats)
      const entityTotal = materializeStats.created
      progressMessage =
        entityTotal > 0 ? `已提取 ${assetSummary} 并同步到资产库` : '未识别到可提取资产'
    }

    await upsertTask(projectId, {
      id: taskId,
      type: 'extract',
      status: 'completed',
      progressMessage,
      episodeId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  } catch (error: unknown) {
    const err = error as Error
    await upsertTask(projectId, {
      id: taskId,
      type: 'extract',
      status: 'failed',
      errorMessage:
        err.message || (mode === 'episode_delta' ? '重提本集资产失败' : '资产提取失败'),
      episodeId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    throw err
  }
}

/** 一键提取资产：整库替换（默认 mode=replace_all） */
export function startAssetExtract(
  projectId: string,
  params: AssetExtractParams,
): { taskId: string; promise: Promise<void> } {
  const taskId = `task_${generateUUID()}`
  const promise = executeAssetExtract(projectId, taskId, {
    ...params,
    mode: params.mode ?? 'replace_all',
  })
  return { taskId, promise }
}

/** 重提本集资产：本集脚本 → LLM → episode_delta 落库 */
export function startEpisodeAssetReextract(
  projectId: string,
  params: EpisodeAssetReextractParams,
): { taskId: string; promise: Promise<void> } {
  const resolution = resolveEpisodeReextractScript(params.episode)
  if (!resolution) {
    throw new Error('本集脚本为空，无法重提资产')
  }
  return startAssetExtract(projectId, {
    script: resolution.script,
    extractTemplateKey: params.extractTemplateKey,
    descriptionStyle: params.descriptionStyle,
    settings: params.settings,
    llmModelId: params.llmModelId,
    mode: 'episode_delta',
    episodeId: params.episode.id,
  })
}
