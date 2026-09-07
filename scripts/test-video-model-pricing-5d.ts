/**
 * Phase 5D · 设置页视频模型展示回归（纯逻辑）
 *
 * 用法：npm run test:video-pricing-5d
 */

import assert from 'node:assert/strict'

import {
  getVideoModelDisplayTags,
  formatVideoModelSelectOptionLabels,
} from '@/lib/models/video-model-display'
import { formatVideoModelListPriceLabel } from '@/lib/models/video-model-pricing'
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

console.log('[test:video-pricing-5d] formatVideoModelListPriceLabel prefers pricing_summary')
assert.equal(formatVideoModelListPriceLabel(tieredVideo), '720P~1080P: 0.9~1.2 豆/秒')

console.log('[test:video-pricing-5d] getVideoModelDisplayTags')
const tags = getVideoModelDisplayTags(tieredVideo)
assert.ok(tags.includes('720p·1080p'))
assert.ok(tags.includes('分辨率'))

console.log('[test:video-pricing-5d] formatVideoModelSelectOptionLabels')
const option = formatVideoModelSelectOptionLabels(tieredVideo)
assert.equal(option.label, 'Tiered Video')
assert.equal(option.suffix, '720P~1080P: 0.9~1.2 豆/秒')
assert.equal(option.systemBadgeTone, 'external')

console.log('[test:video-pricing-5d] internal flat video shows yuan summary')
const internal = mapSystemModelDto({
  model_key: 'sys_internal_seedance_20',
  name: '内部·Seedance',
  kind: 'video',
  source: 'system',
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
})
assert.equal(formatVideoModelListPriceLabel(internal), '固定 2.5 元/秒')
assert.ok(getVideoModelDisplayTags(internal).includes('720p'))
assert.ok(getVideoModelDisplayTags(internal).includes('固定'))

console.log('[test:video-pricing-5d] all passed')
