// Copyright (c) Haode AI. All rights reserved.

import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import type {
  CanvasAgentSkill,
  CanvasAgentSkillCategory,
  CanvasAgentSkillDefinition,
  CanvasAgentSkillId,
  CanvasAgentSkillMediaType,
} from '@/lib/canvas/canvas-agent-types'

/** 漫剧步骤类目（固定顺序 = 生产线顺序；主筛选用 mediaType） */
export interface CanvasAgentSkillCategoryMeta {
  id: CanvasAgentSkillCategory
  label: string
  pipeline: string
  description: string
}

export const CANVAS_AGENT_SKILL_CATEGORIES: CanvasAgentSkillCategoryMeta[] = [
  {
    id: 'script',
    label: '剧本',
    pipeline: '工坊 Step1',
    description: '剧本扩写、润色与风格统一',
  },
  {
    id: 'episode',
    label: '分集',
    pipeline: '工坊 Step2',
    description: '分集结构、节奏与集间衔接',
  },
  {
    id: 'asset',
    label: '资产',
    pipeline: '工坊 Step3',
    description: '角色 / 场景 / 物品提取与一致性',
  },
  {
    id: 'storyboard',
    label: '分镜',
    pipeline: '工坊 Step4 · 画布',
    description: '分镜生成、镜头逻辑与审核',
  },
  {
    id: 'image',
    label: '图片',
    pipeline: '画布生图',
    description: '图片生成与修改',
  },
  {
    id: 'video',
    label: '视频',
    pipeline: '画布生视频',
    description: '视频生成与修改',
  },
  {
    id: 'delivery',
    label: '审核交付',
    pipeline: '质检 / 导出前',
    description: '成片检查与交付前质检',
  },
]

export const CANVAS_AGENT_SKILL_MEDIA_TYPES: Array<{
  id: CanvasAgentSkillMediaType
  label: string
}> = [
  { id: 'text', label: '文本' },
  { id: 'image', label: '图片' },
  { id: 'video', label: '视频' },
]

const CATEGORY_BY_ID = new Map(
  CANVAS_AGENT_SKILL_CATEGORIES.map((item) => [item.id, item] as const),
)

export function getCanvasAgentSkillCategoryMeta(
  category: CanvasAgentSkillCategory,
): CanvasAgentSkillCategoryMeta | undefined {
  return CATEGORY_BY_ID.get(category)
}

