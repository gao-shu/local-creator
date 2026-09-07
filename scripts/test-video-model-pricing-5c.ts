/**
 * Phase 5C · 代理 / 消耗 resolution 透传回归（纯逻辑）
 *
 * 用法：npm run test:video-pricing-5c
 */

import assert from 'node:assert/strict'

import { buildVideoProxyTierPayload } from '@/lib/models/video-generation-tier-params'
import { normalizeVideoResolution } from '@/lib/models/video-model-pricing'
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

console.log('[test:video-pricing-5c] normalizeVideoResolution legacy aliases')
assert.equal(normalizeVideoResolution('720'), '720P')
assert.equal(normalizeVideoResolution('1080p'), '1080P')
assert.equal(normalizeVideoResolution('4k'), '4K')
assert.equal(normalizeVideoResolution('360p'), '360P')
assert.equal(normalizeVideoResolution('540P'), null)

console.log('[test:video-pricing-5c] buildVideoProxyTierPayload default tier')
assert.deepEqual(buildVideoProxyTierPayload(tieredVideo, null), { resolution: '720P' })
assert.deepEqual(buildVideoProxyTierPayload(tieredVideo, { resolution: '720' }), {
  resolution: '720P',
})

console.log('[test:video-pricing-5c] buildVideoProxyTierPayload selected tier')
assert.deepEqual(buildVideoProxyTierPayload(tieredVideo, { resolution: '1080P' }), {
  resolution: '1080P',
})

console.log('[test:video-pricing-5c] flat model without open list still defaults 720P')
const flatVideo = mapSystemModelDto({
  model_key: 'ext_vid_flat',
  name: 'Flat Video',
  kind: 'video',
  source: 'system',
  haodou_cost: 4,
  billing_mode: 'external',
  unit_price: '3.5',
  config_json: { unit_price: '3.5' },
  proxy_available: true,
})
assert.deepEqual(buildVideoProxyTierPayload(flatVideo, { resolution: '720' }), {
  resolution: '720P',
})

console.log('[test:video-pricing-5c] proxy payload shape (documented contract)')
const proxyBody = {
  model_key: tieredVideo.modelKey,
  duration_sec: 10,
  resolution: buildVideoProxyTierPayload(tieredVideo, { resolution: '1080P' }).resolution,
}
assert.equal(proxyBody.resolution, '1080P')

const consumptionBody = {
  action: 'charge',
  duration_sec: 10,
  model_key: 'sys_internal_seedance_20',
  resolution: buildVideoProxyTierPayload(tieredVideo, { resolution: '1080P' }).resolution,
}
assert.equal(consumptionBody.resolution, '1080P')

console.log('[test:video-pricing-5c] all passed')
