import type { AppSettings } from '@/types/settings'
import type { WorkflowEpisode, WorkflowProjectData, WorkflowShot } from '@/types/workflow'
import { callChatCompletions } from '@/lib/models/llm-client'
import { pickMergedLlmModel } from '@/lib/models/merged-model-picker'
import { shouldUseE2eMockAi } from '@/lib/e2e/e2e-mock-ai'
import { readSettings } from '@/lib/storage/settings-service'
import { isWorkflowApiAvailable } from '@/lib/storage/workflow-service'
import {
  buildStoryboardPrompt,
  buildValidatePrompt,
  buildEpisodeScriptSummary,
  chunkShotsForValidate,
  parseStoryboardResult,
  parseValidateResult,
  resolveStoryboardTemplate,
  resolveStoryboardValidateMode,
  STORYBOARD_VALIDATE_BATCH_SIZE,
  STORYBOARD_VALIDATE_CONTEXT_LOOKBACK,
  type ParsedStoryboardItem,
  type ParsedValidateIssue,
  type StoryboardValidateMode,
  type ValidatePromptShotInput,
} from '@/lib/workflow/storyboard-prompt'
import { collectEpisodeAssets, normalizeShot, syncShotReferencedAssets } from '@/lib/workflow/shot-utils'
import { autoSyncShotReferencedAssets } from '@/lib/workflow/shot-asset-matcher'
import { buildMentionCandidates, normalizeMentionSource } from '@/lib/workflow/mention-utils'
import { generateUUID } from '@/lib/utils'
import {
  validateStoryboardFormat,
  type StoryboardFormatQaResult,
} from '@/lib/workflow/storyboard-format-qa'

async function resolveSettings(settings?: AppSettings) {
  if (settings) return settings
  const res = await readSettings()
  return res.data
}

const MOCK_STORYBOARD = [
  {
    shot_number: 1,
    dialogue: '午后阳光洒落长椅',
    prompt:
      '远景，平视，固定机位，公园全景。阳光透过树叶洒在空荡木质长椅上，微风拂动，画面宁静温暖，高清写实',
    spatial_anchor: '长椅居中偏右，树荫从左上方投射',
  },
  {
    shot_number: 2,
    dialogue: '她翻动书页的侧影',
    prompt:
      '中近景，平视，缓慢横移。少女坐于长椅左侧低头翻阅旧书，手指轻拨书页，发丝被风吹起，背景虚化',
    spatial_anchor: '人物居画面左侧三分之一，光源来自右上方',
  },
  {
    shot_number: 3,
    dialogue: '蝴蝶闯入画面',
    prompt: '特写，平视，固定。蓝色蝴蝶从右侧飞入落在书页边缘，翅膀缓慢扇动，背景柔焦',
    spatial_anchor: '蝴蝶落于书页右下，书页占画面主体',
  },
]

