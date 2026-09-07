import type { HaodouConsumeReason } from '@/lib/auth/haodou-labels'
import type { ModelConfig } from '@/types/settings'
import { runWithHaodouConsume } from '@/lib/auth/haodou-generation-guard'
import { resolveChatUrl } from '@/lib/models/model-endpoint'
import { isSystemModel, shouldUseSystemModelProxy } from '@/lib/models/system-models-service'
import { proxySystemModelChat } from '@/lib/models/system-model-proxy'
import { readSettings } from '@/lib/storage/settings-service'

function extractMessageContent(payload: unknown): string {
  const data = payload as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>
    output_text?: string
    content?: string
  }
  const choice = data.choices?.[0]?.message?.content
  if (typeof choice === 'string') return choice
  if (Array.isArray(choice)) {
    return choice.map((part) => part.text || '').join('')
  }
  if (typeof data.output_text === 'string') return data.output_text
  if (typeof data.content === 'string') return data.content
  throw new Error('LLM 返回格式无法解析')
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type LlmCallOptions = {
  temperature?: number
  /** external 系统模型扣豆 reason，默认 consume_script */
  haodouReason?: HaodouConsumeReason
  /** 用户取消生图/分镜等 */
  signal?: AbortSignal
}

function parseJsonErrorBody(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{')) return null
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    return null
  }
}

function extractRemoteErrorMessage(data: Record<string, unknown>): string {
  const errObj = data.error as { message?: string } | string | undefined
  if (typeof errObj === 'string' && errObj.trim()) return errObj.trim()
  if (typeof errObj === 'object' && errObj?.message) return String(errObj.message).trim()
  const msg = String(data.message || '').trim()
  if (msg) return msg
  return ''
}

function resolveLlmProviderLabel(endpoint?: string): string | null {
  const host = (endpoint || '').toLowerCase()
  if (host.includes('siliconflow')) return 'SiliconFlow'
  if (host.includes('openai.com')) return 'OpenAI'
  if (host.includes('deepseek')) return 'DeepSeek'
  return null
}

/** 将 HTTP 错误转为用户可读的中文提示 */
export function formatLlmHttpError(
  status: number,
  detail: string,
  model?: Pick<ModelConfig, 'name' | 'endpoint'>,
): string {
  const modelLabel = model?.name?.trim() || '当前模型'
  const data = parseJsonErrorBody(detail)
  const remoteMsg = data ? extractRemoteErrorMessage(data) : detail.trim()
  const code = data?.code ?? (data?.error as { code?: unknown } | undefined)?.code
  const combined = `${remoteMsg} ${detail}`.toLowerCase()
  const provider = resolveLlmProviderLabel(model?.endpoint)

  if (
    status === 403 &&
    (code === 30001 ||
      (combined.includes('balance') && combined.includes('insufficient')) ||
      combined.includes('余额不足'))
  ) {
    const providerHint = provider ? `${provider} ` : ''
    return `「${modelLabel}」调用失败：${providerHint}账户余额不足，请充值后重试，或前往「设置 → 模型配置」更换 API Key / 其他模型。`
  }
  if (status === 401 || combined.includes('invalid api key') || combined.includes('incorrect api key')) {
    return `「${modelLabel}」API Key 无效或未授权，请检查「设置 → 模型配置」中的密钥。`
  }
  if (status === 429 || combined.includes('rate limit')) {
    return `「${modelLabel}」请求过于频繁或配额耗尽，请稍后重试。`
  }
  if (status === 404) {
    return `「${modelLabel}」模型不存在或 API 地址错误，请检查模型 ID 与接口地址。`
  }
  if (remoteMsg) {
    return `「${modelLabel}」请求失败 (${status})：${remoteMsg}`
  }
  return `「${modelLabel}」请求失败 (${status})${detail ? `：${detail.slice(0, 200)}` : ''}`
}

