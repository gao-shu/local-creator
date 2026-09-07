import { hasWorkflowEpisodePlan, hasWorkflowScriptContent } from '@/lib/workflow/episode-utils'
import type { WorkflowProjectData, WorkflowProjectMeta, WorkflowStep } from '@/types/workflow'

/** 将任意 step 值规范为 1–4，避免无效路由被全局 * 重定向到首页 */
export function normalizeWorkflowStep(value: unknown, fallback: WorkflowStep = 1): WorkflowStep {
  const n = typeof value === 'number' ? value : Number(value)
  if (Number.isInteger(n) && n >= 1 && n <= 4) return n as WorkflowStep
  return fallback
}

function bumpStep(step: WorkflowStep, min: WorkflowStep): WorkflowStep {
  return Math.max(step, min) as WorkflowStep
}

/**
 * 根据项目内容计算可访问的最大步骤（不读取上次停留步骤）。
 * 空剧本自由创作：已有默认「第 1 集」占位时允许进入 Step2+（与 bootstrapFirstEpisodeView 一致）。
 */
export function resolveMaxWorkflowStep(
  _meta: WorkflowProjectMeta | null | undefined,
  data: WorkflowProjectData | null | undefined,
): WorkflowStep {
  let step: WorkflowStep = 1
  if (!data) return step

  const episodes = Array.isArray(data.episodes) ? data.episodes : []
  const hasEpisodes = episodes.length > 0

  if (hasWorkflowScriptContent(data) || hasWorkflowEpisodePlan(data) || hasEpisodes) {
    step = bumpStep(step, 2)
  }

  const hasProjectAssets =
    data.characters.length > 0 || data.scenes.length > 0 || data.props.length > 0
  const hasEpisodeAssets = episodes.some(
    (ep) => ep.characters.length > 0 || ep.scenes.length > 0 || ep.items.length > 0,
  )
  if (hasProjectAssets || hasEpisodeAssets || hasEpisodes) {
    step = bumpStep(step, 3)
  }

  if (hasWorkflowEpisodePlan(data) || data.shots.length > 0 || hasEpisodes) {
    step = bumpStep(step, 4)
  }

  return step
}

/** 重新打开项目时应进入的步骤：上次停留步骤，且不超过内容解锁上限 */
export function resolveResumeStep(
  meta: WorkflowProjectMeta | null | undefined,
  data: WorkflowProjectData | null | undefined,
): WorkflowStep {
  const max = resolveMaxWorkflowStep(meta, data)
  const saved = normalizeWorkflowStep(data?.currentStep ?? meta?.currentStep ?? 1)
  return Math.min(saved, max) as WorkflowStep
}

export function isScriptEnhancedAiAvailable(data: WorkflowProjectData | null | undefined): boolean {
  return Boolean(data?.script.trim())
}

export function parseStepFromPath(value: string | undefined): WorkflowStep {
  const match = value?.match(/\/step\/(\d+)/)
  return normalizeWorkflowStep(match?.[1])
}