export function storyboardItemsToShots(
  items: ReturnType<typeof parseStoryboardResult>,
  episode: WorkflowEpisode,
  data?: WorkflowProjectData,
): WorkflowShot[] {
  const now = Date.now()
  const candidates = data ? buildMentionCandidates(collectEpisodeAssets(data, episode)) : []
  return items.map((item) => {
    const shot = normalizeShot(
      {
        id: `shot_${generateUUID()}`,
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
    const synced = candidates.length ? syncShotReferencedAssets(shot, candidates) : shot
    return candidates.length ? autoSyncShotReferencedAssets(synced, candidates) : synced
  })
}

export interface InferEpisodeStoryboardResult {
  shots: WorkflowShot[]
  /** mock / 非 Seedance 模板时可能为空或 skipped */
  formatQa?: StoryboardFormatQaResult
}

function buildStoryboardInferenceResult(
  parsed: ParsedStoryboardItem[],
  templateKey: string,
  episode: WorkflowEpisode,
  data?: WorkflowProjectData,
  options?: { skipFormatQa?: boolean },
): InferEpisodeStoryboardResult {
  const formatQa = options?.skipFormatQa
    ? undefined
    : validateStoryboardFormat(parsed, templateKey)
  return {
    shots: storyboardItemsToShots(parsed, episode, data),
    formatQa,
  }
}

export async function inferEpisodeStoryboard(
  data: WorkflowProjectData,
  episode: WorkflowEpisode,
  options?: {
    settings?: AppSettings
    storyboardTemplateKey?: string
    projectId?: string
  },
): Promise<InferEpisodeStoryboardResult> {
  const content = episode.content.trim()
  if (!content) throw new Error('本集剧本为空，无法推理分镜')

  const settings = await resolveSettings(options?.settings)
  const assets = collectEpisodeAssets(data, episode)
  const template = resolveStoryboardTemplate(
    settings,
    options?.storyboardTemplateKey ?? data.storyboardTemplateKey,
  )
  const prompt = buildStoryboardPrompt(episode, assets, template, settings)

  if (!isWorkflowApiAvailable() || shouldUseE2eMockAi()) {
    await new Promise((r) => setTimeout(r, 1200))
    const parsed = parseStoryboardResult(JSON.stringify({ storyboard: MOCK_STORYBOARD }))
    return buildStoryboardInferenceResult(parsed, template.key, episode, data, {
      skipFormatQa: true,
    })
  }

  const model = pickMergedLlmModel(settings)

  const raw = await callChatCompletions(model, prompt)
  const parsed = parseStoryboardResult(raw)
  return buildStoryboardInferenceResult(parsed, template.key, episode, data)
}

export interface ValidateEpisodeStoryboardResult {
  shots: WorkflowShot[]
  passed?: boolean
  summary?: string
  issues: ParsedValidateIssue[]
  /** 实际 LLM 批次数（≤1 表示未分批） */
  batchCount?: number
  /** 本次实际使用的档位 */
  mode?: StoryboardValidateMode
}

function toValidatePromptInput(shot: WorkflowShot): ValidatePromptShotInput {
  return {
    shotNumber: shot.shotNumber,
    dialogue: shot.dialogue,
    prompt: shot.prompt,
    spatialAnchor: shot.spatialAnchor,
  }
}

export async function validateEpisodeStoryboard(
  shots: WorkflowShot[],
  options?: {
    settings?: AppSettings
    projectId?: string
    /** 覆盖默认分批大小（测试用） */
    batchSize?: number
    lookback?: number
    /** 显式档位；缺省则按 settings + isInternal 解析 */
    mode?: StoryboardValidateMode
    isInternal?: boolean
    /** 本集原文（深度档截断注入） */
    episodeContent?: string
  },
): Promise<ValidateEpisodeStoryboardResult> {
  if (!shots.length) throw new Error('暂无分镜可验证')

  const settings = await resolveSettings(options?.settings)
  const mode = resolveStoryboardValidateMode(
    options?.mode ?? settings.storyboardValidateMode,
    Boolean(options?.isInternal),
  )
  const scriptSummary =
    mode === 'deep' ? buildEpisodeScriptSummary(options?.episodeContent) : ''

  if (!isWorkflowApiAvailable() || shouldUseE2eMockAi()) {
    await new Promise((r) => setTimeout(r, 800))
    // 仅补空间锚点，不改 prompt、不标记生图已审核；附带一条 issues 便于验收弹窗列表
    const sampleShotNumber = shots[1]?.shotNumber ?? shots[0]?.shotNumber
    const issues: ParsedValidateIssue[] =
      mode === 'deep' && sampleShotNumber != null
        ? [
            {
              shotNumber: sampleShotNumber,
              type: '姿势继承',
              problem: '相邻镜头姿势需注意连贯（mock 示例提示）',
              suggestion: '若未写起身/坐下等动作，锚点应延续上一镜结束态',
            },
          ]
        : []
    return {
      shots: shots.map((shot) => ({
        ...shot,
        spatialAnchor: shot.spatialAnchor || '主场景居中，人物面向镜头，顶侧柔光',
        updatedAt: Date.now(),
      })),
      passed: issues.length === 0,
      summary: issues.length
        ? `已补充空间锚点（mock·深度），发现 ${issues.length} 条连续性提示`
        : `已补充空间锚点（mock·${mode === 'deep' ? '深度' : '快速'}）`,
      issues,
      batchCount: 1,
      mode,
    }
  }

  const batchSize = options?.batchSize ?? STORYBOARD_VALIDATE_BATCH_SIZE
  const lookback = Math.max(0, options?.lookback ?? STORYBOARD_VALIDATE_CONTEXT_LOOKBACK)
  const batches = chunkShotsForValidate(shots, batchSize)
  const model = pickMergedLlmModel(settings)
  // 计费走 callChatCompletions 内既有扣费，此处勿再包一层以免双扣

  // 用 working 累积已生成锚点，供后续批 lookback 继承
  let working = shots.map((shot) => ({ ...shot }))
  const allIssues: ParsedValidateIssue[] = []
  const summaries: string[] = []
  let passedAll = true
  let mergedCount = 0
  let offset = 0

  for (const batch of batches) {
    const batchStart = offset
    offset += batch.length
    const batchNumbers = new Set(batch.map((shot) => shot.shotNumber))
    const contextShots =
      lookback > 0 && batchStart > 0
        ? working
            .slice(Math.max(0, batchStart - lookback), batchStart)
            .map(toValidatePromptInput)
        : []

    const prompt = buildValidatePrompt(batch.map(toValidatePromptInput), {
      contextShots,
      mode,
      // 深度档：每批都带同一份原文摘要（已截断），便于对照剧本
      scriptSummary: scriptSummary || undefined,
    })
    const raw = await callChatCompletions(model, prompt)
    const validated = parseValidateResult(raw)
    const map = new Map(
      validated.shots
        .filter((item) => batchNumbers.has(item.shotNumber))
        .map((item) => [item.shotNumber, item]),
    )

    working = working.map((shot) => {
      if (!batchNumbers.has(shot.shotNumber)) return shot
      const hit = map.get(shot.shotNumber)
      if (!hit?.spatialAnchor) return shot
      mergedCount += 1
      return {
        ...shot,
        spatialAnchor: hit.spatialAnchor,
        updatedAt: Date.now(),
      }
    })

    allIssues.push(...validated.issues)
    if (validated.passed === false) passedAll = false
    if (validated.summary) summaries.push(validated.summary)
  }

  if (mergedCount === 0) {
    throw new Error('二次验证结果与当前分镜无法对应，未改动任何数据')
  }

  if (allIssues.length > 0) passedAll = false

  const modeHint = mode === 'deep' ? '深度档' : '快速档'
  const batchHint =
    batches.length > 1 ? `分 ${batches.length} 批完成（每批最多 ${batchSize} 镜）。` : ''
  const joinedSummary = summaries.filter(Boolean).join('；')
  const summary =
    [`[${modeHint}]`, batchHint, joinedSummary].filter(Boolean).join(' ').trim() || undefined

  return {
    shots: working,
    passed: passedAll,
    ...(summary ? { summary } : {}),
    issues: allIssues,
    batchCount: batches.length,
    mode,
  }
}