function flattenMessagesForSystemModelPrompt(messages: ChatCompletionMessage[]): string {
  const systemParts = messages.filter((item) => item.role === 'system').map((item) => item.content)
  const dialogParts = messages
    .filter((item) => item.role !== 'system')
    .map((item) => `${item.role === 'user' ? 'User' : 'Assistant'}: ${item.content}`)
  return [
    systemParts.length ? `[System Instructions]\n${systemParts.join('\n\n')}` : '',
    dialogParts.length ? `[Conversation]\n${dialogParts.join('\n\n')}` : '',
    'Reply as Assistant in concise Chinese. Do not prefix with "Assistant:".',
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** 多轮对话（system / user / assistant） */
export async function callChatCompletionsWithMessages(
  model: ModelConfig,
  messages: ChatCompletionMessage[],
  options?: LlmCallOptions,
): Promise<string> {
  const temperature = options?.temperature ?? 0.7
  const promptText = flattenMessagesForSystemModelPrompt(messages)

  if (shouldUseSystemModelProxy(model)) {
    const settings = (await readSettings()).data
    return runWithHaodouConsume(
      {
        model,
        kind: 'llm',
        reason: options?.haodouReason ?? 'consume_script',
        apiBase: settings.apiBaseUrl,
      },
      async () => {
        const content = await proxySystemModelChat({
          modelKey: model.modelKey,
          prompt: promptText,
          temperature,
          apiBase: settings.apiBaseUrl,
          abortSignal: options?.signal,
        })
        return content
      },
    )
  }

  if (isSystemModel(model) && model.modelKey && !shouldUseSystemModelProxy(model)) {
    throw new Error(
      `内部 API 模型「${model.name}」不走服务端代理，请使用支持的模型类型（当前 LLM 内部模型暂不支持）`,
    )
  }

  if (!model.apiKey?.trim()) {
    throw new Error(`模型「${model.name}」未配置 API Key`)
  }
  if (!model.model?.trim()) {
    throw new Error(`模型「${model.name}」未配置 model 名称`)
  }

  const url = resolveChatUrl(model)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: model.model,
      messages,
      temperature,
    }),
    signal: options?.signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(formatLlmHttpError(response.status, detail, model))
  }

  const payload = await response.json()
  return extractMessageContent(payload)
}

export async function callChatCompletions(
  model: ModelConfig,
  prompt: string,
  options?: LlmCallOptions,
): Promise<string> {
  const temperature = options?.temperature ?? 0.7

  if (shouldUseSystemModelProxy(model)) {
    const settings = (await readSettings()).data
    return runWithHaodouConsume(
      {
        model,
        kind: 'llm',
        reason: options?.haodouReason ?? 'consume_script',
        apiBase: settings.apiBaseUrl,
      },
      async () => {
        const content = await proxySystemModelChat({
          modelKey: model.modelKey,
          prompt,
          temperature,
          apiBase: settings.apiBaseUrl,
          abortSignal: options?.signal,
        })
        return content
      },
    )
  }

  if (isSystemModel(model) && model.modelKey && !shouldUseSystemModelProxy(model)) {
    throw new Error(
      `内部 API 模型「${model.name}」不走服务端代理，请使用支持的模型类型（当前 LLM 内部模型暂不支持）`,
    )
  }

  if (!model.apiKey?.trim()) {
    throw new Error(`模型「${model.name}」未配置 API Key`)
  }
  if (!model.model?.trim()) {
    throw new Error(`模型「${model.name}」未配置 model 名称`)
  }

  const url = resolveChatUrl(model)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify({
      model: model.model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
    }),
    signal: options?.signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(formatLlmHttpError(response.status, detail, model))
  }

  const payload = await response.json()
  return extractMessageContent(payload)
}

export function resolvePreferredLlmModelId(
  models: ModelConfig[],
  ...candidates: Array<string | undefined | null>
): string | undefined {
  if (!models.length) return undefined
  const validIds = new Set(models.map((m) => m.id))
  for (const candidate of candidates) {
    if (candidate && validIds.has(candidate)) return candidate
  }
  return undefined
}

export function getLlmModelSelectionError(
  models: ModelConfig[] | undefined,
  selectedId: string | undefined,
): string | null {
  if (!models?.length) return '请先在系统设置中配置 LLM 模型'
  if (!selectedId?.trim()) return '请选择 LLM 模型'
  if (!models.some((m) => m.id === selectedId)) return '请选择 LLM 模型'
  return null
}

export function pickLlmModel(models: ModelConfig[], preferredId?: string): ModelConfig {
  if (!models.length) {
    throw new Error('请先在系统设置中配置 LLM 模型')
  }
  if (preferredId) {
    const hit = models.find((m) => m.id === preferredId || m.model === preferredId || m.name === preferredId)
    if (hit) return hit
  }
  return models[0]
}
