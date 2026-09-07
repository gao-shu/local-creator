import type { ModelConfig } from '@/types/settings'

export function normalizeApiBase(endpoint?: string) {
  return (endpoint || '').trim().replace(/\/+$/, '')
}

/** 提取 API 根地址（域名或到 /v1 为止），避免在完整路径后再拼接子路径 */
export function resolveApiV1Root(endpoint: string, autoAppendV1 = true): string {
  const base = normalizeApiBase(endpoint)
  if (!base) throw new Error('API 地址未配置')

  const v1Index = base.indexOf('/v1')
  if (v1Index !== -1) {
    return base.slice(0, v1Index + 3)
  }

  return autoAppendV1 ? `${base}/v1` : base
}

export function resolveOpenAiPath(
  endpoint: string,
  path: string,
  autoAppendV1 = true,
): string {
  const base = normalizeApiBase(endpoint)
  if (!base) throw new Error('API 地址未配置')

  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (base.endsWith(normalizedPath)) {
    return base
  }

  const root = resolveApiV1Root(base, autoAppendV1)

  if (root.endsWith('/v1')) {
    return `${root}${normalizedPath}`
  }

  if (autoAppendV1) {
    return `${root}/v1${normalizedPath}`
  }

  return `${root}${normalizedPath}`
}

export function resolveChatUrl(model: ModelConfig) {
  return resolveOpenAiPath(model.endpoint || '', '/chat/completions', model.autoAppendV1 !== false)
}

export function resolveImageUrl(model: ModelConfig) {
  return resolveOpenAiPath(model.endpoint || '', '/images/generations', model.autoAppendV1 !== false)
}

/** 图编辑 / 参考图：OpenAI 兼容 POST /v1/images/edits */
export function resolveImageEditUrl(model: ModelConfig) {
  const generationsUrl = resolveImageUrl(model)
  if (/\/images\/generations$/i.test(generationsUrl)) {
    return generationsUrl.replace(/\/images\/generations$/i, '/images/edits')
  }
  return resolveOpenAiPath(model.endpoint || '', '/images/edits', model.autoAppendV1 !== false)
}

/** 异步生图任务查询：GET /v1/images/tasks/{id} */
export function resolveImageTaskPollUrl(
  createUrl: string,
  taskId: string,
  pollUrl?: string | null,
): string {
  const relativeOrAbsolute = String(pollUrl || '').trim()
  if (relativeOrAbsolute) {
    if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute
    try {
      return new URL(relativeOrAbsolute, new URL(createUrl).origin).href
    } catch {
      /* fall through */
    }
  }

  const id = String(taskId || '').trim()
  if (!id) throw new Error('图片任务 ID 为空')

  const trimmed = normalizeApiBase(createUrl)
  const replaced = trimmed.replace(/\/images\/(?:generations|edits)$/i, `/images/tasks/${encodeURIComponent(id)}`)
  if (replaced !== trimmed) return replaced

  const root = resolveApiV1Root(trimmed, true)
  return `${root}/images/tasks/${encodeURIComponent(id)}`
}

export function resolveModelsUrl(model: ModelConfig) {
  return resolveOpenAiPath(model.endpoint || '', '/models', model.autoAppendV1 !== false)
}
