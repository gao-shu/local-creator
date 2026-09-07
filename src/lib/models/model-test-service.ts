import type { ModelConfig, ModelKind } from '@/types/settings'
import { isWeishiApiModel, pickWeishiVideoDurationSec } from '@/lib/models/weishi-model-presets'
import { buildWeishiVideoCreateBody } from '@/lib/models/weishi-video-client'
import {
  pickFirstDuration,
  pickFirstRatio,
  pickFirstResolution,
} from '@/lib/models/video-model-utils'
import {
  normalizeApiBase,
  resolveChatUrl,
  resolveImageUrl,
  resolveModelsUrl,
} from '@/lib/models/model-endpoint'
import { isGrokImageModel } from '@/lib/models/image-model-presets'
import { mapSizeToGrokImageParams } from '@/lib/models/image-client'
import { resolveVideoCreateUrl } from '@/lib/models/video-model-utils'
import {
  buildGrokVideoCreateBody,
  isGrokVideoModel,
  resolveGrokVideoCreateUrl,
} from '@/lib/video/grok-video-client'

export interface ModelTestResult {
  success: boolean
  message: string
}

function isFullResourceEndpoint(endpoint?: string): boolean {
  const base = normalizeApiBase(endpoint)
  if (!base) return false
  try {
    const pathname = new URL(base).pathname
    return /\/(generations|completions|embeddings|audio|videos)(\/|$)/i.test(pathname)
  } catch {
    return false
  }
}

async function readErrorDetail(response: Response) {
  const text = await response.text().catch(() => '')
  if (!text) return ''
  try {
    const json = JSON.parse(text) as { error?: { message?: string }; message?: string }
    return json.error?.message || json.message || text
  } catch {
    return text.slice(0, 200)
  }
}

function classifyHttpResult(
  status: number,
  detail: string,
  resourceLabel: '视频' | '图片',
): ModelTestResult {
  if (status === 401 || status === 403) {
    return { success: false, message: 'API Key 无效或权限不足，请检查 Key 是否正确' }
  }
  if (status === 404) {
    return {
      success: false,
      message: '接口地址不存在，请检查 endpoint 路径是否正确',
    }
  }
  if (status === 429) {
    return { success: false, message: '请求频率超限，请稍后重试' }
  }
  if (status === 400 || status === 422) {
    return { success: true, message: `连接成功，${resourceLabel}生成接口可达` }
  }
  if (status >= 200 && status < 300) {
    return { success: true, message: `连接成功，${resourceLabel}生成接口可用` }
  }
  return {
    success: false,
    message: `${resourceLabel}接口检测失败 (${status})${detail ? `：${detail}` : ''}`,
  }
}

