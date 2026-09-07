// Copyright (c) local-creator contributors. All rights reserved.

import {
  CANVAS_AGENT_SKILL_CATEGORIES,
  CANVAS_AGENT_SKILL_DEFINITIONS,
  CANVAS_AGENT_SKILL_MEDIA_TYPES,
  getCanvasAgentSkillCategoryMeta,
  getCanvasAgentSkillDefinition,
  listCanvasAgentSkillDefinitions,
  listCanvasAgentSkillDefinitionsByCategory,
  listCanvasAgentSkillDefinitionsByMediaType,
} from '@/lib/canvas/canvas-agent-skill-registry'
import type {
  CanvasAgentSkillCategory,
  CanvasAgentSkillDefinition,
  CanvasAgentSkillId,
  CanvasAgentSkillMediaType,
} from '@/lib/canvas/canvas-agent-types'
import { resolveCanvasAgentNodeTypeLabel } from '@/lib/canvas/canvas-agent-service'

const SKILL_IDS = new Set<string>(CANVAS_AGENT_SKILL_DEFINITIONS.map((item) => item.id))

export type ToolboxSkillMediaFilter = 'all' | CanvasAgentSkillMediaType
/** @deprecated 保留兼容；主筛选请用 mediaType */
export type ToolboxSkillCategoryFilter = 'all' | CanvasAgentSkillCategory

/** 工具箱 Skills 池：只读列出 Registry，禁止另起定义表 */
export function listToolboxSkillDefinitions(): CanvasAgentSkillDefinition[] {
  return listCanvasAgentSkillDefinitions()
}

export function listToolboxSkillMediaTypes() {
  return CANVAS_AGENT_SKILL_MEDIA_TYPES
}

export function listToolboxSkillCategories() {
  return CANVAS_AGENT_SKILL_CATEGORIES
}

export function filterToolboxSkillsByMediaType(
  skills: CanvasAgentSkillDefinition[],
  filter: ToolboxSkillMediaFilter,
): CanvasAgentSkillDefinition[] {
  if (filter === 'all') return skills
  return skills.filter((item) => item.mediaType === filter)
}

/** @deprecated 用 filterToolboxSkillsByMediaType */
export function filterToolboxSkillsByCategory(
  skills: CanvasAgentSkillDefinition[],
  filter: ToolboxSkillCategoryFilter,
): CanvasAgentSkillDefinition[] {
  if (filter === 'all') return skills
  return skills.filter((item) => item.category === filter)
}

export function formatCanvasAgentSkillMediaTypeLabel(
  mediaType: CanvasAgentSkillMediaType,
): string {
  return CANVAS_AGENT_SKILL_MEDIA_TYPES.find((item) => item.id === mediaType)?.label || mediaType
}

export function formatCanvasAgentSkillCategoryLabel(
  category: CanvasAgentSkillCategory,
): string {
  return getCanvasAgentSkillCategoryMeta(category)?.label || category
}

export function isCanvasAgentSkillId(value: string | null | undefined): value is CanvasAgentSkillId {
  return Boolean(value && SKILL_IDS.has(value))
}

export function parseCanvasAgentSkillQuery(
  value: string | null | undefined,
): CanvasAgentSkillId | null {
  if (!isCanvasAgentSkillId(value)) return null
  return value
}

export function formatCanvasAgentSkillModeLabel(
  mode: CanvasAgentSkillDefinition['mode'],
): string {
  return mode === 'review' ? 'Review' : 'Action'
}

/**
 * 用户可读类型：依据 Registry.expensive（会触发生图/生视频）与 mode。
 * expensive=true → 生产型；review 或非 expensive → 分析型。
 */
export function formatCanvasAgentSkillKindLabel(
  def: CanvasAgentSkillDefinition,
): string {
  if (def.mode === 'review' || !def.expensive) return '分析型'
  return '生产型'
}

export function formatCanvasAgentSkillNodeTypes(
  supportedNodeTypes: string[],
): string {
  return supportedNodeTypes
    .map((type) => resolveCanvasAgentNodeTypeLabel(type))
    .join('、')
}

export function buildCanvasAgentSkillEditorPath(
  projectId: string,
  skillId: CanvasAgentSkillId,
): string {
  const params = new URLSearchParams({ agentSkill: skillId })
  return `/canvas/${encodeURIComponent(projectId)}?${params.toString()}`
}

export function resolveCanvasProjectIdForSkillLaunch(options: {
  projects: Array<{ id: string; updatedAt: number }>
  preferredProjectId?: string | null
}): string | null {
  const { projects, preferredProjectId } = options
  if (!projects.length) return null
  if (preferredProjectId && projects.some((item) => item.id === preferredProjectId)) {
    return preferredProjectId
  }
  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt)
  return sorted[0]?.id ?? null
}

export {
  getCanvasAgentSkillCategoryMeta,
  getCanvasAgentSkillDefinition,
  listCanvasAgentSkillDefinitionsByCategory,
  listCanvasAgentSkillDefinitionsByMediaType,
}
