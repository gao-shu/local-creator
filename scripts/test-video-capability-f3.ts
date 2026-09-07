/**
 * F3 · 首尾帧按模型开放（去掉全局 unsupported 硬编码）
 *
 * 用法：npm run test:video-capability-f3
 */

import assert from 'node:assert/strict'

import {
  getUnsupportedVideoReferenceModeMessage,
  isVideoReferenceModeOpen,
  resolveVideoCapability,
} from '@/lib/models/video-model-capability'
import * as presets from '@/lib/workflow/storyboard-video-presets'
import type { ModelConfig } from '@/types/settings'

function video(partial: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'vid-f3',
    name: 'F3 Video',
    source: 'system',
    modelKey: 'ext_vid_f3',
    billingMode: 'external',
    ...partial,
  }
}

console.log('[test:video-capability-f3] legacy model (no referenceModes) still blocks first_last_frame')
{
  const model = video()
  assert.equal(isVideoReferenceModeOpen('first_last_frame', model), false)
  assert.equal(
    getUnsupportedVideoReferenceModeMessage('first_last_frame', model),
    '当前模型不支持「首尾帧」',
  )
  assert.equal(getUnsupportedVideoReferenceModeMessage('multimodal', model), null)
  assert.equal(getUnsupportedVideoReferenceModeMessage('first_frame', model), null)
  assert.equal(getUnsupportedVideoReferenceModeMessage('text_to_video', model), null)
}

console.log('[test:video-capability-f3] open list containing first_last_frame allows generation')
{
  const model = video({
    referenceModes: ['multimodal', 'first_frame', 'first_last_frame'],
    defaultReferenceMode: 'first_last_frame',
  })
  assert.equal(isVideoReferenceModeOpen('first_last_frame', model), true)
  assert.equal(getUnsupportedVideoReferenceModeMessage('first_last_frame', model), null)
  assert.equal(resolveVideoCapability(model).defaultReferenceMode, 'first_last_frame')
}

console.log('[test:video-capability-f3] any closed mode is blocked with mode label')
{
  const model = video({
    referenceModes: ['text_to_video'],
    defaultReferenceMode: 'text_to_video',
  })
  assert.equal(
    getUnsupportedVideoReferenceModeMessage('multimodal', model),
    '当前模型不支持「全能多参」',
  )
  assert.equal(
    getUnsupportedVideoReferenceModeMessage('first_frame', model),
    '当前模型不支持「首帧图参考」',
  )
  assert.equal(getUnsupportedVideoReferenceModeMessage('text_to_video', model), null)
}

console.log('[test:video-capability-f3] missing model uses read fallback (no first_last_frame)')
{
  assert.equal(
    getUnsupportedVideoReferenceModeMessage('first_last_frame'),
    '当前模型不支持「首尾帧」',
  )
  assert.equal(getUnsupportedVideoReferenceModeMessage('multimodal'), null)
}

console.log('[test:video-capability-f3] global hardcode removed from presets module')
{
  assert.equal(
    'getUnsupportedVideoReferenceModeMessage' in presets,
    false,
    'presets must not own global unsupported helper',
  )
  assert.equal(
    presets.VIDEO_REFERENCE_MODE_HINTS.first_last_frame.includes('暂不支持'),
    false,
  )
}

console.log('[test:video-capability-f3] all passed')
