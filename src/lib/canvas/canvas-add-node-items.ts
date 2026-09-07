// Copyright (c) Haode AI. All rights reserved.

import type { LucideIcon } from 'lucide-react'
import {
  AudioLines,
  Circle,
  Clapperboard,
  FileStack,
  Image,
  MessageSquareText,
  Music,
  Upload,
  Video,
  Wand2,
} from 'lucide-react'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import { CANVAS_PASTE_VIDEO_ACTION } from '@/lib/canvas/canvas-paste-video'
import {
  CANVAS_PROMPT_EXTRACT_ACTION,
  CANVAS_PROMPT_STORYBOARD_ACTION,
  CANVAS_PROMPT_TEMPLATE_IMPORT_ACTION,
  CANVAS_VIDEO_EXTRACT_AUDIO_ACTION,
  type CanvasMenuAction,
} from '@/lib/canvas/canvas-menu-actions'
import {
  CANVAS_IMAGE_ROLE_MENTION_LABELS,
  CANVAS_IMAGE_ROLE_OPTIONS,
} from '@/lib/canvas/canvas-image-role'

export interface CanvasAddNodeMenuSubItem {
  key: string
  label: string
  data?: Record<string, unknown>
}

export interface CanvasAddNodeMenuItem {
  type: string
  label: string
  icon: LucideIcon
  description?: string
  badge?: string
  data?: Record<string, unknown>
  /** 悬停时在右侧展开子菜单（如图片 → 人物/场景/道具） */
  submenu?: CanvasAddNodeMenuSubItem[]
  /** 非创建节点类动作（粘贴为视频、智能分镜、提取资产等） */
  action?: CanvasMenuAction
}

export interface CanvasAddNodeMenuSection {
  title: string
  items: CanvasAddNodeMenuItem[]
}

/** 对齐 weifan-ai-ts legacy/huajing Sora2WorkflowCanvas 添加节点弹层 */
export const CANVAS_ADD_NODE_SECTIONS: CanvasAddNodeMenuSection[] = [
  {
    title: '添加节点',
    items: [
      {
        type: CANVAS_PASTE_VIDEO_ACTION,
        label: '粘贴为视频',
        icon: Circle,
        action: CANVAS_PASTE_VIDEO_ACTION,
      },
      {
        type: CANVAS_NODE_TYPES.shotPrompt,
        label: '文本',
        icon: MessageSquareText,
        description: '剧本、小说',
      },
      {
        type: CANVAS_NODE_TYPES.imageNode,
        label: '图片',
        icon: Image,
        description: 'AI 生图、上传图片',
        submenu: CANVAS_IMAGE_ROLE_OPTIONS.map((role) => ({
          key: role,
          label: CANVAS_IMAGE_ROLE_MENTION_LABELS[role],
          data: { assetRole: role, assetRoleConverted: true },
        })),
      },
      {
        type: CANVAS_NODE_TYPES.storyVideo,
        label: '视频',
        icon: Video,
        description: '宣传视频、动画、电影',
      },
      {
        type: CANVAS_NODE_TYPES.voiceNode,
        label: '音色',
        icon: Music,
        description: '绑定角色或分镜配音',
      },
    ],
  },
  {
    title: '从剧本',
    items: [
      {
        type: CANVAS_PROMPT_EXTRACT_ACTION,
        label: '提取资产',
        icon: Wand2,
        description: '提取角色与场景节点',
        action: CANVAS_PROMPT_EXTRACT_ACTION,
      },
      {
        type: CANVAS_PROMPT_STORYBOARD_ACTION,
        label: '智能分镜',
        icon: Clapperboard,
        description: '从剧本拆镜，生成带镜号视频节点',
        action: CANVAS_PROMPT_STORYBOARD_ACTION,
      },
      {
        type: CANVAS_PROMPT_TEMPLATE_IMPORT_ACTION,
        label: '导入分镜稿',
        icon: FileStack,
        description: '按镜头号模板本地解析，不调用 LLM',
        action: CANVAS_PROMPT_TEMPLATE_IMPORT_ACTION,
      },
    ],
  },
  {
    title: '从视频',
    items: [
      {
        type: CANVAS_VIDEO_EXTRACT_AUDIO_ACTION,
        label: '导出音频',
        icon: AudioLines,
        description: '从本地视频提取 mp3 参考音频',
        action: CANVAS_VIDEO_EXTRACT_AUDIO_ACTION,
      },
    ],
  },
  {
    title: '添加资源',
    items: [
      {
        type: CANVAS_NODE_TYPES.referenceImage,
        label: '上传',
        icon: Upload,
        description: '导入本地素材',
        data: { pickOnMount: true, assetRole: 'character' },
      },
    ],
  },
]

export const CANVAS_ADD_NODE_FLAT = CANVAS_ADD_NODE_SECTIONS.flatMap((section) => section.items)
