// Copyright (c) local-creator contributors. All rights reserved.
/**
 * P1：分镜模板解析器单测
 * 运行：npx --yes tsx scripts/test-storyboard-template-parse.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  composeVideoPromptFromTemplate,
  parseStoryboardTemplateDocument,
  parseStoryboardTemplateDurationSec,
  splitStoryboardTemplateBlocks,
  assessStoryboardTemplateLikeness,
} from '../src/lib/canvas/canvas-storyboard-template-parse'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.join(__dirname, 'fixtures', 'storyboard-template')

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

function readFixture(name: string): string {
  return fs.readFileSync(path.join(fixtureDir, name), 'utf8')
}

function main() {
  assert(parseStoryboardTemplateDurationSec('12秒') === 12, '时长 12秒')
  assert(parseStoryboardTemplateDurationSec('12s') === 12, '时长 12s')
  assert(parseStoryboardTemplateDurationSec(' 8 ') === 8, '时长纯数字')
  assert(parseStoryboardTemplateDurationSec('约五秒') == null, '无法解析时长')

  const single = readFixture('01-single-shot-full.md')
  const singleResult = parseStoryboardTemplateDocument(single)
  assert(singleResult.ok, '01 应解析成功')
  if (!singleResult.ok) return
  assert(singleResult.shots.length === 1, '01 一镜')
  const s0 = singleResult.shots[0]
  assert(s0.shotNumber === 23, '01 镜头号 23')
  assert(s0.durationSec === 12, '01 时长 12')
  assert(s0.dialogue.includes('四十年了'), '01 台词保留')
  assert(s0.prompt.includes('画面内容：'), '01 prompt 含画面内容标签')
  assert(s0.prompt.includes('阿尔多'), '01 prompt 含人物')
  assert(s0.prompt.includes('运镜：'), '01 prompt 含运镜')
  assert(s0.spatialAnchor?.includes('左侧'), '01 spatial 来自站位')

  const three = readFixture('02-three-shots.md')
  assert(splitStoryboardTemplateBlocks(three).length === 3, '02 切出 3 块')
  const threeResult = parseStoryboardTemplateDocument(three)
  assert(threeResult.ok, '02 应解析成功')
  if (!threeResult.ok) return
  assert(threeResult.shots.length === 3, '02 三镜')
  assert(
    threeResult.shots.map((s) => s.shotNumber).join(',') === '1,2,3',
    '02 镜头号 1,2,3',
  )
  assert(threeResult.shots[0].durationSec === 5, '02 镜1 5秒')
  assert(threeResult.shots[1].dialogue.includes('该出门了'), '02 镜2 台词')
  assert(threeResult.shots[2].prompt.includes('雪地'), '02 镜3 场景进 prompt')

  const prose = readFixture('03-prose-no-shots.md')
  const proseResult = parseStoryboardTemplateDocument(prose)
  assert(!proseResult.ok, '03 应失败')
  if (proseResult.ok) return
  assert(proseResult.code === 'no_shot_boundary', '03 失败码 no_shot_boundary')
  assert(proseResult.message.includes('智能分镜'), '03 引导智能分镜')

  assert(parseStoryboardTemplateDocument('').ok === false, '空文本失败')
  assert(
    parseStoryboardTemplateDocument('镜头号：1\n运镜：固定\n').ok === false,
    '仅运镜无画面/场景兜底应失败',
  )

  const minimalOk = parseStoryboardTemplateDocument(
    '镜头号：9\n主要场景：街头\n运镜：跟拍\n',
  )
  assert(minimalOk.ok, '场景+运镜兜底可过')
  if (minimalOk.ok) {
    assert(minimalOk.shots[0].shotNumber === 9, '兜底镜号')
    assert(minimalOk.shots[0].warnings.some((w) => w.includes('画面内容')), '兜底警告')
  }

  const composed = composeVideoPromptFromTemplate({
    scene: '夜',
    content: '一人走过',
  })
  assert(composed.startsWith('主要场景：夜'), 'compose 顺序场景在前')
  assert(composed.includes('画面内容：一人走过'), 'compose 含内容')

  const none = assessStoryboardTemplateLikeness(prose)
  assert(!none.looksLike && !none.strong, '散文不像模板')

  const weak = assessStoryboardTemplateLikeness(single)
  assert(weak.looksLike, '单镜 looksLike')
  assert(weak.shotBoundaryCount === 1, '单镜 1 锚点')

  const strong = assessStoryboardTemplateLikeness(three)
  assert(strong.looksLike && strong.strong, '三镜 strong')
  assert(strong.shotBoundaryCount === 3, '三镜锚点数')

  console.log('ok: storyboard-template parse P1')
}

main()
