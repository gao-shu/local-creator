import type { AppSettings } from '@/types/settings'
import type {
  EpisodeEntity,
  EpisodeStyle,
  WorkflowEpisode,
  WorkflowTask,
} from '@/types/workflow'
import { callChatCompletions } from '@/lib/models/llm-client'
import { pickMergedLlmModel } from '@/lib/models/merged-model-picker'
import { shouldUseE2eMockAi } from '@/lib/e2e/e2e-mock-ai'
import { generateUUID } from '@/lib/utils'
import { buildEpisodeSplitPrompt, parseEpisodeSplitResult } from '@/lib/workflow/episode-split-prompt'
import { reindexEpisodes } from '@/lib/workflow/episode-utils'
import {
  formatMaterializeAssetsSummary,
  materializeAssetsFromEpisodes,
  resolveExtractTemplate,
  type MaterializeAssetsStats,
} from '@/lib/workflow/asset-utils'
import {
  isWorkflowApiAvailable,
  patchWorkflowData,
  readWorkflowTasks,
  writeWorkflowTasks,
} from '@/lib/storage/workflow-service'
import { upsertWorkflowTask } from '@/lib/workflow/task-service'

export interface EpisodeSplitParams {
  script: string
  style: EpisodeStyle | string
  extractTemplateKey?: string
  settings: AppSettings
}

function normalizeEpisodeEntities(raw: unknown): EpisodeEntity[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const row = item as Record<string, unknown>
      return {
        name: String(row.name || '').trim(),
        description: String(row.description || '').trim(),
      }
    })
    .filter((item) => item.name)
}

function mergeEpisodeItems(raw: Record<string, unknown>): EpisodeEntity[] {
  return normalizeEpisodeEntities([
    ...(Array.isArray(raw.items) ? raw.items : []),
    ...(Array.isArray(raw.props) ? raw.props : []),
    ...(Array.isArray(raw.creatures) ? raw.creatures : []),
  ])
}

export function normalizeSplitEpisodes(raw: Array<Record<string, unknown>>): WorkflowEpisode[] {
  const episodes = raw.map((item, idx) => ({
    id: `ep_${generateUUID()}`,
    episodeIndex: Number(item.episodeIndex) || idx + 1,
    title: String(item.title || `第 ${idx + 1} 集`).trim(),
    summary: '',
    content: String(item.content || '').trim(),
    assetScope: String(item.assetScope || item.asset_scope || '').trim(),
    characters: normalizeEpisodeEntities(item.characters),
    scenes: normalizeEpisodeEntities(item.scenes),
    items: mergeEpisodeItems(item),
  }))
  return reindexEpisodes(episodes)
}

