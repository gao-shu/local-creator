// Copyright (c) Haode AI. All rights reserved.

import { CANVAS_PASTE_VIDEO_ACTION } from '@/lib/canvas/canvas-paste-video'

/** 添加节点菜单：非创建节点类动作 */
export const CANVAS_PROMPT_STORYBOARD_ACTION = '__prompt_storyboard__' as const
export const CANVAS_PROMPT_EXTRACT_ACTION = '__prompt_extract__' as const
export const CANVAS_PROMPT_TEMPLATE_IMPORT_ACTION = '__prompt_template_import__' as const
export const CANVAS_VIDEO_EXTRACT_AUDIO_ACTION = '__video_extract_audio__' as const

export type CanvasMenuAction =
  | typeof CANVAS_PASTE_VIDEO_ACTION
  | typeof CANVAS_PROMPT_STORYBOARD_ACTION
  | typeof CANVAS_PROMPT_EXTRACT_ACTION
  | typeof CANVAS_PROMPT_TEMPLATE_IMPORT_ACTION
  | typeof CANVAS_VIDEO_EXTRACT_AUDIO_ACTION

export function isCanvasMenuAction(type: string): type is CanvasMenuAction {
  return (
    type === CANVAS_PASTE_VIDEO_ACTION ||
    type === CANVAS_PROMPT_STORYBOARD_ACTION ||
    type === CANVAS_PROMPT_EXTRACT_ACTION ||
    type === CANVAS_PROMPT_TEMPLATE_IMPORT_ACTION ||
    type === CANVAS_VIDEO_EXTRACT_AUDIO_ACTION
  )
}
