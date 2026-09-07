/**
 * Phase 5G · 视频费用预览回归（纯逻辑）
 *
 * 用法：npm run test:video-pricing-5g
 */

import assert from 'node:assert/strict'

import {
  estimateVideoBatchBilling,
  estimateVideoBatchBillingAsync,
} from '@/lib/auth/billing-display'
import {
  estimateVideoHaodouCostSync,
  formatVideoHaodouPreviewText,
} from '@/lib/auth/video-billing-display'
import {
  shouldPreviewVideoGenerationCost,
  shouldShowVideoCostHint,
} from '@/hooks/use-video-generation-cost-preview'
import { mapSystemModelDto, type ClientSystemModelDto } from '@/lib/models/system-models-service'

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
    default_resolution: '720P',
    resolutions: ['720P', '1080P'],
    config_json: { unit_price: '0.9' },
    proxy_available: true,
  }
}

const tieredVideo = mapSystemModelDto(tieredVideoDto())
const flatVideo = mapSystemModelDto({
  model_key: 'ext_vid_flat',
  name: 'Flat Video',
  kind: 'video',
  source: 'system',
  haodou_cost: 4,
  billing_mode: 'external',
  unit_price: '3.5',
  unit_label: '豆/秒',
  config_json: { unit_price: '3.5' },
  proxy_available: true,
})
const internalVideo = mapSystemModelDto({
  model_key: 'sys_internal_seedance',
  name: '内部·Seedance',
  kind: 'video',
  source: 'system',
  haodou_cost: 0,
  billing_mode: 'internal',
  unit_price: '2.5',
  pricing_mode: 'flat',
  config_json: { unit_price: '2.5' },
  proxy_available: false,
})

console.log('[test:video-pricing-5g] shouldShowVideoCostHint for external only')
assert.equal(shouldShowVideoCostHint(flatVideo), true)
assert.equal(shouldShowVideoCostHint(tieredVideo), true)
assert.equal(shouldShowVideoCostHint(internalVideo), false)

console.log('[test:video-pricing-5g] shouldPreviewVideoGenerationCost')
assert.equal(shouldPreviewVideoGenerationCost(tieredVideo), true)
assert.equal(shouldPreviewVideoGenerationCost(flatVideo), true)
assert.equal(shouldPreviewVideoGenerationCost(internalVideo), false)

console.log('[test:video-pricing-5g] formatVideoHaodouPreviewText')
const flatEstimate = estimateVideoHaodouCostSync({
  model: flatVideo,
  durationSec: 10,
  resolution: '720P',
})
assert.equal(flatEstimate.haodouCost, 35)
assert.equal(
  formatVideoHaodouPreviewText(flatEstimate),
  '预计 35 好豆（10秒）（登录后扣费）',
)

console.log('[test:video-pricing-5g] tiered default tier sync preview')
const tierDefault = estimateVideoHaodouCostSync({
  model: tieredVideo,
  durationSec: 10,
  resolution: '720P',
})
assert.equal(formatVideoHaodouPreviewText(tierDefault), '预计 9 好豆（10秒）（登录后扣费）')

console.log('[test:video-pricing-5g] tiered non-default sync returns null preview text')
const tierPremium = estimateVideoHaodouCostSync({
  model: tieredVideo,
  durationSec: 10,
  resolution: '1080P',
})
assert.equal(formatVideoHaodouPreviewText(tierPremium), null)

console.log('[test:video-pricing-5g] batch billing default tier sync vs async')
const batchSync = estimateVideoBatchBilling({
  videoModel: tieredVideo,
  shotCount: 3,
  durationSec: 10,
  resolution: '720P',
  systemCatalog: [],
})
const batchAsync = await estimateVideoBatchBillingAsync({
  videoModel: tieredVideo,
  shotCount: 3,
  durationSec: 10,
  resolution: '720P',
  systemCatalog: [],
})
assert.equal(batchSync.perShotHaodou, 9)
assert.equal(batchSync.totalHaodou, 27)
assert.deepEqual(batchAsync, batchSync)

console.log('[test:video-pricing-5g] batch billing passes resolution in sync path')
const batchFlat = estimateVideoBatchBilling({
  videoModel: flatVideo,
  shotCount: 2,
  durationSec: 5,
  resolution: '720P',
  systemCatalog: [],
})
assert.equal(batchFlat.totalHaodou, 36)

console.log('[test:video-pricing-5g] all passed')
