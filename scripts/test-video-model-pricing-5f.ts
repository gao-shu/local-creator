/**
 * Phase 5F · 动态分辨率选择器回归（纯逻辑）
 *
 * 用法：npm run test:video-pricing-5f
 */

import assert from 'node:assert/strict'

import {
  normalizeVideoResolutionValue,
  resolveVideoResolutionOptions,
  shouldShowVideoResolutionSelector,
} from '@/lib/workflow/storyboard-video-presets'
import {
  normalizeVideoGenerationTierParams,
  shouldShowVideoResolutionSelector as shouldShowTierSelector,
} from '@/lib/models/video-generation-tier-params'
import { mapSystemModelDto, type ClientSystemModelDto } from '@/lib/models/system-models-service'
import {
  applyWeishiCatalogCapabilities,
  overlayWeishiCapabilitiesOnMergedVideoModels,
  sanitizeStoredWeishiVideoModels,
  shouldPersistSanitizedWeishiVideoModels,
  writeBackWeishiCatalogCapabilities,
} from '@/lib/models/weishi-capability-overlay'

function tieredVideoDto(): ClientSystemModelDto {
  return {
    model_key: 'ext_vid_tiered',
    name: 'Tiered Video',
    kind: 'video',
    source: 'system',
    haodou_cost: 1,
    billing_mode: 'external',
    unit_price: '0.9',
    pricing_mode: 'by_resolution',
    pricing_summary: '720P~1080P: 0.9~1.2 豆/秒',
    default_resolution: '720P',
    resolutions: ['720P', '1080P'],
    config_json: { unit_price: '0.9' },
    proxy_available: true,
  }
}

function singleTierDto(): ClientSystemModelDto {
  return {
    model_key: 'ext_vid_720',
    name: '720 Only',
    kind: 'video',
    source: 'system',
    haodou_cost: 1,
    billing_mode: 'external',
    unit_price: '0.9',
    pricing_mode: 'by_resolution',
    default_resolution: '720P',
    resolutions: ['720P'],
    config_json: { unit_price: '0.9' },
    proxy_available: true,
  }
}

const tieredVideo = mapSystemModelDto(tieredVideoDto())
const singleTierVideo = mapSystemModelDto(singleTierDto())
const flatVideo = mapSystemModelDto({
  model_key: 'ext_vid_flat',
  name: 'Flat',
  kind: 'video',
  source: 'system',
  haodou_cost: 4,
  billing_mode: 'external',
  unit_price: '3.5',
  config_json: { unit_price: '3.5' },
  proxy_available: true,
})

console.log('[test:video-pricing-5f] tiered model exposes multiple resolution options')
assert.equal(shouldShowVideoResolutionSelector(tieredVideo), true)
assert.equal(shouldShowTierSelector(tieredVideo), true)
assert.deepEqual(
  resolveVideoResolutionOptions(tieredVideo).map((item) => item.value),
  ['720P', '1080P'],
)

console.log('[test:video-pricing-5f] only 720P open: options=[720P], selector hidden (single tier)')
assert.equal(shouldShowVideoResolutionSelector(singleTierVideo), false)
assert.equal(shouldShowTierSelector(singleTierVideo), false)
assert.deepEqual(resolveVideoResolutionOptions(singleTierVideo).map((item) => item.value), ['720P'])

console.log('[test:video-pricing-5f] tiered mode with empty resolutions does not invent full catalog')
const tieredEmptyResolutions = mapSystemModelDto({
  model_key: 'ext_vid_tiered_empty',
  name: 'Tiered Empty',
  kind: 'video',
  source: 'system',
  haodou_cost: 1,
  billing_mode: 'external',
  unit_price: '0.9',
  pricing_mode: 'by_resolution',
  default_resolution: '720P',
  resolutions: [],
  config_json: { unit_price: '0.9', resolutions: ['720P'] },
  proxy_available: true,
})
assert.deepEqual(
  resolveVideoResolutionOptions(tieredEmptyResolutions).map((item) => item.value),
  ['720P'],
)
assert.equal(shouldShowVideoResolutionSelector(tieredEmptyResolutions), false)

