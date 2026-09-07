/**
 * Agnes Video 2.5 Flash：创建体 / 轮询 URL 单测
 * 用法：npm run test:agnes-video-25 -- 或 npx tsx scripts/test-agnes-video-25.ts
 */
import assert from 'node:assert/strict'

import {
  buildAgnesVideo25CreateBody,
  isAgnesVideo25Model,
  mapAgnesVideo25Mode,
  resolveAgnesVideo25CreateUrl,
  resolveAgnesVideo25PollUrl,
} from '../src/lib/video/agnes-video-25-client'
import type { ModelConfig } from '../src/types/settings'

const model: ModelConfig = {
  id: 'test-agnes-25',
  name: 'Agnes Video 2.5 Flash',
  apiFormat: 'agnes_video_25',
  platform: 'openai_compatible',
  endpoint: 'https://apihub.agnes-ai.com/v1/videos',
  baseUrl: 'https://apihub.agnes-ai.com',
  apiKey: 'sk-test',
  model: 'agnes-video-2.5-flash',
  ratios: ['16:9'],
  durations: [5],
  resolutions: ['720P'],
}

console.log('[test:agnes-video-25] detect model')
assert.equal(isAgnesVideo25Model(model), true)
assert.equal(isAgnesVideo25Model({ model: 'agnes-video-v2.0', name: 'Agnes V2' }), false)

console.log('[test:agnes-video-25] create / poll urls')
assert.equal(resolveAgnesVideo25CreateUrl(model), 'https://apihub.agnes-ai.com/v1/videos')
assert.equal(
  resolveAgnesVideo25PollUrl({
    baseUrl: model.baseUrl,
    videoId: 'video_abc',
    modelName: 'agnes-video-2.5-flash',
  }),
  'https://apihub.agnes-ai.com/agnesapi?video_id=video_abc&model_name=agnes-video-2.5-flash',
)

console.log('[test:agnes-video-25] text body')
{
  const body = buildAgnesVideo25CreateBody({
    model,
    prompt: '雨后城市',
    durationSec: 5,
    aspectRatio: '16:9',
    referenceMode: 'text_to_video',
  })
  assert.equal(body.model, 'agnes-video-2.5-flash')
  assert.equal(body.mode, 'text')
  assert.equal(body.size, '720P')
  assert.equal(body.seconds, '5')
  assert.equal(body.aspect_ratio, '16:9')
  assert.equal(body.first_frame, undefined)
}

console.log('[test:agnes-video-25] keyframe body')
{
  assert.equal(mapAgnesVideo25Mode('first_last_frame'), 'keyframe')
  const body = buildAgnesVideo25CreateBody({
    model,
    prompt: '转身',
    durationSec: 8,
    referenceMode: 'first_last_frame',
    resolvedImageUrls: ['https://a/first.png', 'https://a/last.png'],
  })
  assert.equal(body.mode, 'keyframe')
  assert.equal(body.first_frame, 'https://a/first.png')
  assert.equal(body.last_frame, 'https://a/last.png')
  assert.equal(body.seconds, '8')
}

console.log('[test:agnes-video-25] reference body caps images at 5')
{
  const urls = Array.from({ length: 7 }, (_, i) => `https://img/${i}.png`)
  const body = buildAgnesVideo25CreateBody({
    model,
    prompt: '参考',
    referenceMode: 'multimodal',
    resolvedImageUrls: urls,
    resolvedAudioUrls: ['https://a/1.mp3', 'https://a/2.mp3', 'https://a/3.mp3', 'https://a/4.mp3'],
  })
  assert.equal(body.mode, 'reference')
  assert.deepEqual(body.images, urls.slice(0, 5))
  assert.deepEqual(body.audios, ['https://a/1.mp3', 'https://a/2.mp3', 'https://a/3.mp3'])
}

console.log('[test:agnes-video-25] all passed')
