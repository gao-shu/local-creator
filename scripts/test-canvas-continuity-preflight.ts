// Copyright (c) Haode AI. All rights reserved.
/**
 * P0 B4：导出文戏预检 + compose 冒烟（不启 Electron）
 *   npx --yes tsx scripts/test-canvas-continuity-preflight.ts
 */
import assert from 'node:assert/strict'
import type { Node } from '@xyflow/react'
import { buildCanvasExportPreflight } from '../src/lib/canvas/canvas-episode-deliverables'
import { composeCanvasVideoShotBody } from '../src/lib/canvas/canvas-video-prompt'
import { CANVAS_NODE_TYPES } from '../src/types/canvas-nodes'

function storyVideo(
  id: string,
  data: Record<string, unknown>,
): Node {
  return {
    id,
    type: CANVAS_NODE_TYPES.storyVideo,
    position: { x: 0, y: 0 },
    data,
  }
}

function test(name: string, fn: () => void) {
  fn()
  console.log(`✓ ${name}`)
}

test('compose：锚点 + prompt', () => {
  assert.equal(
    composeCanvasVideoShotBody({ spatialAnchor: '左侧站', prompt: '中景' }),
    '左侧站\n中景',
  )
  assert.equal(composeCanvasVideoShotBody({ prompt: '仅描述' }), '仅描述')
  assert.equal(composeCanvasVideoShotBody({ spatialAnchor: '  ', prompt: '' }), '')
})

test('缺锚点计入 missingSpatialAnchorLabels，不阻死 canExport', () => {
  const nodes = [
    storyVideo('v1', {
      shotNumber: 1,
      prompt: '镜一',
      status: 'success',
      outputPath: 'videos/a.mp4',
      videoName: '视频  镜 1',
    }),
    storyVideo('v2', {
      shotNumber: 2,
      spatialAnchor: '右侧窗边',
      prompt: '镜二',
      status: 'idle',
    }),
  ]
  const preflight = buildCanvasExportPreflight(nodes)
  assert.equal(preflight.readyCount, 1)
  assert.equal(preflight.canExport, true)
  assert.equal(preflight.missingSpatialAnchorLabels.length, 1)
  assert.match(preflight.missingSpatialAnchorLabels[0]!, /镜\s*1/)
  assert.equal(preflight.continuityIssues.length, 0)
})

test('节点 continuityIssues 出现在预检列表', () => {
  const nodes = [
    storyVideo('v3', {
      shotNumber: 3,
      spatialAnchor: '门口',
      prompt: '镜三',
      status: 'success',
      outputPath: 'videos/b.mp4',
      continuityIssues: [
        {
          shotNumber: 3,
          type: 'character',
          problem: '人物站位与上一镜冲突',
          suggestion: '保持门口右侧',
        },
      ],
    }),
  ]
  const preflight = buildCanvasExportPreflight(nodes)
  assert.equal(preflight.continuityIssues.length, 1)
  assert.equal(preflight.continuityIssues[0]!.type, 'character')
  assert.match(preflight.continuityIssues[0]!.problem, /站位/)
  assert.equal(preflight.canExport, true)
})

test('无镜号的自由视频不参与缺锚点检查', () => {
  const nodes = [
    storyVideo('free', {
      prompt: '自由视频',
      status: 'success',
      outputPath: 'videos/c.mp4',
      videoName: '视频  自由',
    }),
  ]
  const preflight = buildCanvasExportPreflight(nodes)
  assert.equal(preflight.missingSpatialAnchorLabels.length, 0)
  assert.equal(preflight.readyCount, 1)
})

console.log('B4 continuity preflight smoke passed')
