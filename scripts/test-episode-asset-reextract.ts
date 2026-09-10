// Copyright (c) local-creator contributors. All rights reserved.

/**
 * Step2 重提本集资产：本集 diff（复用 / 新增 / 解绑 / 删除）回归。
 * 运行：npx --yes tsx scripts/test-episode-asset-reextract.ts
 */
import assert from 'node:assert/strict'
import {
  applyEpisodeAssetReextractPlan,
  buildEpisodeAssetReextractPlan,
  createEpisodeScopedAsset,
  formatEpisodeReextractConfirmDescription,
  formatEpisodeReextractPlanSummary,
  isAssetExclusiveToEpisode,
  unbindAssetFromEpisode,
} from '../src/lib/workflow/episode-asset-reextract'
import type { ExtractResult } from '../src/lib/workflow/extract-prompt'
import type { WorkflowEpisode, WorkflowProjectData } from '../src/types/workflow'

function makeEpisode(
  index: number,
  patch?: Partial<WorkflowEpisode>,
): WorkflowEpisode {
  return {
    id: `ep_${index}`,
    episodeIndex: index,
    title: `第${index}集`,
    summary: '',
    content: `第${index}集剧本内容`,
    characters: [],
    scenes: [],
    items: [],
    ...patch,
  }
}

function makeData(partial: Partial<WorkflowProjectData>): WorkflowProjectData {
  return {
    script: '',
    currentStep: 2,
    episodes: [],
    characters: [],
    scenes: [],
    props: [],
    shots: [],
    ...partial,
  }
}

function emptyParsed(): ExtractResult {
  return { characters: [], scenes: [], items: [] }
}

{
  const asset = createEpisodeScopedAsset('character', '林娜', [2])
  assert.equal(isAssetExclusiveToEpisode(asset, makeEpisode(2)), true)
  assert.equal(isAssetExclusiveToEpisode(asset, makeEpisode(1)), false)
  const shared = createEpisodeScopedAsset('character', 'Chloe', [1, 2])
  assert.equal(isAssetExclusiveToEpisode(shared, makeEpisode(2)), false)
  const ep2 = makeEpisode(2, {
    characters: [{ name: '赵六', description: '仅标签归属' }],
  })
  const tagOnly = createEpisodeScopedAsset('character', '赵六', [], { id: 'asset_zhao' })
  assert.equal(
    isAssetExclusiveToEpisode(tagOnly, ep2, {
      kind: 'character',
      episodes: [makeEpisode(1), ep2],
    }),
    true,
    '无 episodeIndexes 但仅第2集标签应视为本集专属',
  )
  console.log('[test:episode-asset-reextract] isAssetExclusiveToEpisode: OK')
}

{
  const shared = createEpisodeScopedAsset('character', 'Chloe', [1, 2])
  const next = unbindAssetFromEpisode(shared, 2)
  assert.deepEqual(next.episodeIndexes, [1])
  assert.equal(next.episodeIndex, 1)
  console.log('[test:episode-asset-reextract] unbindAssetFromEpisode: OK')
}

{
  const ep1 = makeEpisode(1, {
    characters: [{ name: '林娜', description: '主角' }],
    content: '林娜出场',
  })
  const ep2 = makeEpisode(2, {
    characters: [
      { name: '林娜', description: '主角' },
      { name: '路人甲', description: '路人' },
    ],
    content: '林娜与路人甲对话',
  })
  const lina = createEpisodeScopedAsset('character', '林娜', [1, 2], {
    id: 'asset_lina',
    generatedImagePaths: ['images/lina.png'],
    description: '旧描述-已生图',
    prompt: '旧描述-已生图',
  })
  const passerby = createEpisodeScopedAsset('character', '路人甲', [2], {
    id: 'asset_passerby',
  })
  const data = makeData({
    episodes: [ep1, ep2],
    characters: [lina, passerby],
  })

  const parsed: ExtractResult = {
    characters: [
      { name: '林娜', description: '新描述-应被忽略因有生图' },
      { name: 'Chloe', description: '新角色' },
    ],
    scenes: [],
    items: [],
  }

  const plan = buildEpisodeAssetReextractPlan(data, ep2, parsed)
  assert.equal(plan.summary.reuse, 1, '林娜应复用')
  assert.equal(plan.summary.add, 1, 'Chloe 应新增')
  assert.equal(plan.summary.delete, 1, '路人甲仅属第2集应删除')
  assert.equal(plan.summary.unbind, 0)

  const { data: next, plan: appliedPlan } = applyEpisodeAssetReextractPlan(data, ep2, parsed, plan)
  assert.equal(appliedPlan.summary.add, 1)

  const nextLina = next.characters.find((a) => a.id === 'asset_lina')
  assert.ok(nextLina, '林娜应保留原 id')
  assert.equal(nextLina.description, '旧描述-已生图', '有生图时不覆盖描述')
  assert.ok(nextLina.episodeIndexes?.includes(2))
  assert.ok(nextLina.episodeIndexes?.includes(1), '第1集归属保留')

  assert.ok(
    next.characters.some((a) => a.name === 'Chloe'),
    'Chloe 应新增',
  )
  assert.ok(
    !next.characters.some((a) => a.id === 'asset_passerby'),
    '路人甲应删除',
  )

  // 第1集实体标签仍应有林娜
  const nextEp1 = next.episodes.find((e) => e.id === ep1.id)!
  assert.ok(nextEp1.characters.some((e) => e.name === '林娜'))

  console.log('[test:episode-asset-reextract] reuse/add/delete + keep other episode: OK')
}

