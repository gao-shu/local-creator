/**
 * 画布 data.json 自动保存合并回归
 *   npx --yes tsx scripts/test-canvas-data-persist.ts
 */
import assert from 'node:assert/strict'
import { mergeCanvasProjectDataForPersist } from '../src/lib/canvas/canvas-data-persist'

function test(name: string, fn: () => void) {
  fn()
  console.log(`✓ ${name}`)
}

test('生图成功后自动保存不被磁盘 running 态覆盖 outputPath', () => {
  const nodeId = 'img_1'
  const disk = {
    version: 1 as const,
    nodes: [
      {
        id: nodeId,
        type: 'imageNode',
        position: { x: 0, y: 0 },
        data: {
          status: 'running',
          outputPath: 'assets/images/upload_old.jpg',
          prompt: '一只小羊在吃草',
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
  const memory = {
    version: 1 as const,
    nodes: [
      {
        id: nodeId,
        type: 'imageNode',
        position: { x: 0, y: 0 },
        data: {
          status: 'success',
          outputPath: 'assets/images/gen_new.jpg',
          outputOwnerKind: 'canvas',
          outputOwnerProjectId: 'cv_test',
          statusUpdatedAt: 1_700_000_000_000,
          prompt: '一只小羊在吃草',
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }

  const merged = mergeCanvasProjectDataForPersist(disk, memory)
  const data = merged.nodes[0]?.data as Record<string, unknown>
  assert.equal(data.outputPath, 'assets/images/gen_new.jpg')
  assert.equal(data.status, 'success')
})

test('图片节点 success 始终以内存 outputPath 为准（磁盘 success 但路径旧）', () => {
  const nodeId = 'img_1'
  const disk = {
    version: 1 as const,
    nodes: [
      {
        id: nodeId,
        type: 'imageNode',
        position: { x: 0, y: 0 },
        data: {
          status: 'success',
          outputPath: 'assets/images/upload_old.jpg',
          statusUpdatedAt: 1_700_000_000_500,
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
  const memory = {
    version: 1 as const,
    nodes: [
      {
        id: nodeId,
        type: 'imageNode',
        position: { x: 0, y: 0 },
        data: {
          status: 'success',
          outputPath: 'assets/images/gen_new.jpg',
          statusUpdatedAt: 1_700_000_000_000,
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }

  const merged = mergeCanvasProjectDataForPersist(disk, memory)
  const data = merged.nodes[0]?.data as Record<string, unknown>
  assert.equal(data.outputPath, 'assets/images/gen_new.jpg')
})

test('后台视频成功写盘仍优先于内存 running', () => {
  const nodeId = 'vid_1'
  const disk = {
    version: 1 as const,
    nodes: [
      {
        id: nodeId,
        type: 'storyVideo',
        position: { x: 0, y: 0 },
        data: {
          status: 'success',
          outputPath: 'assets/videos/gen_new.mp4',
          statusUpdatedAt: 1_700_000_000_000,
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
  const memory = {
    version: 1 as const,
    nodes: [
      {
        id: nodeId,
        type: 'storyVideo',
        position: { x: 0, y: 0 },
        data: {
          status: 'running',
          outputPath: 'assets/videos/old.mp4',
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }

  const merged = mergeCanvasProjectDataForPersist(disk, memory)
  const data = merged.nodes[0]?.data as Record<string, unknown>
  assert.equal(data.outputPath, 'assets/videos/gen_new.mp4')
  assert.equal(data.status, 'success')
})

console.log('\n画布 data persist 回归全部通过')
