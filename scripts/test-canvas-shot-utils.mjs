/**
 * 画布智能分镜 shot utils 回归（无需 dev server / Electron）
 *   node scripts/test-canvas-shot-utils.mjs
 */
import assert from 'node:assert/strict'
import {
  buildStoryboardShotDescriptionSavePatch,
  collectPendingStoryboardShots,
  collectPendingStoryboardShotItems,
  collectStoryboardShotNumbersFromNodes,
  formatPendingStoryboardShotLabel,
  compareNodesByStoryboardShot,
  formatDeletedStoryboardShotsToast,
  formatStoryboardShotsDeleteConfirmDescription,
  isPendingStoryboardShotNode,
  isStoryboardShotNode,
  resolveStoryboardShotNumber,
  shouldMarkStoryboardShotNeedsRegen,
  storyVideoNode,
} from './lib/canvas-shot-utils-fixtures.mjs'

function test(name, fn) {
  fn()
  console.log(`✓ ${name}`)
}

test('shotNumber 优先于 importShotNumber', () => {
  assert.equal(resolveStoryboardShotNumber({ shotNumber: 2, importShotNumber: 5 }), 2)
  assert.equal(resolveStoryboardShotNumber({ importShotNumber: 3 }), 3)
  assert.equal(resolveStoryboardShotNumber({}), undefined)
})

test('isStoryboardShotNode 仅 storyVideo 且有镜号', () => {
  assert.equal(isStoryboardShotNode(storyVideoNode('v1', 1)), true)
  assert.equal(isStoryboardShotNode({ id: 'x', type: 'imageNode', data: { shotNumber: 1 } }), false)
  assert.equal(isStoryboardShotNode(storyVideoNode('v2', undefined)), false)
})

test('compareNodesByStoryboardShot：有镜号在前，无镜号排末尾', () => {
  const free = storyVideoNode('free', undefined, { videoName: '视频  自由' })
  const shot3 = storyVideoNode('s3', 3, {})
  const shot1 = storyVideoNode('s1', 1, {})
  const sorted = [free, shot3, shot1].sort(compareNodesByStoryboardShot)
  assert.deepEqual(
    sorted.map((node) => node.id),
    ['s1', 's3', 'free'],
  )
})

test('collectPendingStoryboardShots：待生成 / 待更新 / 失败；不含 running 与已成功', () => {
  const nodes = [
    storyVideoNode('idle', 1, { status: 'idle' }),
    storyVideoNode('ready', 2, { status: 'success', outputPath: 'videos/a.mp4' }),
    storyVideoNode('regen', 3, {
      status: 'success',
      outputPath: 'videos/b.mp4',
      needsRegen: true,
    }),
    storyVideoNode('err', 4, { status: 'error' }),
    storyVideoNode('run', 5, { status: 'running' }),
    storyVideoNode('free', undefined, { status: 'idle' }),
  ]
  const pending = collectPendingStoryboardShots(nodes)
  assert.deepEqual(
    pending.map((node) => node.id),
    ['idle', 'regen', 'err', 'free'],
  )
})

test('isPendingStoryboardShotNode 边界', () => {
  assert.equal(isPendingStoryboardShotNode(storyVideoNode('a', 1, { status: 'idle' })), true)
  assert.equal(
    isPendingStoryboardShotNode(
      storyVideoNode('b', 1, { status: 'success', outputPath: 'videos/x.mp4' }),
    ),
    false,
  )
  assert.equal(isPendingStoryboardShotNode(storyVideoNode('free', undefined, { status: 'idle' })), false)
})

test('shouldMarkStoryboardShotNeedsRegen 仅成片后改 prompt', () => {
  const base = { shotNumber: 1, prompt: 'old', outputPath: 'videos/x.mp4', status: 'success' }
  assert.equal(shouldMarkStoryboardShotNeedsRegen(base, 'new'), true)
  assert.equal(shouldMarkStoryboardShotNeedsRegen(base, 'old'), false)
  assert.equal(shouldMarkStoryboardShotNeedsRegen({ shotNumber: 1, prompt: 'x' }, 'y'), false)
  assert.equal(shouldMarkStoryboardShotNeedsRegen({ prompt: 'x', outputPath: 'v.mp4' }, 'y'), false)
})

test('buildStoryboardShotDescriptionSavePatch 改描述后 needsRegen', () => {
  const data = {
    shotNumber: 2,
    prompt: '场景 A',
    dialogue: '台词',
    outputPath: 'videos/out.mp4',
    status: 'success',
  }
  const patch = buildStoryboardShotDescriptionSavePatch(data, {
    prompt: '场景 B',
    dialogue: '台词',
  })
  assert.equal(patch.prompt, '场景 B')
  assert.equal(patch.needsRegen, true)
  assert.match(String(patch.videoName), /镜 2/)
})

test('formatDeletedStoryboardShotsToast 文案', () => {
  assert.equal(formatDeletedStoryboardShotsToast([2]), '已删除镜 2')
  assert.equal(formatDeletedStoryboardShotsToast([3, 1, 3]), '已删除镜 1、镜 3')
  assert.equal(formatDeletedStoryboardShotsToast([]), null)
})

test('collectStoryboardShotNumbersFromNodes', () => {
  const nodes = [
    storyVideoNode('s1', 1),
    storyVideoNode('s2', 2),
    storyVideoNode('free', undefined),
  ]
  assert.deepEqual(collectStoryboardShotNumbersFromNodes(nodes, ['s1', 'free']), [1])
})

test('formatStoryboardShotsDeleteConfirmDescription 文案', () => {
  assert.match(formatStoryboardShotsDeleteConfirmDescription([2]), /确定删除镜 2/)
  assert.match(formatStoryboardShotsDeleteConfirmDescription([3, 1]), /镜 1、镜 3/)
  assert.equal(formatStoryboardShotsDeleteConfirmDescription([]), '删除后不可恢复。')
})

test('collectPendingStoryboardShotItems：展示镜号与名称', () => {
  const nodes = [
    storyVideoNode('d1', 1, { dialogue: '午后阳光洒落长椅', status: 'idle' }),
    storyVideoNode('d2', 4, {
      videoName: '视频  镜 4 · 蝴蝶闯入画面',
      status: 'idle',
    }),
    storyVideoNode('d3', 6, {
      prompt: '中景，少女站在校门口，阳光从右侧打来',
      status: 'idle',
    }),
    storyVideoNode('d4', undefined, {
      videoName: '视频  2',
      prompt: '爷爷和孙子在村口看夕阳',
      status: 'idle',
    }),
  ]
  const items = collectPendingStoryboardShotItems(nodes)
  assert.equal(items[0].label, '镜 1 · 午后阳光洒落长椅')
  assert.equal(items[1].label, '镜 4 · 蝴蝶闯入画面')
  assert.match(items[2].label, /^镜 6 · 中景，少女站在校门口/)
  assert.match(items[3].label, /^视频  2 · 爷爷和孙子在村口看夕阳/)
  assert.equal(items[0].title, '镜 1')
  assert.equal(items[1].title, '镜 4')
  assert.equal(items[2].title, '镜 6')
  assert.equal(items[3].title, '视频  2')
})

test('formatPendingStoryboardShotLabel：无名称时仅镜号', () => {
  assert.equal(formatPendingStoryboardShotLabel(7, ''), '镜 7')
})

console.log('\n画布智能分镜 shot utils 回归全部通过')
