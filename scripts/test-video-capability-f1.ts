/**
 * F1 · resolveVideoCapability 回归（纯逻辑）
 *
 * 用法：npm run test:video-capability-f1
 */

import assert from 'node:assert/strict'

import {
  VIDEO_CAPABILITY_FALLBACK_DURATIONS,
  VIDEO_CAPABILITY_FALLBACK_RATIOS,
  VIDEO_CAPABILITY_FALLBACK_REFERENCE_MODES,
  clampVideoReferenceMode,
  isVideoReferenceModeOpen,
  resolveVideoCapability,
  resolveVideoReferenceModeOptions,
} from '@/lib/models/video-model-capability'
import type { ModelConfig } from '@/types/settings'

function baseVideo(partial: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'vid-cap-1',
    name: 'Cap Video',
    source: 'system',
    modelKey: 'ext_vid_cap',
    billingMode: 'external',
    ...partial,
  }
}

console.log('[test:video-capability-f1] legacy empty model uses capability read fallbacks')
{
  const cap = resolveVideoCapability(baseVideo())
  assert.deepEqual(
    cap.ratios.map((item) => item.value),
    [...VIDEO_CAPABILITY_FALLBACK_RATIOS],
  )
  assert.equal(cap.defaultRatio, '16:9')
  assert.deepEqual(
    cap.durations.map((item) => Number(item.value)),
    [...VIDEO_CAPABILITY_FALLBACK_DURATIONS],
  )
  assert.equal(cap.defaultDurationSec, 5)
  assert.deepEqual(
    cap.referenceModes.map((item) => item.value),
    [...VIDEO_CAPABILITY_FALLBACK_REFERENCE_MODES],
  )
  assert.equal(cap.defaultReferenceMode, 'multimodal')
  assert.ok(!cap.referenceModes.some((item) => item.value === 'first_last_frame'))
}

console.log('[test:video-capability-f1] uses stored open lists and defaults')
{
  const cap = resolveVideoCapability(
    baseVideo({
      ratios: ['9:16', '16:9'],
      defaultRatio: '9:16',
      durations: [10, 5],
      defaultDurationSec: 10,
      resolutions: ['1080P', '720P'],
      videoPricing: {
        pricingMode: 'by_resolution',
        pricingSummary: 'test',
        defaultResolution: '1080P',
        resolutions: ['1080P', '720P'],
        unitPrice: 1.2,
      },
      referenceModes: ['first_frame', 'first_last_frame', 'text_to_video'],
      defaultReferenceMode: 'first_last_frame',
    }),
  )
  assert.deepEqual(
    cap.ratios.map((item) => item.value),
    ['9:16', '16:9'],
  )
  assert.equal(cap.defaultRatio, '9:16')
  assert.deepEqual(
    cap.durations.map((item) => item.value),
    ['5', '10'],
  )
  assert.equal(cap.defaultDurationSec, 10)
  assert.ok(cap.resolutions.some((item) => item.value === '1080P'))
  assert.equal(cap.defaultResolution, '1080P')
  assert.deepEqual(
    cap.referenceModes.map((item) => item.value),
    ['first_frame', 'first_last_frame', 'text_to_video'],
  )
  assert.equal(cap.defaultReferenceMode, 'first_last_frame')
}

console.log('[test:video-capability-f1] invalid defaults fall back to first open option')
{
  const cap = resolveVideoCapability(
    baseVideo({
      ratios: ['1:1'],
      defaultRatio: '9:16',
      durations: [8],
      defaultDurationSec: 99,
      referenceModes: ['text_to_video'],
      defaultReferenceMode: 'multimodal',
    }),
  )
  assert.equal(cap.defaultRatio, '1:1')
  assert.equal(cap.defaultDurationSec, 8)
  assert.equal(cap.defaultReferenceMode, 'text_to_video')
}

console.log('[test:video-capability-f1] text_only never enters open modes')
{
  const options = resolveVideoReferenceModeOptions({
    referenceModes: ['text_only', 'multimodal'],
  })
  assert.deepEqual(
    options.map((item) => item.value),
    ['multimodal'],
  )
}

console.log('[test:video-capability-f1] clamp / isOpen helpers')
{
  const model = baseVideo({
    referenceModes: ['multimodal', 'first_frame'],
    defaultReferenceMode: 'first_frame',
  })
  assert.equal(isVideoReferenceModeOpen('first_last_frame', model), false)
  assert.equal(isVideoReferenceModeOpen('first_frame', model), true)
  assert.equal(clampVideoReferenceMode('first_last_frame', model), 'first_frame')
  assert.equal(clampVideoReferenceMode('multimodal', model), 'multimodal')
}

console.log('[test:video-capability-f1] all passed')