const tieredNoResolutionsAtAll = {
  id: 'sys-tiered-bare',
  name: 'Tiered Bare',
  source: 'system' as const,
  videoPricing: {
    pricingMode: 'by_resolution' as const,
    defaultResolution: '720P',
    resolutions: undefined,
  },
}
assert.deepEqual(resolveVideoResolutionOptions(tieredNoResolutionsAtAll), [])
assert.equal(shouldShowVideoResolutionSelector(tieredNoResolutionsAtAll), false)

console.log('[test:video-pricing-5f] weishi preset only lists declared 720P; selector hidden')
const weishiLike = {
  id: 'builtin-weishi',
  name: '微视API',
  source: 'custom' as const,
  resolutions: ['720P'],
}
assert.deepEqual(resolveVideoResolutionOptions(weishiLike).map((item) => item.value), ['720P'])
assert.equal(shouldShowVideoResolutionSelector(weishiLike), false)

console.log('[test:video-pricing-5f] legacy flat model hides selector and defaults 720P')
assert.equal(shouldShowVideoResolutionSelector(flatVideo), false)
assert.equal(normalizeVideoResolutionValue('720', flatVideo), '720P')
assert.equal(normalizeVideoResolutionValue(undefined, flatVideo), '720P')

console.log('[test:video-pricing-5f] legacy stored 720 normalizes to 720P on tiered model')
assert.equal(normalizeVideoResolutionValue('720', tieredVideo), '720P')
const tierParams = normalizeVideoGenerationTierParams(tieredVideo, { resolution: '1080P' })
assert.equal(tierParams.resolution, '1080P')

console.log('[test:video-pricing-5f] invalid resolution falls back to default tier')
assert.equal(normalizeVideoResolutionValue('540P', tieredVideo), '720P')

console.log('[test:video-pricing-5f] custom model keeps 360p + 720P')
const customCombo = {
  id: 'custom-cog',
  name: 'cogvideox-flash',
  source: 'custom' as const,
  resolutions: ['360p', '720P'],
}
assert.deepEqual(
  resolveVideoResolutionOptions(customCombo).map((item) => item.value),
  ['360P', '720P'],
)
assert.equal(shouldShowVideoResolutionSelector(customCombo), true)
assert.equal(normalizeVideoResolutionValue('360p', customCombo), '360P')

console.log('[test:video-pricing-5f] custom unknown tag passthrough')
const customOdd = {
  id: 'custom-odd',
  name: 'odd',
  source: 'custom' as const,
  resolutions: ['540P', '720P'],
}
assert.deepEqual(
  resolveVideoResolutionOptions(customOdd).map((item) => item.value),
  ['720P', '540P'],
)
assert.equal(normalizeVideoResolutionValue('540P', customOdd), '540P')

console.log('[test:video-pricing-5f] weishi custom stale 480P overwritten by catalog 720P-only')
const catalogSeedance = mapSystemModelDto({
  model_key: 'sys_internal_seedance_2.0',
  name: '内部·Seedance 2.0',
  kind: 'video',
  source: 'system',
  api_format: 'weishi_api',
  upstream_model: 'seedance-2.0',
  haodou_cost: 1,
  billing_mode: 'internal',
  default_resolution: '720P',
  resolutions: ['720P'],
  proxy_available: false,
})
const staleWeishi = {
  id: 'builtin-weishi-api',
  name: '微视API',
  source: 'custom' as const,
  apiFormat: 'weishi_api' as const,
  model: 'seedance-2.0',
  resolutions: ['480P', '720P'],
}
const overlaid = applyWeishiCatalogCapabilities(staleWeishi, [catalogSeedance])
assert.deepEqual(overlaid.resolutions, ['720P'])
assert.deepEqual(resolveVideoResolutionOptions(overlaid).map((item) => item.value), ['720P'])
assert.equal(shouldShowVideoResolutionSelector(overlaid), false)

