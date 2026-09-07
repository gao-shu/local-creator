// Copyright (c) local-creator contributors. All rights reserved.

import { CanvasNoteNode } from '@/components/canvas/canvas-note-node'
import { CanvasPromptNode } from '@/components/canvas/nodes/canvas-prompt-node'
import { CanvasReferenceImageNode } from '@/components/canvas/nodes/canvas-reference-node'
import { CanvasImageNode } from '@/components/canvas/nodes/canvas-image-node'
import { CanvasVideoNode } from '@/components/canvas/nodes/canvas-video-node'
import { CanvasVoiceNode } from '@/components/canvas/nodes/canvas-voice-node'
import { CanvasAudioNode } from '@/components/canvas/nodes/canvas-audio-node'
import { CanvasGroupNode } from '@/components/canvas/nodes/canvas-group-node'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'

export const canvasNodeTypes = {
  [CANVAS_NODE_TYPES.note]: CanvasNoteNode,
  [CANVAS_NODE_TYPES.group]: CanvasGroupNode,
  [CANVAS_NODE_TYPES.shotPrompt]: CanvasPromptNode,
  [CANVAS_NODE_TYPES.referenceImage]: CanvasReferenceImageNode,
  [CANVAS_NODE_TYPES.imageNode]: CanvasImageNode,
  [CANVAS_NODE_TYPES.storyVideo]: CanvasVideoNode,
  [CANVAS_NODE_TYPES.voiceNode]: CanvasVoiceNode,
  [CANVAS_NODE_TYPES.audioNode]: CanvasAudioNode,
  // 画镜旧数据兼容
  textNode: CanvasPromptNode,
  storyPrompt: CanvasPromptNode,
  videoPrompt: CanvasVideoNode,
}
