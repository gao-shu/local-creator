// Copyright (c) Haode AI. All rights reserved.

/**
 * 7.6 步骤 3：Seedance 分镜 Format QA 单测
 * 运行：npm run test:storyboard-format-qa
 */
import assert from 'node:assert/strict'
import {
  summarizeStoryboardFormatIssues,
  validateStoryboardFormat,
  validateStoryboardPromptFormat,
} from '../src/lib/workflow/storyboard-format-qa'
import type { ParsedStoryboardItem } from '../src/lib/workflow/storyboard-prompt'

const GOOD_15S_PROMPT = [
  '00:00-00:04 近景/固定/50mm f/2：@世子卧室 夜内，@云婷 画右靠墙微侧。对白/独白：无对白 音效&BGM：烛火噼啪、无 BGM',
  '00:04-00:08 中近景/缓推/50mm：@云婷 画右抬眼。对白/独白：「多谢世子。」 音效&BGM：对白声、无 BGM',
  '00:08-00:11 近景/固定/85mm：@云婷 画右面部特写。对白/独白：无对白 音效&BGM：呼吸声、无 BGM',
  '00:11-00:15 中近景/慢拉/50mm：@云婷 画右与 @若景 画左同框。对白/独白：无对白 音效&BGM：衣料轻响、无 BGM（衔接锚点：云婷画右靠墙抬眼）',
].join('\n')

/** 缺末段音效 + 无衔接锚点（Chloe 类问题） */
const BAD_MISSING_SFX_AND_ANCHOR = [
  '00:00-00:04 全景/慢推：@学院大门，@Chloe 画右迈入。对白/独白：无对白 音效&BGM：脚步、无 BGM',
  '00:04-00:08 中景/跟随：@Chloe 画右前行。对白/独白：无对白 音效&BGM：风声、无 BGM',
  '00:08-00:11 中近景/固定：@Chloe 侧头。对白/独白：无对白 音效&BGM：衣料轻响、无 BGM',
  '00:11-00:15 近景/缓推：@Chloe 停步，内心独白浮现。对白/独白：「终于到了。」',
].join('\n')

function testGoodPromptPasses() {
  const issues = validateStoryboardPromptFormat(1, GOOD_15S_PROMPT, 'seedance-15s-standard')
  assert.equal(issues.length, 0, `合格 prompt 应无 issues: ${JSON.stringify(issues)}`)
}

function testMissingSfxAnchorAndBanned() {
  const issues = validateStoryboardPromptFormat(2, BAD_MISSING_SFX_AND_ANCHOR, 'seedance-15s')
  const types = new Set(issues.map((i) => i.type))
  assert.ok(types.has('missing_sfx'), '应检出缺音效')
  assert.ok(types.has('missing_anchor'), '应检出缺衔接锚点')
  assert.ok(types.has('banned_phrase'), '应检出禁词')
}

function testWrongSegmentCount() {
  const prompt = [
    '00:00-00:04 全景：… 对白/独白：无 音效&BGM：风、无 BGM',
    '00:04-00:08 中景：… 对白/独白：无 音效&BGM：风、无 BGM',
    '00:08-00:15 近景：… 对白/独白：无 音效&BGM：风、无 BGM（衔接锚点：停步）',
  ].join('\n')
  const issues = validateStoryboardPromptFormat(3, prompt, 'seedance-15s-standard')
  assert.ok(issues.some((i) => i.type === 'timecode_count'), '段数不对应报错')
}

function testSeedance10sEndTime() {
  const prompt = [
    '00:00-00:03 全景：… 音效&BGM：风、无 BGM',
    '00:03-00:06 中景：… 音效&BGM：风、无 BGM',
    '00:06-00:08 近景：… 音效&BGM：风、无 BGM',
    '00:08-00:10 特写：… 音效&BGM：风、无 BGM（衔接锚点：停步）',
  ].join('\n')
  const issues = validateStoryboardPromptFormat(1, prompt, 'seedance-10s')
  assert.equal(issues.length, 0, `10s 合格 prompt: ${JSON.stringify(issues)}`)

  const badEnd = prompt.replace('00:08-00:10', '00:08-00:12')
  const badIssues = validateStoryboardPromptFormat(1, badEnd, 'seedance-10s')
  assert.ok(badIssues.some((i) => i.type === 'timecode_end'), '10s 末段应结束 00:10')
}

function testBatchValidateAndSkip() {
  const items: ParsedStoryboardItem[] = [
    { shotNumber: 1, dialogue: '测试', prompt: GOOD_15S_PROMPT },
  ]
  const ok = validateStoryboardFormat(items, 'seedance-15s-standard')
  assert.equal(ok.passed, true)
  assert.equal(ok.checkedCount, 1)
  assert.equal(ok.skipped, undefined)

  const badItems: ParsedStoryboardItem[] = [
    { shotNumber: 2, dialogue: '测试', prompt: BAD_MISSING_SFX_AND_ANCHOR },
  ]
  const bad = validateStoryboardFormat(badItems, 'seedance-15s')
  assert.equal(bad.passed, false)
  assert.ok(bad.issues.length >= 2)

  const skipped = validateStoryboardFormat(items, 'custom-cinematic')
  assert.equal(skipped.passed, true)
  assert.equal(skipped.skipped, true)
  assert.equal(skipped.checkedCount, 0)
}

function testSummarizeIssues() {
  const issues = validateStoryboardPromptFormat(2, BAD_MISSING_SFX_AND_ANCHOR, 'seedance-15s')
  const summary = summarizeStoryboardFormatIssues(issues, 3)
  assert.match(summary, /镜 2/)
  assert.match(summary, /分镜格式 QA 未通过/)
}

function main() {
  testGoodPromptPasses()
  testMissingSfxAnchorAndBanned()
  testWrongSegmentCount()
  testSeedance10sEndTime()
  testBatchValidateAndSkip()
  testSummarizeIssues()
  console.log('ok: storyboard-format-qa')
}

main()
