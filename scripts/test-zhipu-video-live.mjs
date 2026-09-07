/**
 * 智谱 cogvideox-flash 图生视频联调脚本
 *
 * 用法：
 *   node scripts/verify-zhipu-video-body.mjs          # 仅校验 body 格式
 *   node scripts/test-zhipu-video-live.mjs            # dry-run（默认）
 *   ZHIPU_API_KEY=xxx node scripts/test-zhipu-video-live.mjs --live
 *   node scripts/test-zhipu-video-live.mjs --live --api-key=xxx --image-url=https://...
 */

const DEFAULT_IMAGE =
  'https://strengths-img-isolation-impressed.trycloudflare.com/uploads/temp/20260625/f224c07af8fd4627b86f1d791fc19498.png'
const CREATE_URL = 'https://open.bigmodel.cn/api/paas/v4/videos/generations'

function parseArgs(argv) {
  const out = { live: false, apiKey: process.env.ZHIPU_API_KEY || '', imageUrl: DEFAULT_IMAGE }
  for (const arg of argv) {
    if (arg === '--live') out.live = true
    else if (arg.startsWith('--api-key=')) out.apiKey = arg.slice('--api-key='.length)
    else if (arg.startsWith('--image-url=')) out.imageUrl = arg.slice('--image-url='.length)
  }
  return out
}

function buildBody(imageUrl) {
  return {
    model: 'cogvideox-flash',
    prompt: 'haode-ai-client 联调：镜头缓慢推进，电影质感',
    image_url: imageUrl,
    size: '1280x960',
    quality: 'quality',
    with_audio: true,
    fps: 30,
    duration: 5,
  }
}

async function main() {
  const { live, apiKey, imageUrl } = parseArgs(process.argv.slice(2))
  const body = buildBody(imageUrl)

  console.log('[test-zhipu-video-live] CREATE URL:', CREATE_URL)
  console.log('[test-zhipu-video-live] POST body:')
  console.log(JSON.stringify(body, null, 2))
  console.log('')
  console.log(
    '说明：轮询 GET /async-result/{id} 只返回 { id, model, task_status }，不会包含 image_url。',
  )
  console.log('若 image_url 已出现在上方 POST body，则图生视频参数已正确提交。')
  console.log('')

  const head = await fetch(imageUrl, { method: 'HEAD' })
  console.log(`[test-zhipu-video-live] 参考图 HEAD ${head.status} ${imageUrl}`)

  if (!live) {
    console.log('\n[dry-run] 未调用智谱 API。加 --live 且提供 ZHIPU_API_KEY 可真实创建任务。')
    return
  }

  if (!apiKey) {
    console.error('缺少 API Key：设置环境变量 ZHIPU_API_KEY 或 --api-key=...')
    process.exit(1)
  }

  const createRes = await fetch(CREATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
  const createText = await createRes.text()
  let createJson
  try {
    createJson = JSON.parse(createText)
  } catch {
    console.error('创建响应非 JSON:', createText.slice(0, 400))
    process.exit(1)
  }

  console.log('\n[create response]', createRes.status, JSON.stringify(createJson, null, 2))
  if (!createRes.ok) process.exit(1)

  const taskId = createJson.id || createJson.request_id
  if (!taskId) {
    console.error('创建成功但未返回 task id')
    process.exit(1)
  }

  const pollUrl = `https://open.bigmodel.cn/api/paas/v4/async-result/${encodeURIComponent(taskId)}`
  const pollRes = await fetch(pollUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const pollJson = await pollRes.json()
  console.log('\n[poll response - 正常不含 image_url]', pollRes.status, JSON.stringify(pollJson, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
