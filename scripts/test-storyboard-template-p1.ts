// Copyright (c) Haode AI. All rights reserved.
/**
 * P1：分镜模板解析器
 *   npm run test:storyboard-template-p1
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  composeVideoPromptFromTemplate,
  looksLikeStoryboardTemplate,
  parseStoryboardTemplateBlock,
  parseStoryboardTemplateDocument,
  parseStoryboardTemplateDurationSec,
  splitStoryboardTemplateBlocks,
} from '../src/lib/canvas/canvas-storyboard-template-parse'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.join(__dirname, 'fixtures', 'storyboard-template')

function test(name: string, fn: () => void) {
  fn()
  console.log(`✓ ${name}`)
}

function readFixture(name: string): string {
  return fs.readFileSync(path.join(fixtureDir, name), 'utf8')
}

function main() {
  test('时长解析', () => {
    assert.equal(parseStoryboardTemplateDurationSec('12秒'), 12)
    assert.equal(parseStoryboardTemplateDurationSec('12s'), 12)
    assert.equal(parseStoryboardTemplateDurationSec(' 8 '), 8)
    assert.equal(parseStoryboardTemplateDurationSec('12.4秒'), 12)
    assert.equal(parseStoryboardTemplateDurationSec('12.6秒'), 13)
    assert.equal(parseStoryboardTemplateDurationSec(''), undefined)
    assert.equal(parseStoryboardTemplateDurationSec('约若干秒'), undefined)
  })

  test('looksLike / 无镜头号失败', () => {
    const prose = readFixture('03-prose-no-shots.md')
    assert.equal(looksLikeStoryboardTemplate(prose), false)
    const fail = parseStoryboardTemplateDocument(prose)
    assert.equal(fail.ok, false)
    if (!fail.ok) {
      assert.equal(fail.code, 'no_shot_boundary')
      assert.match(fail.message, /智能分镜/)
    }
  })

  test('空文失败', () => {
    const fail = parseStoryboardTemplateDocument('   \n  ')
    assert.equal(fail.ok, false)
    if (!fail.ok) assert.equal(fail.code, 'empty')
  })

  test('单镜完整样例', () => {
    const text = readFixture('01-single-shot-full.md')
    assert.equal(looksLikeStoryboardTemplate(text), true)
    assert.equal(splitStoryboardTemplateBlocks(text).length, 1)

    const result = parseStoryboardTemplateDocument(text)
    assert.equal(result.ok, true)
    if (!result.ok) return

    assert.equal(result.shots.length, 1)
    const shot = result.shots[0]!
    assert.equal(shot.shotNumber, 23)
    assert.equal(shot.durationSec, 12)
    assert.match(shot.prompt, /画面内容：/)
    assert.match(shot.prompt, /阿尔多/)
    assert.match(shot.prompt, /台词：/)
    assert.match(shot.prompt, /四十年了/)
    assert.match(shot.dialogue, /四十年了|阿尔多/)
    assert.ok(shot.spatialAnchor && /油灯|左侧|酒桶/.test(shot.spatialAnchor))
  })

  test('三镜样例', () => {
    const text = readFixture('02-three-shots.md')
    const blocks = splitStoryboardTemplateBlocks(text)
    assert.equal(blocks.length, 3)

    const result = parseStoryboardTemplateDocument(text)
    assert.equal(result.ok, true)
    if (!result.ok) return

    assert.equal(result.shots.length, 3)
    assert.deepEqual(
      result.shots.map((s) => s.shotNumber),
      [1, 2, 3],
    )
    assert.deepEqual(
      result.shots.map((s) => s.durationSec),
      [5, 8, 6],
    )
    assert.match(result.shots[0]!.prompt, /山间木屋/)
    assert.match(result.shots[1]!.prompt, /摇椅|猎枪/)
    assert.match(result.shots[2]!.prompt, /雪地|脚印/)
  })

  test('## 镜头 标题切块', () => {
    const text = `## 镜头 9

画面内容： 一只鸟飞过湖面。

时长： 3秒
`
    const result = parseStoryboardTemplateDocument(text)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.shots[0]!.shotNumber, 9)
    assert.equal(result.shots[0]!.durationSec, 3)
  })

  test('极简兜底：场景+运镜无画面内容', () => {
    const text = `镜头号：1
主要场景： 会议室
运镜： 特写固定
时长： 4秒
`
    const result = parseStoryboardTemplateDocument(text)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.shots.length, 1)
    assert.match(result.shots[0]!.prompt, /会议室/)
    assert.ok(result.warnings.some((w) => w.includes('兜底')))
  })

  test('有边界但无有效镜 → no_valid_shot', () => {
    const text = `镜头号：1

运镜： 只有运镜没有场景也没有画面内容
`
    const result = parseStoryboardTemplateDocument(text)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, 'no_valid_shot')
  })

  test('compose 字段顺序', () => {
    const prompt = composeVideoPromptFromTemplate({
      scene: 'A',
      content: 'B',
      camera: 'C',
      style: 'D',
    })
    assert.ok(prompt.indexOf('主要场景') < prompt.indexOf('画面内容'))
    assert.ok(prompt.indexOf('画面内容') < prompt.indexOf('运镜'))
    assert.ok(prompt.indexOf('运镜') < prompt.indexOf('画面风格'))
  })

  test('parseBlock 多行台词', () => {
    const fields = parseStoryboardTemplateBlock(`镜头号：2
画面内容： 人走过。
台词：
甲：“你好。”
乙：“再见。”
时长： 5秒
`)
    assert.equal(fields.shotNumber, '2')
    assert.match(fields.dialogue ?? '', /你好/)
    assert.match(fields.dialogue ?? '', /再见/)
  })

  console.log('ok: storyboard-template P1 parse')
}

main()
