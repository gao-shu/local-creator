/**
 * F2 · 能力 DTO 映射 + resolve 串联回归（对照 pricing-5a 风格）
 *
 * 覆盖：B4 顶层字段 / config_json 兜底、缺字段读兜底、default ⊆ 开放列表、
 * 空数组穿透、脏值过滤、模式排序与文案、能力与计价路径独立。
 *
 * 用法：npm run test:video-capability-f2
 * 全套：npm run test:video-capability
 */

import assert from 'node:assert/strict'

import {
  VIDEO_CAPABILITY_FALLBACK_DURATIONS,
  VIDEO_CAPABILITY_FALLBACK_RATIOS,
  VIDEO_CAPABILITY_FALLBACK_REFERENCE_MODES,
  normalizeVideoReferenceModeForModel,
  pickDefaultVideoReferenceMode,
  resolveVideoCapability,
  resolveVideoReferenceModeOptions,
} from '@/lib/models/video-model-capability'
import {
  mapSystemModelDto,
  type ClientSystemModelDto,
} from '@/lib/models/system-models-service'
import { VIDEO_REFERENCE_MODE_LABELS } from '@/lib/workflow/storyboard-video-presets'

function videoDto(partial: Partial<ClientSystemModelDto> = {}): ClientSystemModelDto {
  return {
    model_key: 'ext_vid_cap_f2',
    name: 'Cap F2 Video',
    kind: 'video',
    source: 'system',
    haodou_cost: 1,
    billing_mode: 'external',
    unit_price: '0.9',
    unit_label: '豆/秒',
    proxy_available: true,
    ...partial,
  }
}

console.log('[test:video-capability-f2] mapSystemModelDto maps B4 top-level capability fields')
{
  const mapped = mapSystemModelDto(
    videoDto({
      ratios: ['9:16', '16:9'],
      default_ratio: '9:16',
      durations: [10, 5],
      default_duration_sec: 10,
      resolutions: ['720P', '1080P'],
      default_resolution: '1080P',
      reference_modes: ['first_frame', 'first_last_frame', 'text_to_video'],
      default_reference_mode: 'first_last_frame',
      pricing_mode: 'by_resolution',
      pricing_summary: '720P~1080P: 0.9~1.2 豆/秒',
      config_json: {
        unit_price: '0.9',
        // 顶层优先：config 脏值不应覆盖
        ratios: ['1:1'],
        reference_modes: ['multimodal'],
      },
    }),
  )
  assert.deepEqual(mapped.ratios, ['9:16', '16:9'])
  assert.equal(mapped.defaultRatio, '9:16')
  assert.deepEqual(mapped.durations, [10, 5])
  assert.equal(mapped.defaultDurationSec, 10)
  assert.deepEqual(mapped.referenceModes, [
    'first_frame',
    'first_last_frame',
    'text_to_video',
  ])
  assert.equal(mapped.defaultReferenceMode, 'first_last_frame')
  assert.ok(mapped.videoPricing)
  assert.equal(mapped.videoPricing?.pricingMode, 'by_resolution')
}

console.log('[test:video-capability-f2] capability falls back to config_json when top-level absent')
{
  const mapped = mapSystemModelDto(
    videoDto({
      config_json: {
        unit_price: '1.0',
        ratios: ['1:1', '16:9'],
        default_ratio: '1:1',
        durations: [8],
        default_duration_sec: 8,
        reference_modes: ['text_to_video', 'multimodal'],
        default_reference_mode: 'text_to_video',
      },
    }),
  )
  assert.deepEqual(mapped.ratios, ['1:1', '16:9'])
  assert.equal(mapped.defaultRatio, '1:1')
  assert.deepEqual(mapped.durations, [8])
  assert.equal(mapped.defaultDurationSec, 8)
  assert.deepEqual(mapped.referenceModes, ['text_to_video', 'multimodal'])
  assert.equal(mapped.defaultReferenceMode, 'text_to_video')
}

console.log('[test:video-capability-f2] empty top-level arrays fall through to config then resolve兜底')
{
  const mapped = mapSystemModelDto(
    videoDto({
      ratios: [],
      durations: [],
      reference_modes: [],
      config_json: { unit_price: '0.9' },
    }),
  )
  assert.equal(mapped.ratios, undefined)
  assert.equal(mapped.durations, undefined)
  assert.equal(mapped.referenceModes, undefined)

  const cap = resolveVideoCapability(mapped)
  assert.deepEqual(
    cap.ratios.map((item) => item.value),
    [...VIDEO_CAPABILITY_FALLBACK_RATIOS],
  )
  assert.deepEqual(
    cap.durations.map((item) => Number(item.value)),
    [...VIDEO_CAPABILITY_FALLBACK_DURATIONS],
  )
  assert.deepEqual(
    cap.referenceModes.map((item) => item.value),
    [...VIDEO_CAPABILITY_FALLBACK_REFERENCE_MODES],
  )
  assert.ok(!cap.referenceModes.some((item) => item.value === 'first_last_frame'))
}