/** Skill Registry：只列可执行 Skill（Chat 不是 Skill） */
export const CANVAS_AGENT_SKILL_DEFINITIONS: CanvasAgentSkillDefinition[] = [
  {
    id: 'review_storyboard',
    name: '审核分镜词',
    description: '只读审核镜头提示词 / 分镜正文，输出结构化问题与建议，不修改、不生成',
    mediaType: 'text',
    category: 'storyboard',
    supportedNodeTypes: [
      CANVAS_NODE_TYPES.shotPrompt,
      CANVAS_NODE_TYPES.storyVideo,
      CANVAS_NODE_TYPES.imageNode,
      'textNode',
      'storyPrompt',
    ],
    mode: 'review',
    requiresConfirmation: false,
    expensive: false,
    requiresUserInstruction: false,
  },
  {
    id: 'extract_assets',
    name: '提取资产',
    description: '从文本节点提取角色 / 场景 / 物品并生成资产节点（复用现有提取流程）',
    mediaType: 'text',
    category: 'asset',
    supportedNodeTypes: [CANVAS_NODE_TYPES.shotPrompt, 'textNode', 'storyPrompt'],
    mode: 'action',
    requiresConfirmation: false,
    expensive: false,
    requiresUserInstruction: false,
  },
  {
    id: 'smart_storyboard',
    name: '智能分镜',
    description: '根据文本生成分镜镜头节点（复用现有智能分镜流程）',
    mediaType: 'text',
    category: 'storyboard',
    supportedNodeTypes: [CANVAS_NODE_TYPES.shotPrompt, 'textNode', 'storyPrompt'],
    mode: 'action',
    requiresConfirmation: true,
    expensive: false,
    requiresUserInstruction: false,
  },
  {
    id: 'merge_image_grid',
    name: '合成九宫格',
    description: '将多张图片合成为一张宫格图（切分的反向，本地合成，不耗 API）',
    mediaType: 'image',
    category: 'image',
    supportedNodeTypes: [CANVAS_NODE_TYPES.imageNode, CANVAS_NODE_TYPES.referenceImage],
    mode: 'action',
    requiresConfirmation: false,
    expensive: false,
    requiresUserInstruction: false,
  },
  {
    id: 'edit_image',
    name: '通用修改图片',
    description: '自然语言改写图片描述并重新生成（兜底能力，适合随口修改）',
    mediaType: 'image',
    category: 'image',
    supportedNodeTypes: [CANVAS_NODE_TYPES.imageNode, CANVAS_NODE_TYPES.referenceImage],
    mode: 'action',
    requiresConfirmation: false,
    expensive: true,
    requiresUserInstruction: true,
  },
  {
    id: 'extract_voice',
    name: '提取音色',
    description: '从视频节点提取音频轨（打开现有提取流程）',
    mediaType: 'video',
    category: 'video',
    supportedNodeTypes: [CANVAS_NODE_TYPES.storyVideo],
    mode: 'action',
    requiresConfirmation: false,
    expensive: false,
    requiresUserInstruction: false,
  },
  {
    id: 'edit_video',
    name: '通用修改视频',
    description: '自然语言改写视频提示词并重新生成（兜底能力；生成前需确认）',
    mediaType: 'video',
    category: 'video',
    supportedNodeTypes: [CANVAS_NODE_TYPES.storyVideo],
    mode: 'action',
    requiresConfirmation: true,
    expensive: true,
    requiresUserInstruction: true,
  },
]

const DEFINITION_BY_ID = new Map(
  CANVAS_AGENT_SKILL_DEFINITIONS.map((item) => [item.id, item] as const),
)

export function getCanvasAgentSkillDefinition(
  skillId: CanvasAgentSkillId,
): CanvasAgentSkillDefinition | undefined {
  return DEFINITION_BY_ID.get(skillId)
}

export function listCanvasAgentSkillDefinitions(): CanvasAgentSkillDefinition[] {
  return CANVAS_AGENT_SKILL_DEFINITIONS
}

export function listCanvasAgentSkillDefinitionsByMediaType(
  mediaType: CanvasAgentSkillMediaType,
): CanvasAgentSkillDefinition[] {
  return CANVAS_AGENT_SKILL_DEFINITIONS.filter((item) => item.mediaType === mediaType)
}

export function listCanvasAgentSkillDefinitionsByCategory(
  category: CanvasAgentSkillCategory,
): CanvasAgentSkillDefinition[] {
  return CANVAS_AGENT_SKILL_DEFINITIONS.filter((item) => item.category === category)
}

/** 侧栏短标签 */
export function toCanvasAgentSkillUi(def: CanvasAgentSkillDefinition): CanvasAgentSkill {
  const labelById: Partial<Record<CanvasAgentSkillId, string>> = {
    edit_image: '改图',
    edit_video: '改视频',
    review_storyboard: '审分镜词',
    extract_voice: '提取音色',
    extract_assets: '提取资产',
    smart_storyboard: '智能分镜',
    merge_image_grid: '合成九宫格',
  }
  return {
    id: def.id,
    label: labelById[def.id] || def.name,
    hint: def.description,
    description: def.description,
    expensive: Boolean(def.expensive),
  }
}

export const CANVAS_AGENT_SKILLS: CanvasAgentSkill[] =
  CANVAS_AGENT_SKILL_DEFINITIONS.map(toCanvasAgentSkillUi)