const merged = overlayWeishiCapabilitiesOnMergedVideoModels([staleWeishi], [catalogSeedance])
const mergedWeishi = merged.find((item) => item.id === 'builtin-weishi-api')
assert.ok(mergedWeishi)
assert.deepEqual(mergedWeishi?.resolutions, ['720P'])

console.log('[test:video-pricing-5f] stale videoPricing.resolutions aligned to catalog 720P-only')
const stalePricingWeishi = {
  ...staleWeishi,
  videoPricing: {
    pricingMode: 'by_resolution' as const,
    defaultResolution: '480P',
    resolutions: ['480P', '720P'],
  },
}
const overlaidPricing = applyWeishiCatalogCapabilities(stalePricingWeishi, [catalogSeedance])
assert.deepEqual(overlaidPricing.resolutions, ['720P'])
assert.deepEqual(overlaidPricing.videoPricing?.resolutions, ['720P'])
assert.equal(overlaidPricing.videoPricing?.defaultResolution, '720P')
assert.deepEqual(
  resolveVideoResolutionOptions(overlaidPricing).map((item) => item.value),
  ['720P'],
)
assert.equal(shouldShowVideoResolutionSelector(overlaidPricing), false)

console.log('[test:video-pricing-5f] pricing∩model intersection drops orphan 480P without catalog')
const intersectOnly = {
  id: 'custom-weishi',
  name: '微视API',
  source: 'custom' as const,
  apiFormat: 'weishi_api' as const,
  model: 'seedance-2.0',
  resolutions: ['720P'],
  videoPricing: {
    pricingMode: 'by_resolution' as const,
    defaultResolution: '480P',
    resolutions: ['480P', '720P'],
  },
}
assert.deepEqual(
  resolveVideoResolutionOptions(intersectOnly).map((item) => item.value),
  ['720P'],
)
assert.equal(shouldShowVideoResolutionSelector(intersectOnly), false)

console.log('[test:video-pricing-5f] sanitizeStoredWeishiVideoModels strips stale 480P on disk models')
const dirtyCustom = {
  id: 'custom-weishi-old',
  name: '微视API',
  source: 'custom' as const,
  apiFormat: 'weishi_api' as const,
  model: 'seedance-2.0',
  resolutions: ['480P', '720P'],
  videoPricing: {
    pricingMode: 'by_resolution' as const,
    defaultResolution: '480P',
    resolutions: ['480P', '720P'],
  },
}
const cleaned = sanitizeStoredWeishiVideoModels([
  dirtyCustom,
  { id: 'other', name: 'x', source: 'custom' as const },
])
const cleanedWeishi = cleaned.find((item) => item.id === 'custom-weishi-old')
assert.deepEqual(cleanedWeishi?.resolutions, ['720P'])
assert.deepEqual(cleanedWeishi?.videoPricing?.resolutions, ['720P'])
assert.equal(cleanedWeishi?.videoPricing?.defaultResolution, '720P')

console.log('[test:video-pricing-5f] writeBackWeishiCatalogCapabilities persists catalog 720P-only')
const { models: written, changed } = writeBackWeishiCatalogCapabilities(
  [dirtyCustom],
  [catalogSeedance],
)
assert.equal(changed, true)
assert.deepEqual(written[0]?.resolutions, ['720P'])
assert.deepEqual(written[0]?.videoPricing?.resolutions, ['720P'])

console.log('[test:video-pricing-5f] shouldPersistSanitizedWeishiVideoModels gates disk writeback')
assert.equal(shouldPersistSanitizedWeishiVideoModels([dirtyCustom]), true)
assert.equal(shouldPersistSanitizedWeishiVideoModels(cleaned), false)
assert.equal(shouldPersistSanitizedWeishiVideoModels(null), false)

console.log('[test:video-pricing-5f] all passed')
