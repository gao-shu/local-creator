/**
 * H1 · 确认框「生成参数 / 费用预估」分栏契约
 *
 * 用法：npm run test:video-capability-h1
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  VIDEO_CONFIRM_BILLING_SECTION_TITLE,
  VIDEO_CONFIRM_PARAMS_SECTION_TITLE,
  buildVideoConfirmCapabilityFields,
  capabilityFieldsContainPricingCopy,
} from '@/lib/models/video-confirm-sections'

console.log('[test:video-capability-h1] section titles lock capability vs billing split')
{
  assert.equal(VIDEO_CONFIRM_PARAMS_SECTION_TITLE, '生成参数')
  assert.equal(VIDEO_CONFIRM_BILLING_SECTION_TITLE, '费用预估')
  assert.notEqual(VIDEO_CONFIRM_PARAMS_SECTION_TITLE, VIDEO_CONFIRM_BILLING_SECTION_TITLE)
}

console.log('[test:video-capability-h1] capability fields are mode/ratio/clarity/duration only')
{
  const fields = buildVideoConfirmCapabilityFields({
    referenceModeLabel: '首尾帧',
    durationSec: 10,
    aspectRatio: '9:16',
    resolution: '1080P',
  })
  assert.deepEqual(
    fields.map((item) => item.key),
    ['referenceMode', 'duration', 'aspectRatio', 'resolution'],
  )
  assert.equal(fields.find((item) => item.key === 'resolution')?.label, '清晰度')
  assert.equal(capabilityFieldsContainPricingCopy(fields), false)
}

console.log('[test:video-capability-h1] omits empty capability values')
{
  const fields = buildVideoConfirmCapabilityFields({
    referenceModeLabel: '全能多参',
    durationSec: 5,
  })
  assert.deepEqual(
    fields.map((item) => item.key),
    ['referenceMode', 'duration'],
  )
}

console.log('[test:video-capability-h1] pricing-like capability values are flagged')
{
  const bad = buildVideoConfirmCapabilityFields({
    referenceModeLabel: '0.9 豆/秒',
    durationSec: 5,
  })
  assert.equal(capabilityFieldsContainPricingCopy(bad), true)
}

console.log('[test:video-capability-h1] entrypoints expose params and billing section test ids')
{
  const sources = [
    'src/components/workshop/weishi-video-confirm-dialog.tsx',
    'src/components/canvas/dialogs/canvas-batch-generate-confirm-dialog.tsx',
    'src/components/workshop/storyboard-batch-video-confirm-dialog.tsx',
  ]
  for (const relative of sources) {
    const text = readFileSync(resolve(process.cwd(), relative), 'utf8')
    assert.match(text, /video-confirm-params-section/)
    assert.match(text, /video-confirm-billing-section/)
    assert.match(text, /VIDEO_CONFIRM_PARAMS_SECTION_TITLE/)
    assert.match(text, /VIDEO_CONFIRM_BILLING_SECTION_TITLE/)
  }
}

console.log('[test:video-capability-h1] all passed')
