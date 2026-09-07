/**
 * Agnes 直连 vs LiteLLM 中转：轮询 task id 选择不同。
 *
 * 用法：npm run test:agnes-litellm-poll-id
 */
import assert from 'node:assert/strict'

import {
  extractOpenAiVideoPollTaskId,
  extractNativeVideoIdFromLiteLlmEncoded,
  isAgnesDirectVideoApi,
  isLiteLlmEncodedVideoId,
  resolveVideoPollUrl,
} from '../src/lib/video/openai-video-client'
import { parseVideoPollPayload } from '../src/lib/video/video-progress'

const AGNES_CREATE = 'https://apihub.agnes-ai.com/v1/videos/generations'
const LITELLM_CREATE = 'https://proxy.example.com/v1/videos/generations'
const ENCODED_VIDEO_ID =
  'video_bGl0ZWxsbTpjdXN0b21fbGxtX3Byb3ZpZGVyOm9wZW5haTttb2RlbF9pZDphZ25lcy12aWRlby12Mi4wO3ZpZGVvX2lkOnZpZGVvXzQ1ZTgwNDdlYmYxNDRkYjc5ZWY4NjQ1ZDg0MDRiOTQ0'
const TASK_ID = 'task_knOb59q7USHKiDTkHfOVyDWf0GERr1d0'

console.log('[test:agnes-litellm-poll-id] detect endpoints')
{
  assert.equal(isAgnesDirectVideoApi(AGNES_CREATE), true)
  assert.equal(isAgnesDirectVideoApi(LITELLM_CREATE), false)
  assert.equal(isLiteLlmEncodedVideoId(ENCODED_VIDEO_ID), true)
}

console.log('[test:agnes-litellm-poll-id] Agnes direct uses task_xxx (not LiteLLM video_id)')
{
  const createQueued = {
    id: TASK_ID,
    status: 'queued',
    video_id: ENCODED_VIDEO_ID,
  }
  const pollId = extractOpenAiVideoPollTaskId(createQueued, { createUrl: AGNES_CREATE })
  assert.equal(pollId, TASK_ID)
  assert.equal(
    resolveVideoPollUrl(AGNES_CREATE, pollId),
    `https://apihub.agnes-ai.com/v1/videos/${encodeURIComponent(TASK_ID)}`,
  )
}

console.log('[test:agnes-litellm-poll-id] LiteLLM proxy uses encoded video_id')
{
  const createQueued = {
    id: TASK_ID,
    status: 'queued',
    video_id: ENCODED_VIDEO_ID,
  }
  const pollId = extractOpenAiVideoPollTaskId(createQueued, { createUrl: LITELLM_CREATE })
  assert.equal(pollId, ENCODED_VIDEO_ID)
}

console.log('[test:agnes-litellm-poll-id] plain OpenAI video id still uses id')
{
  assert.equal(
    extractOpenAiVideoPollTaskId(
      { id: 'video_6900378779308191a7359266e59b53fc01cd6bbd27a70763', status: 'queued' },
      { createUrl: LITELLM_CREATE },
    ),
    'video_6900378779308191a7359266e59b53fc01cd6bbd27a70763',
  )
}

console.log('[test:agnes-litellm-poll-id] Agnes internal_status overrides stale queued')
{
  const parsed = parseVideoPollPayload({
    id: TASK_ID,
    status: 'queued',
    progress: 0,
    internal_status: 'completed',
    internal_progress: 100,
    url: 'https://platform-outputs.agnes-ai.space/videos/agnes-video-v2.0/video_45e8047ebf144db79ef8645d8404b944.mp4',
  })
  assert.equal(parsed.status, 'completed')
  assert.equal(parsed.progress, 100)
}

console.log('[test:agnes-litellm-poll-id] decode native video id from LiteLLM wrapper')
{
  assert.equal(
    extractNativeVideoIdFromLiteLlmEncoded(ENCODED_VIDEO_ID),
    'video_45e8047ebf144db79ef8645d8404b944',
  )
}

console.log('[test:agnes-litellm-poll-id] all passed')