console.log('[test:video-capability-f2] map → resolve keeps defaults ⊆ open lists')
{
  const mapped = mapSystemModelDto(
    videoDto({
      ratios: ['21:9', '16:9'],
      default_ratio: '21:9',
      durations: [15, 5, 10],
      default_duration_sec: 15,
      reference_modes: ['text_to_video', 'first_frame', 'multimodal'],
      default_reference_mode: 'first_frame',
      resolutions: ['720P'],
      default_resolution: '720P',
      pricing_mode: 'flat',
      pricing_summary: '固定 0.9 豆/秒',
    }),
  )
  const cap = resolveVideoCapability(mapped)
  assert.equal(cap.defaultRatio, '21:9')
  assert.ok(cap.ratios.some((item) => item.value === cap.defaultRatio))
  assert.equal(cap.defaultDurationSec, 15)
  assert.ok(cap.durations.some((item) => Number(item.value) === cap.defaultDurationSec))
  assert.equal(cap.defaultReferenceMode, 'first_frame')
  assert.ok(cap.referenceModes.some((item) => item.value === cap.defaultReferenceMode))
  // 开放列表保持平台枚举顺序，而非 DTO 原始顺序
  assert.deepEqual(
    cap.referenceModes.map((item) => item.value),
    ['multimodal', 'first_frame', 'text_to_video'],
  )
  assert.equal(cap.referenceModes[0]?.label, VIDEO_REFERENCE_MODE_LABELS.multimodal)
}

console.log('[test:video-capability-f2] invalid mapped defaults clamp to first open option')
{
  const mapped = mapSystemModelDto(
    videoDto({
      ratios: ['1:1'],
      default_ratio: '9:16',
      durations: [6],
      default_duration_sec: 99,
      reference_modes: ['text_to_video'],
      default_reference_mode: 'first_last_frame',
    }),
  )
  const cap = resolveVideoCapability(mapped)
  assert.equal(cap.defaultRatio, '1:1')
  assert.equal(cap.defaultDurationSec, 6)
  assert.equal(cap.defaultReferenceMode, 'text_to_video')
  assert.equal(pickDefaultVideoReferenceMode(mapped), 'text_to_video')
}

console.log('[test:video-capability-f2] filters junk duration / unknown modes / text_only')
{
  const cap = resolveVideoCapability({
    id: 'junk',
    name: 'Junk',
    source: 'system',
    modelKey: 'junk',
    billingMode: 'external',
    ratios: [' 16:9 ', '', '9:16', '16:9'],
    durations: [0, -1, 5, Number.NaN, 601, 10],
    referenceModes: ['text_only', 'nope', 'first_last_frame', 'first_frame'],
    defaultReferenceMode: 'nope',
  })
  assert.deepEqual(
    cap.ratios.map((item) => item.value),
    ['16:9', '9:16'],
  )
  assert.deepEqual(
    cap.durations.map((item) => item.value),
    ['5', '10'],
  )
  assert.deepEqual(
    cap.referenceModes.map((item) => item.value),
    ['first_frame', 'first_last_frame'],
  )
  assert.equal(cap.defaultReferenceMode, 'first_frame')
}

console.log('[test:video-capability-f2] capability resolve works without videoPricing')
{
  const mapped = mapSystemModelDto(
    videoDto({
      ratios: ['16:9'],
      durations: [5],
      reference_modes: ['multimodal'],
      config_json: { unit_price: '3.5' },
    }),
  )
  assert.equal(mapped.videoPricing, undefined)
  const cap = resolveVideoCapability(mapped)
  assert.equal(cap.defaultRatio, '16:9')
  assert.equal(cap.defaultDurationSec, 5)
  assert.equal(cap.defaultReferenceMode, 'multimodal')
  assert.ok(cap.defaultResolution)
}

console.log('[test:video-capability-f2] normalizeVideoReferenceModeForModel prefers explicit open mode')
{
  const model = mapSystemModelDto(
    videoDto({
      reference_modes: ['multimodal', 'first_frame'],
      default_reference_mode: 'multimodal',
    }),
  )
  assert.equal(normalizeVideoReferenceModeForModel('first_frame', model), 'first_frame')
  assert.equal(normalizeVideoReferenceModeForModel('first_last_frame', model), 'multimodal')
  assert.equal(normalizeVideoReferenceModeForModel('text_only', model), 'multimodal')
}

console.log('[test:video-capability-f2] image kind must not invent video reference modes via empty resolve input')
{
  const image = mapSystemModelDto({
    model_key: 'ext_img_f2',
    name: 'Image',
    kind: 'image',
    source: 'system',
    haodou_cost: 7,
    billing_mode: 'external',
    unit_price: '7.0',
    config_json: { unit_price: '7.0' },
  })
  assert.equal(image.referenceModes, undefined)
  // resolve 对任意 model 仍可读兜底（UI 仅在 video 调用）；保证不抛
  const options = resolveVideoReferenceModeOptions(image)
  assert.deepEqual(
    options.map((item) => item.value),
    [...VIDEO_CAPABILITY_FALLBACK_REFERENCE_MODES],
  )
}

console.log('[test:video-capability-f2] all passed')
