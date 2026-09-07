/**
 * Phase 5A · videoPricing DTO 映射回归（纯逻辑，无需 API）
 *
 * 用法：npm run test:video-pricing-5a
 */

import assert from 'node:assert/strict'

import { mapDtoToVideoPricingMeta } from '@/lib/models/video-model-pricing'
import {
  mapSystemModelDto,
  type ClientSystemModelDto,
} from '@/lib/models/system-models-service'

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
    config_json: {
      unit_price: '0.9',
      ratios: ['16:9'],
      durations: [5, 10],
    },
    proxy_available: true,
  }
}

function flatLegacyVideoDto(): ClientSystemModelDto {
  return {
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
  }
}

function internalVideoDto(): ClientSystemModelDto {
  return {
    model_key: 'sys_internal_seedance_20',
    name: '内部·Seedance 2.0',
    kind: 'video',
    source: 'system',
    api_format: 'weishi_api',
    upstream_model: 'seedance-2.0',
    haodou_cost: 0,
    billing_mode: 'internal',
    unit_price: '2.5',
    unit_label: '元/秒',
    pricing_mode: 'flat',
    pricing_summary: '固定 2.5 元/秒',
    default_resolution: '720P',
    resolutions: ['720P'],
    config_json: {
      unit_price: '2.5',
      resolutions: ['720P'],
    },
    proxy_available: false,
    consumption: {
      billing_enabled: true,
      price: '2.5',
      unit: 'second',
      unit_label: '元/秒',
    },
  }
}

console.log('[test:video-pricing-5a] mapDtoToVideoPricingMeta')
const meta = mapDtoToVideoPricingMeta(tieredVideoDto())
assert.ok(meta)
assert.equal(meta?.pricingMode, 'by_resolution')
assert.equal(meta?.defaultResolution, '720P')
assert.deepEqual(meta?.resolutions, ['720P', '1080P'])
assert.equal(meta?.pricingSummary, '720P~1080P: 0.9~1.2 豆/秒')

console.log('[test:video-pricing-5a] mapSystemModelDto tiered video')
const mapped = mapSystemModelDto(tieredVideoDto())
assert.ok(mapped.videoPricing)
assert.equal(mapped.videoPricing?.pricingMode, 'by_resolution')
assert.equal(mapped.videoPricing?.defaultResolution, '720P')
assert.deepEqual(mapped.videoPricing?.resolutions, ['720P', '1080P'])
assert.equal(mapped.haodouCost, 1)
assert.equal(mapped.unitLabel, '豆/秒')
assert.deepEqual(mapped.resolutions, ['720P', '1080P'])
assert.equal(mapped.imagePricing, undefined)

console.log('[test:video-pricing-5a] flat legacy video without pricing fields')
const flat = mapSystemModelDto(flatLegacyVideoDto())
assert.equal(flat.videoPricing, undefined)
assert.equal(flat.haodouCost, 4)
assert.equal(flat.unitPrice, 3.5)

console.log('[test:video-pricing-5a] internal video with flat pricing meta')
const internal = mapSystemModelDto(internalVideoDto())
assert.ok(internal.videoPricing)
assert.equal(internal.videoPricing?.pricingMode, 'flat')
assert.equal(internal.videoPricing?.pricingSummary, '固定 2.5 元/秒')
assert.equal(internal.billingMode, 'internal')
assert.equal(internal.haodouCost, undefined)

console.log('[test:video-pricing-5a] image model must not get videoPricing')
const imageDto: ClientSystemModelDto = {
  model_key: 'ext_img',
  name: 'Image',
  kind: 'image',
  source: 'system',
  haodou_cost: 7,
  billing_mode: 'external',
  unit_price: '7.0',
  pricing_mode: 'flat',
  config_json: { unit_price: '7.0' },
}
const imageMapped = mapSystemModelDto(imageDto)
assert.equal(imageMapped.videoPricing, undefined)
assert.ok(imageMapped.imagePricing)

console.log('[test:video-pricing-5a] all passed')
