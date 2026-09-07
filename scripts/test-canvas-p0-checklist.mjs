/**
 * 画布 P0 清单回归（无需 dev server / Electron）
 *   node scripts/test-canvas-p0-checklist.mjs
 * 智能分镜 shot utils：node scripts/test-canvas-shot-utils.mjs
 * 聚合：npm run test:canvas-p0
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import {
  isCanvasProjectDirName,
  mergeCanvasProjectDataForPersist,
  normalizeCanvasProjectDataFromDisk,
  resolveSafeCanvasProjectDir,
} from './lib/canvas-p0-fixtures.mjs'

function test(name, fn) {
  fn()
  console.log(`✓ ${name}`)
}

test('P0：normalizeCanvasData 忽略旧版 videoParams', () => {
  const raw = {
    version: 1,
    nodes: [],
    edges: [],
    viewport: { x: 1, y: 2, zoom: 0.8 },
    videoParams: {
      videoModelId: 'model_test',
      referenceMode: 'first_frame',
      durationSec: 5,
      aspectRatio: '9:16',
      resolution: '720p',
    },
  }
  const normalized = normalizeCanvasProjectDataFromDisk(raw)
  assert.equal(normalized.videoParams, undefined)
  assert.equal(normalized.viewport.zoom, 0.8)
})

test('P0：normalizeCanvasData 剥离节点废弃 model 字段', () => {
  const normalized = normalizeCanvasProjectDataFromDisk({
    version: 1,
    nodes: [
      { id: 'p1', type: 'shotPrompt', position: { x: 0, y: 0 }, data: { prompt: 'x', llmModelId: 'old' } },
      { id: 'i1', type: 'imageNode', position: { x: 0, y: 0 }, data: { imageModelId: 'old_img' } },
    ],
    edges: [],
  })
  assert.equal(normalized.nodes[0].data.llmModelId, undefined)
  assert.equal(normalized.nodes[1].data.imageModelId, undefined)
})

test('P0：自动保存合并不再写入 videoParams（软件级 settings 为来源）', () => {
  const disk = normalizeCanvasProjectDataFromDisk({
    version: 1,
    nodes: [{ id: 'n1', type: 'storyVideo', position: { x: 0, y: 0 }, data: {} }],
    edges: [],
    videoParams: { videoModelId: 'from_disk', durationSec: 5 },
  })
  const memory = {
    version: 1,
    nodes: disk.nodes,
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
  const merged = mergeCanvasProjectDataForPersist(disk, memory)
  assert.equal(merged.videoParams, undefined)
})

test('P0：normalizeCanvasData 剥离废弃 settings 字段', () => {
  const normalized = normalizeCanvasProjectDataFromDisk({
    version: 1,
    nodes: [],
    edges: [],
    settings: { autoConnectAssetsToShots: false },
  })
  assert.deepEqual(normalized.settings, {})

  const defaulted = normalizeCanvasProjectDataFromDisk({ version: 1, nodes: [], edges: [] })
  assert.deepEqual(defaulted.settings, {})
})

test('P0：自动保存合并 settings 为空对象', () => {
  const disk = normalizeCanvasProjectDataFromDisk({
    version: 1,
    nodes: [],
    edges: [],
    settings: { autoConnectAssetsToShots: false },
  })
  const memory = {
    version: 1,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    settings: { autoConnectAssetsToShots: true },
  }
  const merged = mergeCanvasProjectDataForPersist(disk, memory)
  assert.deepEqual(merged.settings, {})
})

test('P0：合法 canvas projectId', () => {
  assert.equal(isCanvasProjectDirName('cv_abc'), true)
  assert.equal(isCanvasProjectDirName('cv_dev_preview'), true)
})

test('P0：拒绝非法 projectId（路径穿越）', () => {
  assert.equal(isCanvasProjectDirName('../etc/passwd'), false)
  assert.equal(isCanvasProjectDirName('cv_../../../../windows'), false)
  assert.equal(isCanvasProjectDirName('cv_abc/def'), false)
  assert.equal(isCanvasProjectDirName('wf_abc'), false)
  assert.equal(isCanvasProjectDirName(''), false)
})

test('P0：resolveSafeCanvasProjectDir 拒绝越界路径', () => {
  const root = 'E:/data/canvas'
  assert.throws(
    () => resolveSafeCanvasProjectDir(root, 'cv_../../../../windows'),
    /无效的画布项目 ID/,
  )
  const dir = resolveSafeCanvasProjectDir(root, 'cv_abc123')
  assert.ok(dir.endsWith(`${path.sep}cv_abc123`) || dir.endsWith('/cv_abc123'))
})

console.log('\n画布 P0 清单回归全部通过')
console.log('（智能分镜 shot utils 见 npm run test:canvas-shot-utils 或 npm run test:canvas-p0 聚合）')
