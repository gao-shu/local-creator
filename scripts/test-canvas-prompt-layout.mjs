/**
 * 画布三列布局回归（无需 dev server / Electron）
 *   node scripts/test-canvas-prompt-layout.mjs
 */
import assert from 'node:assert/strict'
import {
  CANVAS_GRAPH_IMAGE_HEIGHT,
  CANVAS_GRAPH_NODE_GAP_Y,
  CANVAS_GRAPH_VIDEO_STACK_HEIGHT,
  CANVAS_PROMPT_ASSET_ROW_GAP,
  imageAssetNode,
  resolveCanvasPromptAssetColumnStartY,
  resolveCanvasPromptColumnBottom,
  resolveCanvasPromptColumnX,
  resolveCanvasPromptStoryboardStartY,
  shotPromptNode,
  storyVideoNode,
  textToTargetEdge,
} from './lib/canvas-prompt-layout-fixtures.mjs'

function test(name, fn) {
  fn()
  console.log(`✓ ${name}`)
}

test('resolveCanvasPromptColumnX：三列不重叠', () => {
  const { characterColX, sceneColX, storyboardColX } = resolveCanvasPromptColumnX(100)
  assert.equal(characterColX, 100 + 280 + 72)
  assert.equal(sceneColX, characterColX + 320 + 72)
  assert.equal(storyboardColX, sceneColX + 320 + 72)
  assert.ok(characterColX < sceneColX && sceneColX < storyboardColX)
})

test('resolveCanvasPromptStoryboardStartY：无已有镜时用文本 Y', () => {
  const source = shotPromptNode('text_1', { x: 100, y: 200 })
  const startY = resolveCanvasPromptStoryboardStartY(source, [], [])
  assert.equal(startY, 200)
})

test('resolveCanvasPromptStoryboardStartY：重复分镜接在已有镜下方', () => {
  const source = shotPromptNode('text_1', { x: 100, y: 200 })
  const { storyboardColX } = resolveCanvasPromptColumnX(100)
  const existing = storyVideoNode('v1', { x: storyboardColX, y: 200, shotNumber: 1 })
  const edges = [textToTargetEdge('text_1', 'v1')]
  const startY = resolveCanvasPromptStoryboardStartY(source, [source, existing], edges)
  assert.equal(startY, 200 + CANVAS_GRAPH_VIDEO_STACK_HEIGHT + CANVAS_GRAPH_NODE_GAP_Y)
})

test('resolveCanvasPromptAssetColumnStartY：重复提取角色列下移', () => {
  const source = shotPromptNode('text_1', { x: 100, y: 200 })
  const { characterColX } = resolveCanvasPromptColumnX(100)
  const existing = imageAssetNode('char_a', { name: 'A', x: characterColX, y: 200 })
  const edges = [textToTargetEdge('text_1', 'char_a')]
  const startY = resolveCanvasPromptAssetColumnStartY(source, 'character', [source, existing], edges)
  assert.equal(startY, 200 + CANVAS_GRAPH_IMAGE_HEIGHT + CANVAS_PROMPT_ASSET_ROW_GAP)
})

test('resolveCanvasPromptAssetColumnStartY：重复提取场景列下移', () => {
  const source = shotPromptNode('text_1', { x: 100, y: 200 })
  const { sceneColX } = resolveCanvasPromptColumnX(100)
  const existing = imageAssetNode('scene_a', { role: 'scene', name: '校门', x: sceneColX, y: 200 })
  const edges = [textToTargetEdge('text_1', 'scene_a')]
  const startY = resolveCanvasPromptAssetColumnStartY(source, 'scene', [source, existing], edges)
  assert.equal(startY, 200 + CANVAS_GRAPH_IMAGE_HEIGHT + CANVAS_PROMPT_ASSET_ROW_GAP)
})

test('resolveCanvasPromptColumnBottom：场景列与角色列独立计算', () => {
  const source = shotPromptNode('text_1', { x: 100, y: 200 })
  const { characterColX, sceneColX } = resolveCanvasPromptColumnX(100)
  const char = imageAssetNode('char_a', { name: 'A', x: characterColX, y: 200 })
  const scene = imageAssetNode('scene_b', { role: 'scene', name: 'B', x: sceneColX, y: 200 })
  const edges = [textToTargetEdge('text_1', 'char_a'), textToTargetEdge('text_1', 'scene_b')]
  const nodes = [source, char, scene]
  assert.equal(
    resolveCanvasPromptColumnBottom(source, 'character', nodes, edges),
    200 + CANVAS_GRAPH_IMAGE_HEIGHT,
  )
  assert.equal(
    resolveCanvasPromptColumnBottom(source, 'scene', nodes, edges),
    200 + CANVAS_GRAPH_IMAGE_HEIGHT,
  )
})

console.log('\n画布三列布局回归全部通过')
