/**
 * 智谱生视频 request body 校验（不调用真实 API）
 * 用法：node scripts/verify-zhipu-video-body.mjs
 */

function formatZhipuImageUrlField(urls, options = {}) {
  const valid = urls.map((u) => String(u || '').trim()).filter(Boolean)
  if (!valid.length) return undefined
  if (options.mode === 'first_last_frame' && valid.length >= 2 && options.model === 'cogvideox-3') {
    return [valid[0], valid[1]]
  }
  return valid[0]
}

function pickExternalVideoReferencePaths(options = {}) {
  const mode = options.mode ?? 'first_frame'
  const paths = (options.paths ?? []).map((p) => String(p || '').trim()).filter(Boolean)
  const items = options.items?.length
    ? options.items
    : paths.map((path) => ({ path, kind: 'shot_reference' }))

  if (mode === 'text_to_video' || !items.length) return []

  const storyboard = items.find((item) => item.kind === 'storyboard')
  const endFrame = items.find((item) => item.kind === 'end_frame')

  if (mode === 'first_last_frame') {
    const start = storyboard ?? items[0]
    const end =
      endFrame ?? items.find((item) => item.path !== start?.path && item.kind !== 'storyboard')
    const selected = []
    if (start?.path) selected.push(start.path)
    if (end?.path && end.path !== start?.path) selected.push(end.path)
    return selected
  }

  if (storyboard?.path) return [storyboard.path]
  if (items[0]?.path) return [items[0].path]
  return paths.slice(0, 1)
}

function buildZhipuBody({ model, prompt, resolvedImageUrls, referenceMode }) {
  const imageField = formatZhipuImageUrlField(resolvedImageUrls ?? [], {
    mode: referenceMode,
    model,
  })
  const body = {
    model,
    prompt,
    quality: 'quality',
    with_audio: true,
    fps: 30,
    duration: 5,
  }
  if (imageField) body.image_url = imageField
  return body
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const sampleUrl = 'https://strengths-img-isolation-impressed.trycloudflare.com/uploads/temp/20260625/test.png'
const storyboardPath = 'pictures/gen_shot_abc.png'

// 1. flash 单图必须是 string，不能是数组
const flashField = formatZhipuImageUrlField([sampleUrl], {
  mode: 'multimodal',
  model: 'cogvideox-flash',
})
assert(typeof flashField === 'string', `flash 应为 string，实际 ${typeof flashField}`)
assert(!Array.isArray(flashField), 'flash 不应为数组')

// 2. 多参模式选图：分镜主图
const selected = pickExternalVideoReferencePaths({
  mode: 'multimodal',
  items: [
    { path: storyboardPath, kind: 'storyboard', label: '当前分镜图' },
    { path: 'pictures/ref_1.png', kind: 'shot_reference', label: '参考' },
    { path: 'Roles/char.png', kind: 'mention', label: '@角色' },
  ],
})
assert(selected.length === 1 && selected[0] === storyboardPath, 'multimodal 应只选分镜主图')

// 3. 完整 body 必须含 image_url
const body = buildZhipuBody({
  model: 'cogvideox-flash',
  prompt: '测试 prompt',
  resolvedImageUrls: [sampleUrl],
  referenceMode: 'first_frame',
})
assert(typeof body.image_url === 'string', 'create body 必须含 string image_url')
assert(body.image_url === sampleUrl, 'image_url 应与上传 URL 一致')

// 4. cogvideox-3 首尾帧为数组
const v3Field = formatZhipuImageUrlField([sampleUrl, sampleUrl.replace('test', 'tail')], {
  mode: 'first_last_frame',
  model: 'cogvideox-3',
})
assert(Array.isArray(v3Field) && v3Field.length === 2, 'cogvideox-3 首尾帧应为 2 元素数组')

console.log('[verify-zhipu-video-body] 全部通过')
console.log('示例 POST /videos/generations body:')
console.log(JSON.stringify(body, null, 2))
