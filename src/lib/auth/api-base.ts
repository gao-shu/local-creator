/** Cloudflare 隧道直连 backend 时使用（无 /api 前缀） */
export const DEFAULT_TUNNEL_API_BASE = 'https://strengths-img-isolation-impressed.trycloudflare.com'

/** 上传文件公网 Origin（与 Cloudflare 隧道一致，供远端模型拉取 /uploads/） */
export const DEFAULT_TUNNEL_UPLOAD_ORIGIN = 'https://strengths-img-isolation-impressed.trycloudflare.com'

/** 本地 / 联调默认 API（8.141.97.65；无 VITE_API_BASE 时的开发兜底） */
export const DEFAULT_LOCAL_API_BASE = 'http://8.141.97.65/api'

/** Node smoke / tsx 脚本中 import.meta.env 可能未注入 */
function readViteEnv(): ImportMetaEnv {
  return (import.meta as ImportMeta & { env?: ImportMetaEnv }).env ?? ({} as ImportMetaEnv)
}

/** 构建时 .env.production 注入的 API 地址 */
export function getBuiltInApiBase(): string {
  const env = readViteEnv()
  const fromEnv = env.VITE_API_BASE?.trim()
  if (fromEnv) return normalizeApiBase(fromEnv)
  return env.DEV ? DEFAULT_LOCAL_API_BASE : DEFAULT_TUNNEL_API_BASE
}

/**
 * 历史：开发态 Vite 同源代理路径（`/api` → VITE_DEV_PROXY_TARGET）。
 * 现已改为直连 `VITE_API_BASE` / DEFAULT_LOCAL_API_BASE，保留常量仅兼容旧 settings。
 */
export const DEV_PROXY_API_BASE = '/api'

/** @deprecated 使用 resolveApiBase() */
export const DEFAULT_API_BASE = DEFAULT_LOCAL_API_BASE

export const API_BASE_LS_KEY = 'haode_api_base'

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

function isPrivateOrLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true
  if (/^192\.168\./.test(h)) return true
  if (/^10\./.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  return false
}

function isPrivateOrLocalApiBase(url: string): boolean {
  if (url === DEV_PROXY_API_BASE) return true
  try {
    const parsed = new URL(url.startsWith('http') ? url : `http://${url}`)
    return isPrivateOrLocalHostname(parsed.hostname)
  } catch {
    return false
  }
}

/** 生产包：历史 settings 里常见的无效/旧默认地址，应改用打包注入地址 */
const PACKAGED_STALE_API_PATTERNS = [
  ...LOCAL_API_PATTERNS,
]

export function normalizeApiBase(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '')
  if (!trimmed) return getBuiltInApiBase()
  // 相对路径（Vite 开发代理）原样保留
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

/** 旧版客户端默认花生壳地址（本地开发不可用，迁移到 Docker 地址） */
export const LEGACY_TUNNEL_API_BASE = DEFAULT_TUNNEL_API_BASE

function isLegacyTunnelApiBase(url: string): boolean {
  const normalized = normalizeApiBase(url)
  const legacyHttp = LEGACY_TUNNEL_API_BASE.replace(/^https:/, 'http:')
  const normalizedHttp = normalized.replace(/^https:/, 'http:')
  return normalized === LEGACY_TUNNEL_API_BASE || normalizedHttp === legacyHttp
}

/** 开发态不应再指向的历史联调 / 域名 */
const DEV_STALE_API_HOST_PATTERNS = [
  /^https?:\/\/learncom\.cn(?:\/api)?\/?$/i,
  /^https?:\/\/www\.learncom\.cn(?:\/api)?\/?$/i,
  /^https?:\/\/duanju\.[a-z0-9-]+\.cn(?:\/api)?\/?$/i,
]

function isDevStaleApiBase(url: string): boolean {
  return DEV_STALE_API_HOST_PATTERNS.some((re) => re.test(normalizeApiBase(url)))
}

export function migrateApiBaseUrl(url: string | undefined, fallback = getBuiltInApiBase()): string {
  const trimmed = url?.trim()
  if (!trimmed) return fallback
  const normalized = normalizeApiBase(trimmed)

  // 开发态：旧隧道、Vite `/api` 代理、本机 15173、learncom/生产域名 → 直连 8.141.97.65
  if (readViteEnv().DEV) {
    if (isLegacyTunnelApiBase(normalized)) return fallback
    if (isDevStaleApiBase(normalized)) return fallback
    if (normalized === DEV_PROXY_API_BASE || normalized.startsWith('/')) return fallback
    if (LOCAL_API_PATTERNS.some((re) => re.test(normalized))) return fallback
    return normalized
  }

  // 生产包：内网/本机/旧隧道/开发代理 → 打包注入的公网地址
  if (isPackagedStaleApiBase(normalized) || isLegacyTunnelApiBase(normalized)) {
    return fallback
  }

  return normalized
}

/** 生产包是否允许用户在设置页修改 API 地址（仅开发态或开启调试时） */
export function canEditApiBaseUrl(debugEnabled = false): boolean {
  return readViteEnv().DEV || debugEnabled
}

function isPackagedStaleApiBase(url: string): boolean {
  if (url === DEV_PROXY_API_BASE) return true
  if (isPrivateOrLocalApiBase(url)) return true
  return PACKAGED_STALE_API_PATTERNS.some((re) => re.test(url))
}

/** 开发态亦直连绝对 API 地址（不再改写为 `/api` 同源代理） */
export function toRuntimeApiBase(resolved: string): string {
  if (resolved === DEV_PROXY_API_BASE || resolved.startsWith('/')) {
    return getBuiltInApiBase()
  }
  return resolved
}

/** 优先级：生产包打包地址 > settings（非陈旧值）> 开发态 VITE_API_BASE / 联调默认 */
export function resolveApiBase(explicit?: string | null): string {
  const packaged = getBuiltInApiBase()
  if (!readViteEnv().DEV) {
    const fromArg = explicit?.trim()
    if (!fromArg) return packaged
    const normalized = normalizeApiBase(fromArg)
    if (isPackagedStaleApiBase(normalized)) return packaged
    return normalized
  }

  const fromArg = explicit?.trim()
  if (fromArg) {
    return toRuntimeApiBase(migrateApiBaseUrl(fromArg, packaged))
  }
  return packaged
}

function isLocalDevUpload(apiBase?: string | null): boolean {
  const base = (apiBase ?? resolveApiBase()).trim()
  if (base === DEV_PROXY_API_BASE) return true
  return LOCAL_API_PATTERNS.some((re) => re.test(normalizeApiBase(base)))
}

/** 上传后本地校验用 Origin（开发态走本机，避免花生壳未映射时校验失败） */
export function resolveVerifyUploadOrigin(apiBase?: string): string {
  // 开发态：文件实际落在本地 backend /uploads，校验必须走 Vite /uploads 代理，不能走 VITE_UPLOAD_ORIGIN 隧道
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

/** uploads 等静态资源的公网 Origin（返回给远端 API 的完整 URL 前缀） */
export function resolveUploadOrigin(apiBase?: string): string {
  const fromEnv = readViteEnv().VITE_UPLOAD_ORIGIN?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, '')

  const tunnelOrigin = DEFAULT_TUNNEL_UPLOAD_ORIGIN.trim()
  if (tunnelOrigin && !readViteEnv().DEV) {
    return tunnelOrigin.replace(/\/+$/, '')
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
