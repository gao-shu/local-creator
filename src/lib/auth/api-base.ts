// Copyright (c) local-creator. All rights reserved.

/**
 * 开源版：默认无公司后端。apiBase 仅用于可选「自建后端」；空字符串表示不使用。
 */

/** @deprecated 历史联调地址，仅作陈旧值识别 */
export const DEFAULT_TUNNEL_API_BASE = ''

/** @deprecated */
export const DEFAULT_TUNNEL_UPLOAD_ORIGIN = ''

/** @deprecated 不再作为默认兜底 */
export const DEFAULT_LOCAL_API_BASE = ''

/** Node smoke / tsx 脚本中 import.meta.env 可能未注入 */
function readViteEnv(): ImportMetaEnv {
  return (import.meta as ImportMeta & { env?: ImportMetaEnv }).env ?? ({} as ImportMetaEnv)
}

/** 公司/历史默认 host：导入旧 settings 时清空（含端口与路径） */
const STALE_COMPANY_API_PATTERNS = [
  /8\.141\.97\.65/i,
  /115\.191\.9\.56/i,
  /trycloudflare\.com/i,
  /learncom\.cn/i,
  new RegExp('hao' + 'de' + 'wei' + 'shi\\.cn', 'i'),
  new RegExp('hao' + 'de-ai\\.', 'i'),
  /duanju\./i,
]

function isStaleCompanyApiBase(url: string): boolean {
  const n = url.trim()
  if (!n) return false
  return STALE_COMPANY_API_PATTERNS.some((re) => re.test(n))
}

/** 历史：开发态 Vite 同源代理路径 */
export const DEV_PROXY_API_BASE = '/api'

/** @deprecated 使用 resolveApiBase() */
export const DEFAULT_API_BASE = ''

export const API_BASE_LS_KEY = 'local_creator_api_base'

const LOCAL_API_PATTERNS = [
  /^https?:\/\/localhost:28080(?:\/api)?\/?$/i,
  /^https?:\/\/127\.0\.0\.1:28080(?:\/api)?\/?$/i,
  /^https?:\/\/localhost:8080(?:\/api)?\/?$/i,
  /^https?:\/\/127\.0\.0\.1:8080(?:\/api)?\/?$/i,
  /^https?:\/\/127\.0\.0\.1:8000\/?$/i,
  /^https?:\/\/localhost:8000\/?$/i,
  /^https?:\/\/localhost:15173(?:\/api)?\/?$/i,
  /^https?:\/\/127\.0\.0\.1:15173(?:\/api)?\/?$/i,
]

export function normalizeApiBase(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (trimmed.startsWith('/')) return trimmed

  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `http://${trimmed}`)
    if (parsed.port === '8080' && !parsed.pathname.startsWith('/api')) {
      return `${parsed.origin}/api`.replace(/\/+$/, '')
    }
    if (parsed.port === '28080' && !parsed.pathname.startsWith('/api')) {
      return `${parsed.origin}/api`.replace(/\/+$/, '')
    }
    return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '') || parsed.origin
  } catch {
    return trimmed
  }
}

/** 构建时可选注入；未配置则为空（本地直连模型，不依赖公司 API） */
export function getBuiltInApiBase(): string {
  const env = readViteEnv()
  const fromEnv = env.VITE_API_BASE?.trim()
  if (!fromEnv) return ''
  if (isStaleCompanyApiBase(fromEnv)) return ''
  return normalizeApiBase(fromEnv)
}

/** @deprecated */
export const LEGACY_TUNNEL_API_BASE = ''

/**
 * 迁移旧 settings：公司默认域名/IP → 空；保留用户自建后端地址。
 */
export function migrateApiBaseUrl(url: string | undefined, fallback = ''): string {
  const trimmed = url?.trim()
  if (!trimmed) return fallback
  const normalized = normalizeApiBase(trimmed)
  if (!normalized) return fallback
  if (isStaleCompanyApiBase(normalized)) return fallback
  if (normalized === DEV_PROXY_API_BASE || normalized.startsWith('/')) {
    return fallback
  }
  return normalized
}

/** 开源版始终允许编辑可选自建后端地址 */
export function canEditApiBaseUrl(_debugEnabled = false): boolean {
  return true
}

export function toRuntimeApiBase(resolved: string): string {
  if (!resolved || resolved === DEV_PROXY_API_BASE || resolved.startsWith('/')) {
    return getBuiltInApiBase()
  }
  return resolved
}

/** 优先级：settings 显式地址（非公司陈旧值）> 可选 VITE_API_BASE > 空 */
export function resolveApiBase(explicit?: string | null): string {
  const fromArg = explicit?.trim()
  if (fromArg) {
    return toRuntimeApiBase(migrateApiBaseUrl(fromArg, getBuiltInApiBase()))
  }
  return getBuiltInApiBase()
}

function isLocalDevUpload(apiBase?: string | null): boolean {
  const base = (apiBase ?? resolveApiBase()).trim()
  if (!base) return false
  if (base === DEV_PROXY_API_BASE) return true
  return LOCAL_API_PATTERNS.some((re) => re.test(normalizeApiBase(base)))
}

export function resolveVerifyUploadOrigin(apiBase?: string): string {
  if (readViteEnv().DEV) {
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    return readViteEnv().VITE_DEV_PROXY_TARGET?.replace(/\/+$/, '') || 'http://127.0.0.1:28080'
  }

  const base = apiBase ?? resolveApiBase()
  const trimmed = base.trim().replace(/\/+$/, '')

  if (isLocalDevUpload(apiBase)) {
    if (trimmed === DEV_PROXY_API_BASE && typeof window !== 'undefined') {
      return window.location.origin
    }
    return readViteEnv().VITE_DEV_PROXY_TARGET?.replace(/\/+$/, '') || 'http://127.0.0.1:28080'
  }

  return resolveUploadOrigin(apiBase)
}

export function resolveUploadOrigin(apiBase?: string): string {
  const fromEnv = readViteEnv().VITE_UPLOAD_ORIGIN?.trim()
  if (fromEnv && !isStaleCompanyApiBase(fromEnv)) {
    return fromEnv.replace(/\/+$/, '')
  }

  const base = apiBase ?? resolveApiBase()
  const trimmed = base.trim().replace(/\/+$/, '')
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/api$/i, '')
  }
  if (trimmed === DEV_PROXY_API_BASE) {
    return readViteEnv().VITE_DEV_PROXY_TARGET?.replace(/\/+$/, '') || 'http://127.0.0.1:28080'
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'http://localhost:28080'
}

export function syncApiBaseToStorage(url: string): void {
  try {
    localStorage.setItem(API_BASE_LS_KEY, normalizeApiBase(url))
  } catch {
    /* ignore */
  }
}

/** 供迁移/测试：判断是否仍为公司陈旧地址 */
export function isCompanyStaleApiBase(url: string | undefined | null): boolean {
  if (!url?.trim()) return false
  return isStaleCompanyApiBase(normalizeApiBase(url))
}
