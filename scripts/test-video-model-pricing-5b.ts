/**
 * Phase 5B · 视频好豆预估回归（纯逻辑）
 *
 * 用法：npm run test:video-pricing-5b
 */

import assert from 'node:assert/strict'

import { estimateVideoHaodouCostSync } from '@/lib/auth/video-billing-display'
import { estimateVideoBatchBilling } from '@/lib/auth/billing-display'
import { resolveModelHaodouCost } from '@/lib/auth/haodou-consume-service'
import { mapSystemModelDto, type ClientSystemModelDto } from '@/lib/models/system-models-service'
import type { ModelConfig } from '@/types/settings'

function tieredVideoDto(): ClientSystemModelDto {
  return {
    model_key: 'ext_vid_tiered',
    name: 'Tiered Video',
    kind: 'video',
    source: 'system',
    haodou_cost: 1,
    billing_mode: 'external',
    unit_price: '0.9',
    unit_label: '豆/秒',
    pricing_mode: 'by_resolution',
    pricing_summary: '720P~1080P: 0.9~1.2 豆/秒',
    price_range: { min: '0.9', max: '1.2' },
    default_resolution: '720P',
    resolutions: ['720P', '1080P'],
    config_json: { unit_price: '0.9', price_by_resolution: { '1080P': '1.2' } },
    proxy_available: true,
  }
}

function flatExternalVideo(): ModelConfig {
  return mapSystemModelDto({
    model_key: 'sys_ext_video',
    name: '外部·示例视频',
    kind: 'video',
    source: 'system',
    haodou_cost: 4,
    billing_mode: 'external',
    unit_price: '3.5',
    unit_label: '豆/秒',
    config_json: { unit_price: '3.5' },
    proxy_available: true,
  })
}

const tieredVideo = mapSystemModelDto(tieredVideoDto())

console.log('[test:video-pricing-5b] flat external video unchanged')
assert.equal(resolveModelHaodouCost(flatExternalVideo(), 'video', { durationSec: 10 }), 35)
assert.equal(resolveModelHaodouCost(flatExternalVideo(), 'video', { durationSec: 0 }), 0)

console.log('[test:video-pricing-5b] tiered default resolution uses unitPrice × seconds')
assert.equal(
  resolveModelHaodouCost(tieredVideo, 'video', { durationSec: 10, resolution: '720P' }),
  9,
)
assert.equal(
  resolveModelHaodouCost(tieredVideo, 'video', { durationSec: 10 }),
  9,
)

console.log('[test:video-pricing-5b] tiered non-default resolution sync returns 0 (needs quote)')
assert.equal(
  resolveModelHaodouCost(tieredVideo, 'video', { durationSec: 10, resolution: '1080P' }),
  0,
)

console.log('[test:video-pricing-5b] internal video with videoPricing does not charge haodou')
const internal = mapSystemModelDto({
  model_key: 'sys_internal_seedance_20',
  name: '内部·Seedance',
  kind: 'video',
  source: 'system',
  haodou_cost: 0,
  billing_mode: 'internal',
  unit_price: '2.5',
  pricing_mode: 'flat',
  pricing_summary: '固定 2.5 元/秒',
  default_resolution: '720P',
  resolutions: ['720P'],
  config_json: { unit_price: '2.5' },
  proxy_available: false,
})
assert.equal(resolveModelHaodouCost(internal, 'video', { durationSec: 10 }), 0)

console.log('[test:video-pricing-5b] estimateVideoHaodouCostSync')
const sync720 = estimateVideoHaodouCostSync({
  model: tieredVideo,
  resolution: '720P',
  durationSec: 10,
})
assert.equal(sync720.haodouCost, 9)
assert.equal(sync720.durationSec, 10)

const sync1080 = estimateVideoHaodouCostSync({
  model: tieredVideo,
  resolution: '1080P',
  durationSec: 10,
})
assert.equal(sync1080.haodouCost, null)

console.log('[test:video-pricing-5b] estimateVideoBatchBilling passes resolution')
const batchDefault = estimateVideoBatchBilling({
  videoModel: tieredVideo,
  shotCount: 2,
  durationSec: 10,
  resolution: '720P',
  systemCatalog: [],
})
assert.equal(batchDefault.perShotHaodou, 9)
assert.equal(batchDefault.totalHaodou, 18)

const batchPremium = estimateVideoBatchBilling({
  videoModel: tieredVideo,
  shotCount: 2,
  durationSec: 10,
  resolution: '1080P',
  systemCatalog: [],
})
assert.equal(batchPremium.perShotHaodou, null)
assert.equal(batchPremium.totalHaodou, null)

console.log('[test:video-pricing-5b] all passed')
