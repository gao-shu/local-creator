/**
 * G1 · 参考模式选项按模型 referenceModes（非写死全平台枚举）
 *
 * 用法：npm run test:video-capability-g1
 */

import assert from 'node:assert/strict'

import {
  clampVideoReferenceMode,
  resolveVideoReferenceModeOptions,
} from '@/lib/models/video-model-capability'
import { resolveCanvasVideoNodeParamsFromSettings } from '@/lib/canvas/canvas-video-params-sync'
import { resolveStoryboardVideoGeneratePrefs } from '@/lib/workflow/storyboard-video-presets'
import type { ModelConfig } from '@/types/settings'

function video(partial: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'vid-g1',
    name: 'G1 Video',
    source: 'system',
    modelKey: 'ext_vid_g1',
    billingMode: 'external',
    ...partial,
  }
}

console.log('[test:video-capability-g1] options exclude first_last_frame when not opened')
{
  const options = resolveVideoReferenceModeOptions(video())
  assert.deepEqual(
    options.map((item) => item.value),
    ['multimodal', 'first_frame', 'text_to_video'],
  )
}

console.log('[test:video-capability-g1] options only list model open modes')
{
  const options = resolveVideoReferenceModeOptions(
    video({
      referenceModes: ['first_last_frame', 'text_to_video'],
    }),
  )
  assert.deepEqual(
    options.map((item) => item.value),
    ['first_last_frame', 'text_to_video'],
  )
  assert.ok(options.every((item) => item.label.length > 0))
}

console.log('[test:video-capability-g1] canvas/settings path clamps lastUsed mode to open list')
{
  const closed = resolveCanvasVideoNodeParamsFromSettings(
    { lastUsedStoryboardVideoReferenceMode: 'first_last_frame' },
    video(),
  )
  assert.equal(closed.referenceMode, 'multimodal')

  const opened = resolveCanvasVideoNodeParamsFromSettings(
    { lastUsedStoryboardVideoReferenceMode: 'first_last_frame' },
    video({
      referenceModes: ['first_frame', 'first_last_frame'],
      defaultReferenceMode: 'first_frame',
    }),
  )
  assert.equal(opened.referenceMode, 'first_last_frame')
}

console.log('[test:video-capability-g1] canvas params clamp override mode to open list')
{
  const params = resolveCanvasVideoNodeParamsFromSettings(
    { lastUsedStoryboardVideoReferenceMode: 'multimodal' },
    video({
      referenceModes: ['text_to_video'],
      defaultReferenceMode: 'text_to_video',
    }),
    { referenceMode: 'first_last_frame' },
  )
  assert.equal(params.referenceMode, 'text_to_video')
}

console.log('[test:video-capability-g1] clamp helper for Select onChange')
{
  const model = video({ referenceModes: ['first_frame'] })
  assert.equal(clampVideoReferenceMode('first_last_frame', model), 'first_frame')
  assert.equal(clampVideoReferenceMode('first_frame', model), 'first_frame')
}

console.log('[test:video-capability-g1] batch/prefs path clamps lastUsed before generate params')
{
  const model = video()
  const prefs = resolveStoryboardVideoGeneratePrefs(
    { lastUsedStoryboardVideoReferenceMode: 'first_last_frame' },
    model,
  )
  // prefs 本身仍可能带回平台枚举值；G1 要求生视频参数出口再 clamp
  assert.equal(clampVideoReferenceMode(prefs.referenceMode, model), 'multimodal')

  const opened = video({
    referenceModes: ['first_last_frame', 'first_frame'],
    defaultReferenceMode: 'first_frame',
  })
  const prefsOpen = resolveStoryboardVideoGeneratePrefs(
    { lastUsedStoryboardVideoReferenceMode: 'first_last_frame' },
    opened,
  )
  assert.equal(clampVideoReferenceMode(prefsOpen.referenceMode, opened), 'first_last_frame')
}

console.log('[test:video-capability-g1] all passed')
