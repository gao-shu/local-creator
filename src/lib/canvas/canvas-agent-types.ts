// Copyright (c) local-creator contributors. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import type { CanvasMediaOwnerKind } from '@/types/canvas-nodes'

export type CanvasAgentMessageRole = 'user' | 'assistant' | 'system'

export interface CanvasAgentMessage {
  id: string
  role: CanvasAgentMessageRole
  content: string
  timestamp: number
  /** 发送时画布选中的节点摘要（展示在气泡内） */
  attachedSummaries?: CanvasAgentNodeSummary[]
  /** 发送时激活的 Skill */
  activeSkill?: CanvasAgentSkillId
}

export interface CanvasAgentNodeSummary {
  id: string
  type: string
  label: string
  entityName?: string
  /** 图片/视频自定义名称 */
  displayName?: string
  prompt: string
  hasOutput: boolean
  /** 缩略图预览路径 */
  previewPath?: string
  previewOwnerKind?: CanvasMediaOwnerKind
  previewOwnerProjectId?: string
}

/** 可执行 Skill（不含 Agent Node 上的 none） */
export type CanvasAgentSkillId =
  | 'edit_image'
  | 'edit_video'
  | 'review_storyboard'
  | 'extract_voice'
  | 'extract_assets'
  | 'smart_storyboard'
  | 'merge_image_grid'

export type CanvasAgentSkillMode = 'action' | 'review'

/** Skill 主分类（画布助手 / Skills 池筛选）：文本 | 图片 | 视频 */
export type CanvasAgentSkillMediaType = 'text' | 'image' | 'video'

/**
 * 漫剧生产步骤副标签（详情展示 / 规划用，不作主筛选）。
 */
export type CanvasAgentSkillCategory =
  | 'script'
  | 'episode'
  | 'asset'
  | 'storyboard'
  | 'image'
  | 'video'
  | 'delivery'

/** Skill 定义（v1：轻量 Registry，非插件系统） */
export interface CanvasAgentSkillDefinition {
  id: CanvasAgentSkillId
  name: string
  description: string
  /** 主分类：文本 / 图片 / 视频 */
  mediaType: CanvasAgentSkillMediaType
  /** 漫剧生产步骤副标签 */
  category: CanvasAgentSkillCategory
  supportedNodeTypes: string[]
  mode: CanvasAgentSkillMode
  requiresConfirmation?: boolean
  /** 会触发付费生成（生图/生视频） */
  expensive?: boolean
  /** 是否必须输入自然语言（行动型 Skill 多为 false） */
  requiresUserInstruction?: boolean
}

/** 侧栏 UI 展示用（由 Definition 派生） */
export interface CanvasAgentSkill {
  id: CanvasAgentSkillId
  label: string
  hint: string
  /** Skill 卡片副标题 */
  description: string
  expensive: boolean
}

export interface CanvasAgentPendingAction {
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void | Promise<void>
}

/** @deprecated 使用 CanvasAgentInput；保留字段兼容旧引用 */
export interface CanvasAgentRunContext {
  nodes: Node[]
  targetNodeIds: string[]
}

/**
 * 本次 Agent / Skill 执行的薄输入（非完整 Production Context）
 */
export interface CanvasAgentInput {
  userInstruction?: string
  targetNodeIds: string[]
  nodes: Node[]
  edges: Edge[]
  referencedNodeIds?: string[]
}

export type CanvasAgentResultStatus = 'success' | 'failed'

/**
 * Skill 统一结果。v1 的 output 按 Skill 不同可为 unknown，后续再收窄。
 */
export interface CanvasAgentResult {
  status: CanvasAgentResultStatus
  skillId: CanvasAgentSkillId
  targetNodeIds: string[]
  output?: unknown
  error?: string
}

export type CanvasStoryboardReviewVerdict = 'pass' | 'reject'

export type CanvasStoryboardReviewSeverity = 'low' | 'medium' | 'high'

export interface CanvasStoryboardReviewIssue {
  type: string
  severity: CanvasStoryboardReviewSeverity
  message: string
  suggestion?: string
}

/** review_storyboard Skill 的结构化 output */
export interface CanvasStoryboardReviewOutput {
  status: CanvasStoryboardReviewVerdict
  score: number
  issues: CanvasStoryboardReviewIssue[]
  /** 可选：模型额外说明（侧栏展示） */
  summary?: string
}

export interface CanvasAgentEditMediaOutput {
  rewrittenPrompt: string
  nodeId: string
  triggeredRun: boolean
}
