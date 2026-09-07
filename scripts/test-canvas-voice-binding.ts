/**
 * 轻薄方案 L4：音色绑定规则冒烟（人物→音色）
 */
import assert from 'node:assert/strict'
import type { Node } from '@xyflow/react'
import { createConnectedCanvasNode } from '../src/lib/canvas/canvas-add-node-connection'
import {
  CANVAS_VOICE_BIND_ONLY_FROM_CHARACTER,
  canBindVoiceFromCharacter,
  isCanvasVoiceAwareConnectionAllowed,
  resolveCanvasConnectionEndpoints,
} from '../src/lib/canvas/canvas-voice-binding'
import { CANVAS_NODE_TYPES } from '../src/types/canvas-nodes'

function node(partial: Partial<Node> & Pick<Node, 'id' | 'type'>): Node {
  return {
    position: { x: 0, y: 0 },
    data: {},
    ...partial,
  } as Node
}

const character = node({
  id: 'char-1',
  type: CANVAS_NODE_TYPES.imageNode,
  data: { assetRole: 'character', assetRoleConverted: true, imageName: '主角' },
})
const scene = node({
  id: 'scene-1',
  type: CANVAS_NODE_TYPES.imageNode,
  data: { assetRole: 'scene', assetRoleConverted: true, imageName: '教室' },
})
const rawImage = node({
  id: 'img-raw',
  type: CANVAS_NODE_TYPES.imageNode,
  data: { assetRole: 'character', imageName: '未转换' },
})
const voice = node({ id: 'voice-1', type: CANVAS_NODE_TYPES.voiceNode, data: {} })
const video = node({ id: 'video-1', type: CANVAS_NODE_TYPES.storyVideo, data: {} })
const prompt = node({ id: 'prompt-1', type: CANVAS_NODE_TYPES.shotPrompt, data: { prompt: '' } })

// 1) 人物 → 音色：允许
assert.equal(canBindVoiceFromCharacter(character, voice), true)
assert.equal(isCanvasVoiceAwareConnectionAllowed(character, voice), true)

// 2) 音色 → 人物 / 音色作 source：不允许
assert.equal(canBindVoiceFromCharacter(voice, character), false)
assert.equal(isCanvasVoiceAwareConnectionAllowed(voice, character), false)

// 3) 视频/场景/文本 ↔ 音色：不允许
assert.equal(isCanvasVoiceAwareConnectionAllowed(video, voice), false)
assert.equal(isCanvasVoiceAwareConnectionAllowed(scene, voice), false)
assert.equal(isCanvasVoiceAwareConnectionAllowed(prompt, voice), false)
assert.equal(isCanvasVoiceAwareConnectionAllowed(voice, video), false)

// 未转换「人物」图不算合法人物
assert.equal(canBindVoiceFromCharacter(rawImage, voice), false)

// 非音色边一律放行
assert.equal(isCanvasVoiceAwareConnectionAllowed(character, video), true)
assert.equal(isCanvasVoiceAwareConnectionAllowed(video, prompt), true)

// 端点解析
const nodes = [character, voice, video]
const endpoints = resolveCanvasConnectionEndpoints(
  { source: 'char-1', target: 'voice-1' },
  nodes,
)
assert.equal(endpoints.source?.id, 'char-1')
assert.equal(endpoints.target?.id, 'voice-1')
assert.equal(isCanvasVoiceAwareConnectionAllowed(endpoints.source, endpoints.target), true)

// 4) 人物右键「添加音色」同向：direction=source → 人物→音色
const { node: newVoice, edge } = createConnectedCanvasNode(
  CANVAS_NODE_TYPES.voiceNode,
  { x: 100, y: 100 },
  { direction: 'source', nodeId: character.id, handleId: 'right' },
)
assert.ok(edge)
assert.equal(edge!.source, character.id)
assert.equal(edge!.target, newVoice.id)
assert.equal(
  isCanvasVoiceAwareConnectionAllowed(
    character,
    { ...newVoice, type: CANVAS_NODE_TYPES.voiceNode },
  ),
  true,
)

// 场景右键加音色边应被规则拒绝（节点仍可创建，边应拦）
const sceneAdd = createConnectedCanvasNode(
  CANVAS_NODE_TYPES.voiceNode,
  { x: 120, y: 120 },
  { direction: 'source', nodeId: scene.id, handleId: 'right' },
)
assert.ok(sceneAdd.edge)
assert.equal(
  isCanvasVoiceAwareConnectionAllowed(scene, {
    ...sceneAdd.node,
    type: CANVAS_NODE_TYPES.voiceNode,
  }),
  false,
)

assert.equal(CANVAS_VOICE_BIND_ONLY_FROM_CHARACTER, '音色只能由人物节点连入')

console.log('L4 canvas voice binding smoke: OK')
