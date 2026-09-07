// Copyright (c) Haode AI. All rights reserved.
/**
 * P0：分镜模板契约 + 样例完整性检查（不含解析器）
 * 运行：npx --yes tsx scripts/test-storyboard-template-p0.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  STORYBOARD_TEMPLATE_DOC_MIN_SHOTS,
  STORYBOARD_TEMPLATE_FAILURE_HINT,
  STORYBOARD_TEMPLATE_IMPORT_DEFAULTS,
  STORYBOARD_TEMPLATE_PROMPT_FIELD_ORDER,
  STORYBOARD_TEMPLATE_SHOT_BOUNDARIES,
} from '../src/lib/canvas/canvas-storyboard-template-spec'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.join(__dirname, 'fixtures', 'storyboard-template')

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

function countShotNumberLines(text: string): number {
  return text.split(/\r?\n/).filter((line) => /^镜头号\s*[:：]/u.test(line.trim())).length
}

function main() {
  assert(STORYBOARD_TEMPLATE_DOC_MIN_SHOTS === 1, '整篇最少 1 镜')
  assert(STORYBOARD_TEMPLATE_PROMPT_FIELD_ORDER.includes('content'), 'prompt 序须含 content')
  assert(STORYBOARD_TEMPLATE_SHOT_BOUNDARIES.length >= 1, '须有切块正则')
  assert(STORYBOARD_TEMPLATE_IMPORT_DEFAULTS.createVideoNodes === true, '默认附带空视频')
  assert(STORYBOARD_TEMPLATE_IMPORT_DEFAULTS.extractAssets === false, '默认不提取资产')
  assert(
    STORYBOARD_TEMPLATE_FAILURE_HINT.no_shot_boundary.includes('智能分镜'),
    '无镜头号失败文案须引导智能分镜',
  )

  const files = {
    single: path.join(fixtureDir, '01-single-shot-full.md'),
    three: path.join(fixtureDir, '02-three-shots.md'),
    prose: path.join(fixtureDir, '03-prose-no-shots.md'),
  }

  for (const [key, filePath] of Object.entries(files)) {
    assert(fs.existsSync(filePath), `缺少样例 ${key}: ${filePath}`)
  }

  const single = fs.readFileSync(files.single, 'utf8')
  const three = fs.readFileSync(files.three, 'utf8')
  const prose = fs.readFileSync(files.prose, 'utf8')

  assert(countShotNumberLines(single) === 1, '01 应为单镜')
  assert(/画面内容\s*[:：]/u.test(single), '01 须含画面内容')
  assert(/时长\s*[:：].*12/u.test(single), '01 须含 12 秒时长')
  assert(/台词\s*[:：]/u.test(single), '01 须含台词')

  assert(countShotNumberLines(three) === 3, '02 应为三镜')
  assert(countShotNumberLines(prose) === 0, '03 不应含镜头号行')
  assert(prose.includes('智能分镜'), '03 注释须标明用途')

  console.log('ok: storyboard-template P0 fixtures + spec')
}

main()