async function testWeishiVideoEndpoint(model: ModelConfig): Promise<ModelTestResult> {
  const url = normalizeApiBase(model.endpoint)
  if (!url) throw new Error('请填写 API 地址')

  const body = buildWeishiVideoCreateBody({
    model: model.model,
    prompt: '连接测试',
    duration: pickWeishiVideoDurationSec(),
    ratio: pickFirstRatio(model),
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await readErrorDetail(response)
    return classifyHttpResult(response.status, detail, '视频')
  }

  return { success: true, message: '连接成功，微视视频接口可用' }
}

async function testGrokVideoEndpoint(model: ModelConfig): Promise<ModelTestResult> {
  const url = resolveGrokVideoCreateUrl(model)
  if (!url) throw new Error('请填写 API 地址（根域名即可，将自动拼接 /v1/videos）')

  const body = buildGrokVideoCreateBody({
    modelId: model.model,
    prompt: 'connection-test',
    durationSec: pickFirstDuration(model),
    aspectRatio: pickFirstRatio(model),
    resolution: pickFirstResolution(model),
    referenceMode: 'text_to_video',
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await readErrorDetail(response)
    return classifyHttpResult(response.status, detail, '视频')
  }

  return { success: true, message: '连接成功，Grok 视频接口可用' }
}

async function testGenericVideoEndpoint(model: ModelConfig): Promise<ModelTestResult> {
  const url = resolveVideoCreateUrl(model)
  if (!url) throw new Error('请填写 API 地址')

  const body: Record<string, unknown> = {
    model: model.model,
    prompt: 'connection-test',
  }
  const duration = pickFirstDuration(model)
  const ratio = pickFirstRatio(model)
  const resolution = pickFirstResolution(model)
  if (duration) body.duration = duration
  if (ratio) {
    body.ratio = ratio
    body.aspect_ratio = ratio
  }
  if (resolution) body.resolution = resolution

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await readErrorDetail(response)
    return classifyHttpResult(response.status, detail, '视频')
  }

  return { success: true, message: '连接成功，视频生成接口可用' }
}

async function testImageEndpoint(model: ModelConfig): Promise<ModelTestResult> {
  const url = resolveImageUrl(model)
  const body: Record<string, unknown> = {
    model: model.model,
    prompt: 'test',
    n: 1,
  }
  if (isGrokImageModel(model)) {
    const mapped = mapSizeToGrokImageParams('1024x1024')
    body.aspect_ratio = mapped.aspect_ratio
    body.resolution = mapped.resolution
  } else {
    body.size = '1024x1024'
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok) {
    const detail = await readErrorDetail(response)
    return classifyHttpResult(response.status, detail, '图片')
  }

  return { success: true, message: '连接成功，图片生成接口可用' }
}

async function testModelsEndpoint(model: ModelConfig): Promise<ModelTestResult> {
  const url = resolveModelsUrl(model)
  const headers: Record<string, string> = {}
  if (model.apiKey?.trim()) {
    headers.Authorization = `Bearer ${model.apiKey}`
  }

  const response = await fetch(url, { method: 'GET', headers })
  if (response.ok) {
    return { success: true, message: '连接成功，模型列表接口可用' }
  }

  const detail = await readErrorDetail(response)
  return {
    success: false,
    message: `模型列表检测失败 (${response.status})${detail ? `：${detail}` : ''}`,
  }
}

async function testChatEndpoint(model: ModelConfig): Promise<ModelTestResult> {
  const url = resolveChatUrl(model)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: model.model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (response.ok) {
    return { success: true, message: '连接成功，对话接口可用（模型可调用）' }
  }

  const detail = await readErrorDetail(response)
  if (response.status === 401 || response.status === 403) {
    return { success: false, message: 'API Key 无效或权限不足，请检查 Key 是否正确' }
  }
  if (response.status === 404) {
    return {
      success: false,
      message: '对话接口不存在，请检查 API 地址与「自动补充 /v1 路径」设置',
    }
  }
  if (response.status === 429) {
    return { success: false, message: '请求频率超限，请稍后重试' }
  }
  return {
    success: false,
    message: `对话接口检测失败 (${response.status})${detail ? `：${detail}` : ''}`,
  }
}

async function testLlmEndpoint(model: ModelConfig): Promise<ModelTestResult> {
  // LLM 必须以最小 chat/completions 验证模型可调用；/v1/models 只能说明网关与 Key 可达
  const chatResult = await testChatEndpoint(model)
  if (chatResult.success) return chatResult

  const modelsResult = await testModelsEndpoint(model)
  if (modelsResult.success) {
    const detail = chatResult.message.replace(/^对话接口检测失败[^：]*：?/, '').trim()
    return {
      success: false,
      message: detail
        ? `模型列表接口可用，但模型「${model.model}」无法对话：${detail}`
        : `模型列表接口可用，但模型「${model.model}」对话调用失败，请检查模型 ID 与账户权限`,
    }
  }

  return chatResult
}

function validateModelForTest(model: ModelConfig, kind: ModelKind) {
  if (!model.name.trim()) throw new Error('请填写配置名称')
  if (!model.endpoint?.trim()) throw new Error('请填写 API 地址')
  if (model.platform !== 'ollama' && !model.apiKey?.trim()) {
    throw new Error('请填写 API 密钥')
  }
  if ((kind === 'llm' || kind === 'video' || kind === 'image') && !model.model?.trim()) {
    throw new Error('请填写模型 ID')
  }
}

export async function testModelConnection(
  kind: ModelKind,
  model: ModelConfig,
): Promise<ModelTestResult> {
  validateModelForTest(model, kind)

  if (model.platform === 'ollama') {
    const base = (model.endpoint || 'http://127.0.0.1:11434').replace(/\/+$/, '')
    const response = await fetch(`${base}/api/tags`)
    if (!response.ok) {
      const detail = await readErrorDetail(response)
      return { success: false, message: `Ollama 连接失败：${detail || response.status}` }
    }
    return { success: true, message: 'Ollama 连接成功' }
  }

  if (kind === 'video') {
    if (isWeishiApiModel(model)) {
      return testWeishiVideoEndpoint(model)
    }
    if (isGrokVideoModel(model)) {
      return testGrokVideoEndpoint(model)
    }
    return testGenericVideoEndpoint(model)
  }

  if (kind === 'image') {
    return testImageEndpoint(model)
  }

  if (kind === 'llm') {
    if (isFullResourceEndpoint(model.endpoint)) {
      return testChatEndpoint(model)
    }
    return testLlmEndpoint(model)
  }

  return testModelsEndpoint(model)
}
