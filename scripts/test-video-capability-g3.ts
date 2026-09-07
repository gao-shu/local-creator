/**
 * G3 · 换模型：当前值 ∉ 新开放列表 → 落到 default / 首项
 *
 * 用法：npm run test:video-capability-g3
 */

import assert from 'node:assert/strict'

import {
  buildCanvasVideoModelSwitchPatch,
  normalizeCanvasVideoProjectParams,
} from '@/lib/canvas/canvas-video-params-sync'
import { normalizeVideoCapabilitySelection } from '@/lib/models/video-model-capability'
import type { ModelConfig } from '@/types/settings'

function video(partial: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'vid-g3-a',
    name: 'G3 A',
    source: 'system',
    modelKey: 'ext_vid_g3_a',
    billingMode: 'external',
    ...partial,
  }
}

console.log('[test:video-capability-g3] keeps values still open on new model')
{
  const next = normalizeVideoCapabilitySelection(
    video({
      ratios: ['9:16', '16:9'],
      defaultRatio: '16:9',
      durations: [5, 10],
      defaultDurationSec: 5,
      resolutions: ['720P', '1080P'],
      referenceModes: ['first_frame', 'multimodal'],
      defaultReferenceMode: 'multimodal',
      videoPricing: {
        pricingMode: 'by_resolution',
        pricingSummary: 't',
        defaultResolution: '720P',
        resolutions: ['720P', '1080P'],
        unitPrice: 1,
      },
    }),
    {
      referenceMode: 'first_frame',
      durationSec: 10,
      aspectRatio: '9:16',
      resolution: '1080P',
    },
  )
  assert.equal(next.referenceMode, 'first_frame')
  assert.equal(next.durationSec, 10)
  assert.equal(next.aspectRatio, '9:16')
  assert.equal(next.resolution, '1080P')
}

console.log('[test:video-capability-g3] closed values fall to model defaults')
{
  const nextModel = video({
    id: 'vid-g3-b',
    modelKey: 'ext_vid_g3_b',
    ratios: ['1:1', '16:9'],
    defaultRatio: '1:1',
    durations: [6, 12],
    defaultDurationSec: 12,
    resolutions: ['720P'],
    referenceModes: ['text_to_video'],
    defaultReferenceMode: 'text_to_video',
    videoPricing: {
      pricingMode: 'flat',
      pricingSummary: 'flat',
      defaultResolution: '720P',
      resolutions: ['720P'],
      unitPrice: 1,
    },
  })
  const next = normalizeVideoCapabilitySelection(nextModel, {
    referenceMode: 'first_last_frame',
    durationSec: 10,
    aspectRatio: '9:16',
    resolution: '1080P',
  })
  assert.equal(next.referenceMode, 'text_to_video')
  assert.equal(next.durationSec, 12)
  assert.equal(next.aspectRatio, '1:1')
  assert.equal(next.resolution, '720P')
}

console.log('[test:video-capability-g3] canvas project params reclamp when only videoModelId changes')
{
  const models: ModelConfig[] = [
    video({
      id: 'sys_a',
      modelKey: 'a',
      ratios: ['9:16'],
      durations: [10],
      resolutions: ['1080P'],
      referenceModes: ['first_last_frame'],
      defaultReferenceMode: 'first_last_frame',
      videoPricing: {
        pricingMode: 'flat',
        pricingSummary: 'a',
        defaultResolution: '1080P',
        resolutions: ['1080P'],
        unitPrice: 1,
      },
    }),
    video({
      id: 'sys_b',
      modelKey: 'b',
      ratios: ['16:9'],
      defaultRatio: '16:9',
      durations: [5],
      defaultDurationSec: 5,
      resolutions: ['720P'],
      referenceModes: ['multimodal', 'first_frame'],
      defaultReferenceMode: 'first_frame',
      videoPricing: {
        pricingMode: 'flat',
        pricingSummary: 'b',
        defaultResolution: '720P',
        resolutions: ['720P'],
        unitPrice: 1,
      },
    }),
  ]

  const switched = normalizeCanvasVideoProjectParams(
    {
      videoModelId: 'sys_b',
      referenceMode: 'first_last_frame',
      durationSec: 10,
      aspectRatio: '9:16',
      resolution: '1080P',
    },
    null,
    models,
  )
  assert.equal(switched.videoModelId, 'sys_b')
  assert.equal(switched.referenceMode, 'first_frame')
  assert.equal(switched.durationSec, 5)
  assert.equal(switched.aspectRatio, '16:9')
  assert.equal(switched.resolution, '720P')

  const patch = buildCanvasVideoModelSwitchPatch('sys_b', models, {
    referenceMode: 'first_last_frame',
    durationSec: 10,
    aspectRatio: '9:16',
    resolution: '1080P',
  })
  assert.equal(patch.videoModelId, 'sys_b')
  assert.equal(patch.referenceMode, 'first_frame')
  assert.equal(patch.durationSec, 5)
  assert.equal(patch.aspectRatio, '16:9')
  assert.equal(patch.resolution, '720P')
}

console.log('[test:video-capability-g3] all passed')
