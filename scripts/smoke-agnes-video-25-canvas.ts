/**
 * 临时冒烟：Agnes Video 2.5 Flash 文生视频（不入库）
 * npx tsx scripts/smoke-agnes-video-25-canvas.ts
 */
import {
  createAgnesVideo25Task,
  pollAgnesVideo25Task,
} from '../src/lib/video/agnes-video-25-client'
import type { ModelConfig } from '../src/types/settings'

const apiKey = process.env.AGNES_API_KEY || 'sk-ZwiKGxKYSaRyWy9kmsmsFPwGJChWevm4EL2kW6SISNKkufQw'

const model: ModelConfig = {
  id: 'smoke-agnes-25',
  name: 'Agnes Video 2.5 Flash',
  apiFormat: 'agnes_video_25',
  platform: 'openai_compatible',
  endpoint: 'https://apihub.agnes-ai.com/v1/videos',
  baseUrl: 'https://apihub.agnes-ai.com',
  apiKey,
  model: 'agnes-video-2.5-flash',
  ratios: ['16:9'],
  durations: [5],
  resolutions: ['720P'],
}

async function main() {
  const started = Date.now()
  console.log('[smoke] creating text-to-video via canvas-compatible client...')
  const created = await createAgnesVideo25Task({
    model,
    prompt: '一只橘猫在阳光下窗台打盹，镜头缓慢推进，柔和自然光，电影感',
    durationSec: 5,
    aspectRatio: '16:9',
    referenceMode: 'text_to_video',
  })
  console.log('[smoke] created', {
    videoId: created.videoId,
    createUrl: created.createUrl,
    hasUrl: Boolean(created.videoUrl),
    status: created.rawData.status,
    keys: Object.keys(created.rawData).slice(0, 20),
  })

  if (created.videoUrl) {
    console.log('[smoke] SUCCESS immediate', created.videoUrl.slice(0, 180))
    return
  }

  console.log('[smoke] polling /agnesapi ...')
  const url = await pollAgnesVideo25Task(apiKey, model, created.videoId, (p) => {
    console.log('[progress]', p.message, p.progress ?? '')
  })
  console.log('[smoke] SUCCESS', {
    elapsedSec: Math.round((Date.now() - started) / 1000),
    url: url.slice(0, 200),
  })
}

main().catch((error) => {
  console.error('[smoke] FAILED', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