{
  const ep1 = makeEpisode(1, {
    characters: [{ name: 'Chloe', description: '共有' }],
  })
  const ep2 = makeEpisode(2, {
    characters: [{ name: 'Chloe', description: '共有' }],
    content: '本集已无 Chloe',
  })
  const chloe = createEpisodeScopedAsset('character', 'Chloe', [1, 2], {
    id: 'asset_chloe',
    generatedImagePaths: ['images/chloe.png'],
  })
  const data = makeData({
    episodes: [ep1, ep2],
    characters: [chloe],
  })
  const parsed = emptyParsed()
  const plan = buildEpisodeAssetReextractPlan(data, ep2, parsed)
  assert.equal(plan.summary.unbind, 1)
  assert.equal(plan.summary.delete, 0)

  const { data: next } = applyEpisodeAssetReextractPlan(data, ep2, parsed, plan)
  const nextChloe = next.characters.find((a) => a.id === 'asset_chloe')
  assert.ok(nextChloe, '共有角色应保留在库中')
  assert.deepEqual(nextChloe.episodeIndexes, [1])
  assert.ok(
    !next.episodes.find((e) => e.id === ep2.id)!.characters.some((e) => e.name === 'Chloe'),
    '第2集标签应去掉 Chloe',
  )
  assert.ok(
    next.episodes.find((e) => e.id === ep1.id)!.characters.some((e) => e.name === 'Chloe'),
    '第1集标签保留 Chloe',
  )
  console.log('[test:episode-asset-reextract] shared unbind: OK')
}

{
  const ep1 = makeEpisode(1, { content: '第1集' })
  const ep2 = makeEpisode(2, {
    characters: [
      { name: '张三', description: '主角' },
      { name: '赵六', description: '本集独有' },
    ],
    content: '张三与赵六对话',
  })
  const zhangsan = createEpisodeScopedAsset('character', '张三', [2], { id: 'asset_zs' })
  const zhaoliu = createEpisodeScopedAsset('character', '赵六', [], {
    id: 'asset_zl',
    description: '本集独有',
  })
  const data = makeData({
    episodes: [ep1, ep2],
    characters: [zhangsan, zhaoliu],
  })
  const parsed: ExtractResult = {
    characters: [{ name: '张三', description: '主角' }],
    scenes: [],
    items: [],
  }
  const plan = buildEpisodeAssetReextractPlan(data, ep2, parsed)
  assert.equal(plan.summary.delete, 1, '赵六应删除而非空 unbind')
  assert.equal(plan.summary.unbind, 0)

  const { data: next } = applyEpisodeAssetReextractPlan(data, ep2, parsed, plan)
  assert.ok(!next.characters.some((a) => a.id === 'asset_zl'), '赵六应从 Step3 资产库移除')
  assert.ok(
    !next.episodes.find((e) => e.id === ep2.id)!.characters.some((e) => e.name === '赵六'),
    '第2集标签应无赵六',
  )
  console.log('[test:episode-asset-reextract] tag-only delete (赵六): OK')
}

{
  const plan = buildEpisodeAssetReextractPlan(
    makeData({ episodes: [makeEpisode(1)] }),
    makeEpisode(1),
    emptyParsed(),
  )
  assert.equal(formatEpisodeReextractPlanSummary(plan), '本集资产无变化')
  console.log('[test:episode-asset-reextract] formatEpisodeReextractPlanSummary: OK')
}

{
  const ep2 = makeEpisode(2, { content: '林娜与Chloe在晚宴对峙。'.repeat(2) })
  const desc = formatEpisodeReextractConfirmDescription(ep2, {
    episodeCount: 3,
    beforeAssetCount: 5,
  })
  assert.match(desc, /第 2 集/)
  assert.match(desc, /其他分集资产不受影响/)
  assert.match(desc, /已关联约 5 个资产/)
  assert.match(desc, /同名资产将保留/)
  assert.doesNotMatch(desc, /重建整部剧/)
  console.log('[test:episode-asset-reextract] formatEpisodeReextractConfirmDescription: OK')
}

console.log('[test:episode-asset-reextract] all passed')
