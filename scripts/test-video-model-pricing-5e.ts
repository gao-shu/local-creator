/**
 * Phase 5E · 视频模型下拉展示回归（纯逻辑）
 *
 * 用法：npm run test:video-pricing-5e
 */

import assert from 'node:assert/strict'

import { formatModelSelectOptionLabelsForKind } from '@/lib/models/image-model-display'
import {
  buildModelSelectOptions,
  buildVideoModelSelectOptions,
} from '@/lib/models/model-select-options'
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

function weishiInternalDto(): ClientSystemModelDto {
  return {
    model_key: 'sys_internal_seedance_20',
    name: '内部·Seedance',
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
    config_json: { unit_price: '2.5' },
    proxy_available: false,
  }
}

const tieredVideo = mapSystemModelDto(tieredVideoDto())
const weishiInternal = mapSystemModelDto(weishiInternalDto())

console.log('[test:video-pricing-5e] formatModelSelectOptionLabelsForKind video branch')
const labels = formatModelSelectOptionLabelsForKind(tieredVideo, 'video')
assert.equal(labels.label, 'Tiered Video')
assert.equal(labels.suffix, '720P~1080P: 0.9~1.2 豆/秒')

console.log('[test:video-pricing-5e] flat video without videoPricing falls back')
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
const flatLabels = formatModelSelectOptionLabelsForKind(flatVideo, 'video')
assert.equal(flatLabels.label, 'Flat Video')
assert.equal(flatLabels.systemBadgeTone, 'external')

console.log('[test:video-pricing-5e] buildModelSelectOptions for tiered external video')
const options = buildModelSelectOptions([tieredVideo], 'video')
assert.equal(options.length, 1)
assert.equal(options[0]?.label, 'Tiered Video')
assert.equal(options[0]?.suffix, '720P~1080P: 0.9~1.2 豆/秒')

console.log('[test:video-pricing-5e] buildModelSelectOptions groups custom video models')
const mixedVideoOptions = buildModelSelectOptions(
  [
    tieredVideo,
    { id: 'custom-vid', name: '我的视频模型', source: 'custom' },
  ],
  'video',
)
assert.equal(mixedVideoOptions.length, 2)
assert.equal(mixedVideoOptions[0]?.label, 'Tiered Video')
assert.equal(mixedVideoOptions[1]?.group, '自定义模型')

console.log('[test:video-pricing-5e] buildVideoModelSelectOptions skips duplicate weishi unit price')
const weishiOptions = buildVideoModelSelectOptions([weishiInternal], [weishiInternal], 'real-token')
assert.equal(weishiOptions.length, 1)
assert.ok(weishiOptions[0]?.suffix?.includes('固定 2.5 元/秒'))
assert.equal(
  (weishiOptions[0]?.suffix?.match(/2\.5/g) ?? []).length,
  1,
  'unit price should not be duplicated when pricing_summary exists',
)

console.log('[test:video-pricing-5e] image branch unchanged')
const image = mapSystemModelDto({
  model_key: 'ext_img',
  name: 'Image',
  kind: 'image',
  source: 'system',
  haodou_cost: 7,
  billing_mode: 'external',
  unit_price: '7.0',
  pricing_mode: 'flat',
  config_json: { unit_price: '7.0' },
  proxy_available: true,
})
const imageLabels = formatModelSelectOptionLabelsForKind(image, 'image')
assert.ok(imageLabels.label.includes('Image'))

console.log('[test:video-pricing-5e] all passed')
