/**
 * G2 · 比例 / 时长 / 清晰度选项全部走 resolve（无本地写死宽兜底 / 假五档）
 *
 * 用法：npm run test:video-capability-g2
 */

import assert from 'node:assert/strict'

import { resolveCanvasVideoNodeParamsFromSettings } from '@/lib/canvas/canvas-video-params-sync'
import {
  VIDEO_CAPABILITY_FALLBACK_DURATIONS,
  VIDEO_CAPABILITY_FALLBACK_RATIOS,
  resolveVideoCapability,
} from '@/lib/models/video-model-capability'
import { resolveVideoResolutionOptions } from '@/lib/models/video-generation-tier-params'
import {
  normalizeVideoAspectValue,
  normalizeVideoDurationValue,
  resolveVideoAspectOptions,
  resolveVideoDurationOptions,
} from '@/lib/workflow/storyboard-video-presets'
import type { ModelConfig } from '@/types/settings'

function video(partial: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'vid-g2',
    name: 'G2 Video',
    source: 'system',
    modelKey: 'ext_vid_g2',
    billingMode: 'external',
    ...partial,
  }
}

console.log('[test:video-capability-g2] empty model aspect/duration match §5.2 read fallback')
{
  const model = video()
  assert.deepEqual(
    resolveVideoAspectOptions(model).map((item) => item.value),
    [...VIDEO_CAPABILITY_FALLBACK_RATIOS],
  )
  assert.deepEqual(
    resolveVideoDurationOptions(model).map((item) => Number(item.value)),
    [...VIDEO_CAPABILITY_FALLBACK_DURATIONS],
  )
  assert.equal(normalizeVideoAspectValue('9:16', model), '16:9')
  assert.equal(normalizeVideoDurationValue('10', model), '5')

  const cap = resolveVideoCapability(model)
  assert.deepEqual(
    cap.ratios.map((item) => item.value),
    resolveVideoAspectOptions(model).map((item) => item.value),
  )
  assert.deepEqual(
    cap.durations.map((item) => item.value),
    resolveVideoDurationOptions(model).map((item) => item.value),
  )
}

console.log('[test:video-capability-g2] model open lists drive options; invalid values clamp')
{
  const model = video({
    ratios: ['9:16', '1:1'],
    durations: [8, 12],
    resolutions: ['1080P'],
  })
  assert.deepEqual(
    resolveVideoAspectOptions(model).map((item) => item.value),
    ['9:16', '1:1'],
  )
  assert.deepEqual(
    resolveVideoDurationOptions(model).map((item) => item.value),
    ['8', '12'],
  )
  assert.equal(normalizeVideoAspectValue('16:9', model), '9:16')
  assert.equal(normalizeVideoDurationValue('5', model), '8')
}

console.log('[test:video-capability-g2] resolution never invents full platform table')
{
  const empty = resolveVideoResolutionOptions(video())
  assert.equal(empty.length, 0)

  const single = resolveVideoResolutionOptions(
    video({
      resolutions: ['720P'],
      videoPricing: {
        pricingMode: 'flat',
        pricingSummary: '固定',
        defaultResolution: '720P',
        resolutions: ['720P'],
        unitPrice: 1,
      },
    }),
  )
  assert.deepEqual(
    single.map((item) => item.value),
    ['720P'],
  )

  const tiered = resolveVideoResolutionOptions(
    video({
      resolutions: ['720P', '1080P'],
      videoPricing: {
        pricingMode: 'by_resolution',
        pricingSummary: '分档',
        defaultResolution: '720P',
        resolutions: ['720P', '1080P'],
        unitPrice: 0.9,
        priceByResolution: { '720P': 0.9, '1080P': 1.2 },
      },
    }),
  )
  assert.deepEqual(
    tiered.map((item) => item.value),
    ['720P', '1080P'],
  )
  assert.ok(!tiered.some((item) => item.value === '480P'))
  assert.ok(!tiered.some((item) => item.value === '4K'))
}

console.log('[test:video-capability-g2] canvas sync clamps aspect / duration / resolution to open lists')
{
  const model = video({
    ratios: ['1:1'],
    durations: [6],
    resolutions: ['1080P'],
  })
  const params = resolveCanvasVideoNodeParamsFromSettings(
    {
      lastUsedStoryboardVideoAspectRatio: '16:9',
      lastUsedStoryboardVideoDuration: '5',
      lastUsedStoryboardVideoResolution: '720P',
    },
    model,
    { aspectRatio: '9:16', durationSec: 15, resolution: '480P' },
  )
  assert.equal(params.aspectRatio, '1:1')
  assert.equal(params.durationSec, 6)
  assert.equal(params.resolution, '1080P')
}

console.log('[test:video-capability-g2] all passed')
