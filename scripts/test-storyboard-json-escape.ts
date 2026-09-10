// Copyright (c) local-creator contributors. All rights reserved.

/**
 * Step4 推理分镜：LLM 回包含 Markdown 非法 JSON 转义时的解析回归。
 * 运行：npx --yes tsx scripts/test-storyboard-json-escape.ts
 */
import assert from 'node:assert/strict'
import { buildStoryboardPrompt, parseStoryboardResult } from '../src/lib/workflow/storyboard-prompt'
import { storyboardItemsToShots } from '../src/lib/workflow/storyboard-service'
import type { WorkflowEpisode, WorkflowProjectData } from '../src/types/workflow'

/** 模拟模型把剧本 Markdown 转义原样写进 JSON 字段（修复前 JSON.parse 会失败） */
const MOCK_LLM_RESPONSE_WITH_BAD_ESCAPES = [
  '{',
  '  "storyboard": [',
  '    {',
  '      "shot_number": 1,',
  '      "dialogue": "死神穿上了百褶裙",',
  '      "prompt": "中景，St\\. Pria贵族学院大门，Chloe \\(Death in a Pleated Skirt\\) 迈出。SCENE 1\\-1 外 \\- 日。心声：What are you doing\\! Let go\\.",',
  '      "spatial_anchor": "校门居中偏右，顶侧冷日光"',
  '    },',
  '    {',
  '      "shot_number": 2,',
  '      "dialogue": "Lina泼红酒被反制",',
  '      "prompt": "近景，Lina（做作地惊呼）：Oops—\\! 红酒杯啪地落地。Chloe：Did you trip, Senior\\? go\\.\\.\\.",',
  '      "spatial_anchor": "晚宴角落，Chloe 居左，顶光"',
  '    }',
  '  ]',
  '}',
].join('\n')

const EPISODE_WITH_MARKDOWN_ESCAPES: WorkflowEpisode = {
  id: 'ep_test_1',
  episodeIndex: 1,
  title: '第1集：死神穿上了百褶裙',
  summary: '',
  content: [
    '### **第1集：死神穿上了百褶裙 \\(Death in a Pleated Skirt\\)**',
    '**SCENE 1\\-1**',
    '外 \\- St\\. Pria贵族学院大门 \\- 日',
    '-Chloe（心声）：“What are you doing\\! Let go, you are hurting me\\!”',
  ].join('\n'),
  updatedAt: Date.now(),
}

const PROJECT_DATA: WorkflowProjectData = {
  script: EPISODE_WITH_MARKDOWN_ESCAPES.content,
  projectStylePresetKey: 'style_realistic',
  currentStep: 4,
  episodes: [EPISODE_WITH_MARKDOWN_ESCAPES],
  characters: [],
  scenes: [],
  props: [],
  shots: [],
}

function testDirectJsonParseFails() {
  assert.throws(
    () => JSON.parse(MOCK_LLM_RESPONSE_WITH_BAD_ESCAPES),
    /Bad escaped character|Invalid escape character/,
    '原始 LLM 回包应无法被 JSON.parse 直接解析',
  )
  console.log('[test:storyboard-json-escape] direct JSON.parse fails as expected: OK')
}

function testParseStoryboardResult() {
  const items = parseStoryboardResult(MOCK_LLM_RESPONSE_WITH_BAD_ESCAPES)
  assert.equal(items.length, 2)
  assert.equal(items[0]?.shotNumber, 1)
  assert.match(items[0]?.prompt ?? '', /St\. Pria/)
  assert.match(items[0]?.prompt ?? '', /\(Death in a Pleated Skirt\)/)
  assert.match(items[0]?.prompt ?? '', /SCENE 1-1/)
  assert.match(items[0]?.prompt ?? '', /What are you doing!/)
  assert.match(items[1]?.prompt ?? '', /Oops—!/)
  assert.match(items[1]?.prompt ?? '', /go\.\.\./)
  console.log('[test:storyboard-json-escape] parseStoryboardResult: OK')
}

function testStoryboardItemsToShots() {
  const items = parseStoryboardResult(MOCK_LLM_RESPONSE_WITH_BAD_ESCAPES)
  const shots = storyboardItemsToShots(items, EPISODE_WITH_MARKDOWN_ESCAPES, PROJECT_DATA)
  assert.equal(shots.length, 2)
  assert.equal(shots[0]?.episodeId, EPISODE_WITH_MARKDOWN_ESCAPES.id)
  assert.match(shots[0]?.prompt ?? '', /St\. Pria/)
  assert.equal(shots[0]?.spatialAnchor, '校门居中偏右，顶侧冷日光')
  console.log('[test:storyboard-json-escape] storyboardItemsToShots: OK')
}

function testBuildStoryboardPromptIncludesScript() {
  const prompt = buildStoryboardPrompt(EPISODE_WITH_MARKDOWN_ESCAPES, {
    characters: [],
    scenes: [],
    props: [],
  })
  assert.match(prompt, /Death in a Pleated Skirt/)
  assert.match(prompt, /St\\. Pria|St\. Pria/)
  console.log('[test:storyboard-json-escape] buildStoryboardPrompt: OK')
}

function main() {
  testDirectJsonParseFails()
  testParseStoryboardResult()
  testStoryboardItemsToShots()
  testBuildStoryboardPromptIncludesScript()
  console.log('ok: storyboard-json-escape regression')
}

main()