function emptyMaterializeStats(): MaterializeAssetsStats {
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

async function upsertTask(projectId: string, task: WorkflowTask) {
  await upsertWorkflowTask(projectId, task)
}

function createMockEpisodes(script: string): WorkflowEpisode[] {
  const snippet = script.trim().slice(0, 120) || '（暂无剧本）'
  return reindexEpisodes([
    {
      id: `ep_${generateUUID()}`,
      episodeIndex: 1,
      title: '第 1 集',
      summary: '',
      content: snippet,
      assetScope: '本集主要人物与场景',
      characters: [{ name: '主角', description: '青年，现代都市装扮' }],
      scenes: [{ name: '城市街道', description: '夜晚霓虹灯下的主干道' }],
      items: [{ name: '手机', description: '亮屏智能手机' }],
    },
  ])
}

async function executeEpisodeSplit(
  projectId: string,
  taskId: string,
  params: EpisodeSplitParams,
): Promise<WorkflowEpisode[]> {
  await upsertTask(projectId, {
    id: taskId,
    type: 'episode_split',
    status: 'running',
    progressMessage: '正在智能分集并同步资产…',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  try {
    let episodes: WorkflowEpisode[]

    if (!isWorkflowApiAvailable() || shouldUseE2eMockAi()) {
      await new Promise((r) => setTimeout(r, 1200))
      episodes = createMockEpisodes(params.script)
    } else {
      const model = pickMergedLlmModel(params.settings)
      const extractTemplate = resolveExtractTemplate(params.settings, params.extractTemplateKey)
      const prompt = buildEpisodeSplitPrompt(params.script, params.style, extractTemplate)
      const templateLabel = extractTemplate?.name?.trim() || extractTemplate?.key || '默认'
      await upsertTask(projectId, {
        id: taskId,
        type: 'episode_split',
        status: 'running',
        progressMessage: `正在使用「${model.name}」分集（${templateLabel}）…`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      const raw = await callChatCompletions(model, prompt)
      episodes = normalizeSplitEpisodes(parseEpisodeSplitResult(raw))
    }

    let materializeStats: MaterializeAssetsStats = emptyMaterializeStats()

    await patchWorkflowData(projectId, (data) => {
      const materialized = materializeAssetsFromEpisodes({
        episodes,
        characters: data.characters ?? [],
        scenes: data.scenes ?? [],
        props: data.props ?? [],
      })
      materializeStats = materialized.stats
      return {
        ...data,
        episodePlan: 'ai_split',
        style: params.style,
        extractTemplateKey: params.extractTemplateKey ?? data.extractTemplateKey,
        episodes,
        characters: materialized.characters,
        scenes: materialized.scenes,
        props: materialized.props,
      }
    })

    const stats = materializeStats
    const assetSummary = formatMaterializeAssetsSummary(stats)
    const entityTotal = stats.created

    await upsertTask(projectId, {
      id: taskId,
      type: 'episode_split',
      status: 'completed',
      progressMessage:
        entityTotal > 0
          ? `已生成 ${episodes.length} 集，重建 ${assetSummary} 到资产库`
          : `已生成 ${episodes.length} 集，资产库已清空`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    return episodes
  } catch (error: unknown) {
    const err = error as Error
    await upsertTask(projectId, {
      id: taskId,
      type: 'episode_split',
      status: 'failed',
      errorMessage: err.message || '分集失败',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    throw err
  }
}

export function startEpisodeSplit(
  projectId: string,
  params: EpisodeSplitParams,
): { taskId: string; promise: Promise<WorkflowEpisode[]> } {
  const taskId = `task_${generateUUID()}`
  const promise = executeEpisodeSplit(projectId, taskId, params)
  return { taskId, promise }
}

export function getActiveEpisodeSplitTask(
  tasks: WorkflowTask[],
  projectId?: string,
): WorkflowTask | null {
  const sessionId = projectId ? getEpisodeSplitSessionTaskId(projectId) : null
  const running = tasks.filter(
    (t) => t.type === 'episode_split' && (t.status === 'pending' || t.status === 'running'),
  )
  if (!running.length) return null
  if (!sessionId) return null
  return running.find((t) => t.id === sessionId) ?? null
}

const EPISODE_SPLIT_SESSION_PREFIX = 'lc:episode-split:'
export const EPISODE_SPLIT_HANG_MS = 10 * 60 * 1000

function getEpisodeSplitSessionTaskId(projectId: string) {
  try {
    return sessionStorage.getItem(`${EPISODE_SPLIT_SESSION_PREFIX}${projectId}`)
  } catch {
    return null
  }
}

export function setEpisodeSplitSessionTaskId(projectId: string, taskId: string) {
  sessionStorage.setItem(`${EPISODE_SPLIT_SESSION_PREFIX}${projectId}`, taskId)
}

export function clearEpisodeSplitSessionTaskId(projectId: string) {
  sessionStorage.removeItem(`${EPISODE_SPLIT_SESSION_PREFIX}${projectId}`)
}

/** 清理已中断或超时的分集任务（应用关闭后 tasks.json 可能仍为 running） */
export async function reconcileStaleEpisodeSplitTasks(
  projectId: string,
): Promise<WorkflowTask | null> {
  const sessionTaskId = getEpisodeSplitSessionTaskId(projectId)
  const tasks = await readWorkflowTasks(projectId)
  const now = Date.now()
  let changed = false
  let failedTask: WorkflowTask | null = null

  const next = tasks.map((task) => {
    if (task.type !== 'episode_split' || (task.status !== 'pending' && task.status !== 'running')) {
      return task
    }

    const updatedAt = task.updatedAt ?? task.createdAt ?? 0
    const sameSession = sessionTaskId === task.id
    const hung = now - updatedAt > EPISODE_SPLIT_HANG_MS

    if (sameSession && !hung) return task

    changed = true
    const failed: WorkflowTask = {
      ...task,
      status: 'failed',
      errorMessage: hung ? '分集超时，请稍后重试' : '分集已中断，请重新点击 AI 智能分集',
      progressMessage: '分集已中断',
      updatedAt: now,
    }
    failedTask = failed
    return failed
  })

  const latestCompletedAt = tasks
    .filter((t) => t.type === 'episode_split' && t.status === 'completed')
    .reduce((max, t) => Math.max(max, t.updatedAt ?? t.createdAt ?? 0), 0)

  const reconciled = next.map((task) => {
    if (task.type !== 'episode_split' || (task.status !== 'pending' && task.status !== 'running')) {
      return task
    }
    const updatedAt = task.updatedAt ?? task.createdAt ?? 0
    if (latestCompletedAt > updatedAt) {
      changed = true
      const failed: WorkflowTask = {
        ...task,
        status: 'failed',
        errorMessage: '分集已中断，请重新点击 AI 智能分集',
        progressMessage: '分集已中断',
        updatedAt: now,
      }
      failedTask = failedTask ?? failed
      return failed
    }
    return task
  })

  if (!changed) return null

  await writeWorkflowTasks(projectId, reconciled)
  if (sessionTaskId && failedTask?.id === sessionTaskId) {
    clearEpisodeSplitSessionTaskId(projectId)
  }
  return failedTask
}

export const EPISODE_SPLIT_POLL_MS = 3000
