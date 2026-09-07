/**
 * G4 · 本地 settings / 自定义微视覆盖不得抹掉服务端能力字段
 *
 * 用法：npm run test:video-capability-g4
 */

import assert from 'node:assert/strict'

import {
  applyWeishiCatalogCapabilities,
  overlayWeishiCapabilitiesOnMergedVideoModels,
  writeBackWeishiCatalogCapabilities,
} from '@/lib/models/weishi-capability-overlay'
import { buildWeishiCustomModelPatchFromCatalog } from '@/lib/models/weishi-model-catalog'
import { normalizeVideoModelConfig } from '@/lib/models/video-model-utils'
import { resolveVideoReferenceModeOptions } from '@/lib/models/video-model-capability'
import type { ModelConfig } from '@/types/settings'

const catalogSeedance: ModelConfig = {
  id: 'sys_internal_seedance_20',
  name: '内部·Seedance 2.0',
  source: 'system',
  modelKey: 'sys_internal_seedance_20',
  billingMode: 'internal',
  apiFormat: 'weishi_api',
  model: 'seedance-2.0',
  ratios: ['16:9', '9:16'],
  defaultRatio: '16:9',
  durations: [5, 10],
  defaultDurationSec: 5,
  resolutions: ['720P'],
  referenceModes: ['multimodal', 'first_frame', 'first_last_frame'],
  defaultReferenceMode: 'first_last_frame',
  videoPricing: {
    pricingMode: 'flat',
    pricingSummary: '固定',
    defaultResolution: '720P',
    resolutions: ['720P'],
    unitPrice: 2.5,
  },
}

const staleLocal: ModelConfig = {
  id: 'builtin-weishi-api',
  name: '微视API',
  source: 'custom',
  apiFormat: 'weishi_api',
  model: 'seedance-2.0',
  ratios: ['1:1'],
  durations: [8],
  resolutions: ['480P', '720P'],
  // 本地无 referenceModes / 或陈旧缺失
}

console.log('[test:video-capability-g4] overlay restores catalog referenceModes and defaults')
{
  const overlaid = applyWeishiCatalogCapabilities(staleLocal, [catalogSeedance])
  assert.deepEqual(overlaid.ratios, ['16:9', '9:16'])
  assert.equal(overlaid.defaultRatio, '16:9')
  assert.deepEqual(overlaid.durations, [5, 10])
  assert.equal(overlaid.defaultDurationSec, 5)
  assert.deepEqual(overlaid.referenceModes, [
    'multimodal',
    'first_frame',
    'first_last_frame',
  ])
  assert.equal(overlaid.defaultReferenceMode, 'first_last_frame')
  assert.deepEqual(overlaid.resolutions, ['720P'])
  assert.ok(
    resolveVideoReferenceModeOptions(overlaid).some((item) => item.value === 'first_last_frame'),
  )
}

console.log('[test:video-capability-g4] local referenceModes must not wipe catalog open list')
{
  const localWithModes: ModelConfig = {
    ...staleLocal,
    referenceModes: ['text_to_video'],
    defaultReferenceMode: 'text_to_video',
  }
  const overlaid = applyWeishiCatalogCapabilities(localWithModes, [catalogSeedance])
  assert.deepEqual(overlaid.referenceModes, [
    'multimodal',
    'first_frame',
    'first_last_frame',
  ])
  assert.equal(overlaid.defaultReferenceMode, 'first_last_frame')
}

console.log('[test:video-capability-g4] merged list overlays custom only; system untouched')
{
  const merged = overlayWeishiCapabilitiesOnMergedVideoModels(
    [catalogSeedance, staleLocal],
    [catalogSeedance],
  )
  const system = merged.find((item) => item.id === catalogSeedance.id)
  const custom = merged.find((item) => item.id === staleLocal.id)
  assert.deepEqual(system?.referenceModes, catalogSeedance.referenceModes)
  assert.deepEqual(custom?.referenceModes, catalogSeedance.referenceModes)
}

console.log('[test:video-capability-g4] writeBack persists capability fields when changed')
{
  const { models, changed } = writeBackWeishiCatalogCapabilities([staleLocal], [catalogSeedance])
  assert.equal(changed, true)
  assert.deepEqual(models[0]?.referenceModes, catalogSeedance.referenceModes)
  assert.equal(models[0]?.defaultReferenceMode, 'first_last_frame')

  const again = writeBackWeishiCatalogCapabilities(models, [catalogSeedance])
  assert.equal(again.changed, false)
}

console.log('[test:video-capability-g4] catalog patch for new custom includes capability')
{
  const patch = buildWeishiCustomModelPatchFromCatalog('seedance-2.0', [catalogSeedance])
  assert.deepEqual(patch.referenceModes, catalogSeedance.referenceModes)
  assert.equal(patch.defaultReferenceMode, 'first_last_frame')
  assert.equal(patch.defaultRatio, '16:9')
  assert.equal(patch.defaultDurationSec, 5)
}

console.log('[test:video-capability-g4] normalizeVideoModelConfig keeps referenceModes')
{
  const normalized = normalizeVideoModelConfig({
    ...staleLocal,
    referenceModes: ['first_frame', 'first_frame', ' multimodal ', 'text_only'],
    defaultReferenceMode: 'first_frame',
  })
  assert.deepEqual(normalized.referenceModes, ['first_frame', 'multimodal', 'text_only'])
  assert.equal(normalized.defaultReferenceMode, 'first_frame')
}

console.log('[test:video-capability-g4] all passed')
