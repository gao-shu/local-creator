// Copyright (c) haode-ai-client. All rights reserved.

/**
 * OpenAI Videos / 中转站成片常返回相对路径 `/v1/videos/{id}/content`，
 * 需拼到 API 根域名并用 Bearer 下载。官方 Grok CDN（vidgen.x.ai）一般是完整 https，无需鉴权。
 */

import { normalizeApiBase, resolveApiV1Root } from '@/lib/models/model-endpoint'
import { useAuthStore } from '@/stores/auth-store'

/** 成片下载失败（生成已完成，仅落盘失败，可单独重试下载） */
export class VideoContentDownloadError extends Error {
  readonly remoteUrl: string

  constructor(message: string, remoteUrl: string) {
    super(message)
    this.name = 'VideoContentDownloadError'
    this.remoteUrl = String(remoteUrl || '').trim()
  }
}

export function isVideoContentDownloadError(error: unknown): error is VideoContentDownloadError {
  return error instanceof VideoContentDownloadError
}

/** 将主进程/浏览器超时英文统一成可读中文 */
export function formatVideoContentDownloadErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '视频保存失败'
  const text = String(raw || '').trim() || '视频保存失败'
  if (
    /aborted due to timeout/i.test(text)
    || /TimeoutError/i.test(text)
    || (/timeout/i.test(text) && /abort/i.test(text))
  ) {
    return '成片下载超时（已等约 5 分钟），请点击「重新下载」重试'
  }
  return text
}

export function isHttpVideoUrl(value: string): boolean {
  return /^https?:\/\//i.test(String(value || '').trim())
}

/** 成片下载前校验：必须是可解析的绝对 http(s) URL（拒绝相对 /content 等） */
export function assertDownloadableVideoUrl(rawUrl: string): string {
  const url = String(rawUrl || '').trim()
  if (!url) throw new Error('缺少视频下载地址')
  if (!isHttpVideoUrl(url)) {
    throw new Error(
      `无效的下载 URL（需要绝对 http(s) 地址，当前为：${url.slice(0, 120)}）`,
    )
  }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('仅支持 http/https 下载地址')
    }
    return parsed.toString()
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('下载')) throw error
    throw new Error('无效的下载 URL')
  }
}

/** OpenAI Videos / 兼容中转：GET …/videos/{id}/content */
export function isApiVideoContentUrl(url: string): boolean {
  const raw = String(url || '').trim()
  if (!raw) return false
  try {
    const path = isHttpVideoUrl(raw) ? new URL(raw).pathname : raw
    return /\/videos\/[^/]+\/content\/?$/i.test(path)
  } catch {
    return /\/videos\/[^/]+\/content\/?$/i.test(raw)
  }
}

export function looksLikeOpenAiStyleVideoId(id: string): boolean {
  return /^video_[A-Za-z0-9_-]+$/i.test(String(id || '').trim())
}

/**
 * 将相对路径拼成绝对下载地址。
 * - 已是 http(s) / data / blob：原样返回
 * - `/v1/...`：挂到 origin
 * - `/videos/.../content`：挂到 API 的 `/v1` 根（即使 base 是 …/videos/generations）
 */
export function resolveAbsoluteApiMediaUrl(baseUrl: string, maybeUrl: string): string {
  const u = String(maybeUrl || '').trim()
  if (!u) return ''
  if (isHttpVideoUrl(u) || u.startsWith('data:') || u.startsWith('blob:')) return u

  const base = normalizeApiBase(baseUrl)
  if (!base) return u

  try {
    const baseHref = base.includes('://') ? base : `https://${base}`
    if (!u.startsWith('/')) {
      const parsed = new URL(baseHref)
      const href = parsed.href.endsWith('/') ? parsed.href : `${parsed.href}/`
      return new URL(u, href).href
    }

    // 已含 /v1 前缀：只拼 origin，避免重复 /v1
    if (u === '/v1' || u.startsWith('/v1/')) {
      return `${new URL(baseHref).origin}${u}`
    }

    // /videos/{id}/content 等 → 拼到 …/v1（createUrl 含 /videos/generations 时也能取对）
    const v1Root = resolveApiV1Root(baseHref, true)
    const rootUrl = new URL(v1Root.includes('://') ? v1Root : `https://${v1Root}`)
    const rootPath = rootUrl.pathname.replace(/\/+$/, '')
    if (rootPath && (u === rootPath || u.startsWith(`${rootPath}/`))) {
      return `${rootUrl.origin}${u}`
    }
    return `${rootUrl.origin}${rootPath}${u}`
  } catch {
    return u
  }
}

/** 依次用多个 base 尝试把相对成片路径拼成绝对 http(s) URL */
export function resolveAbsoluteApiMediaUrlFromBases(
  maybeUrl: string,
  bases: Array<string | undefined | null>,
): string {
  const u = String(maybeUrl || '').trim()
  if (!u) return ''
  if (isHttpVideoUrl(u) || u.startsWith('data:') || u.startsWith('blob:')) return u
  for (const base of bases) {
    const trimmed = String(base || '').trim()
    if (!trimmed) continue
    const absolute = resolveAbsoluteApiMediaUrl(trimmed, u)
    if (absolute.startsWith('http')) return absolute
  }
  return ''
}

/** 无 url 时按任务 id 合成中转 content 路径 */
export function buildApiVideoContentPath(videoId: string): string {
  const id = String(videoId || '').trim()
  if (!id) return ''
  return `/v1/videos/${encodeURIComponent(id)}/content`
}

/** 从 `/v1/videos/{id}/content`（相对或绝对）解析 video id；done 响应常无顶层 id */
export function extractVideoIdFromApiContentUrl(url: string): string {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    const path = isHttpVideoUrl(raw) ? new URL(raw).pathname : raw
    const match = path.match(/\/videos\/([^/]+)\/content\/?$/i)
    return match?.[1] ? decodeURIComponent(match[1]) : ''
  } catch {
    return ''
  }
}

/** 成片下载是否需要带 API Key：
 * - URL 为 `/videos/{id}/content`，或
 * - 任务 id 为 OpenAI 风格 `video_*` / 中转 `task_*`（即使 URL 形态略有差异）
 * 注意：admin `/client/system-models/video/jobs/.../content` 用登录态，不算上游 Key。
 */
export function needsAuthenticatedVideoDownload(url: string, videoId?: string): boolean {
  if (/\/client\/system-models\/video\/jobs\/[^/]+\/content\/?$/i.test(url)) return false
  if (isApiVideoContentUrl(url)) return true
  const id = String(videoId || '').trim()
  if (id && looksLikeOpenAiStyleVideoId(id)) return true
  if (id && /^task_[A-Za-z0-9_-]+$/i.test(id)) return true
  return false
}

function isPrivateHttpHostname(hostname: string): boolean {
  const host = String(hostname || '').trim().toLowerCase()
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  )
}

/**
 * 仅当成片 URL 与已配置视频 API 同源且为内网时，才允许主进程放开 SSRF 限制。
 */
export function shouldAllowPrivateVideoContentFetch(
  contentUrl: string,
  apiBaseUrl?: string | null,
): boolean {
  const raw = String(contentUrl || '').trim()
  const apiBase = String(apiBaseUrl || '').trim()
  if (!raw || !apiBase || !isHttpVideoUrl(raw)) return false
  try {
    const content = new URL(raw)
    if (!isPrivateHttpHostname(content.hostname)) return false
    const baseHref = apiBase.includes('://') ? apiBase : `https://${apiBase}`
    return content.origin === new URL(baseHref).origin
  } catch {
    return false
  }
}

/**
 * OpenAI 兼容网关：响应里的 …/videos/{id}/content 若指向其它域名（上游），
 * 改写为配置 API 的 `{base}/v1/videos/{jobId}/content`，用本侧 Key 下载。
 * CDN 直链（非 /content）原样返回。
 */
export function resolveApiOriginVideoContentUrl(options: {
  contentUrl: string
  apiBaseUrl?: string | null
  preferredVideoId?: string | null
}): string {
  const raw = String(options.contentUrl || '').trim()
  const apiBase = String(options.apiBaseUrl || '').trim()
  if (!raw || !apiBase) return raw
  if (!isApiVideoContentUrl(raw)) return raw

  const preferred = String(options.preferredVideoId || '').trim()
  const fromUrl = extractVideoIdFromApiContentUrl(raw)
  const videoId = preferred || fromUrl
  if (!videoId) {
    return raw.startsWith('/') ? resolveAbsoluteApiMediaUrl(apiBase, raw) : raw
  }

  const target = resolveAbsoluteApiMediaUrl(apiBase, buildApiVideoContentPath(videoId))
  if (!target.startsWith('http')) return raw

  try {
    const baseHref = apiBase.includes('://') ? apiBase : `https://${apiBase}`
    const apiOrigin = new URL(baseHref).origin
    if (!isHttpVideoUrl(raw)) return target
    const contentOrigin = new URL(raw).origin
    // 同源且 id 一致：保留；否则一律走配置 API + 本侧 jobId
    if (contentOrigin === apiOrigin && (!preferred || !fromUrl || preferred === fromUrl)) {
      return raw
    }
    return target
  } catch {
    return target
  }
}

export function buildBearerDownloadHeaders(apiKey?: string): Record<string, string> | undefined {
  const key = String(apiKey || '').trim()
  if (!key) return undefined
  return { Authorization: `Bearer ${key}` }
}

/** 成片 /content 下载：需要时带本侧 API Key；admin 代下地址带登录 JWT */
export function resolveVideoDownloadHeaders(options: {
  url: string
  apiKey?: string
  videoId?: string
}): Record<string, string> | undefined {
  if (/\/client\/system-models\/video\/jobs\/[^/]+\/content\/?$/i.test(options.url)) {
    const token = String(useAuthStore.getState().token || '').trim()
    if (token) return { Authorization: `Bearer ${token}` }
    return undefined
  }
  if (!needsAuthenticatedVideoDownload(options.url, options.videoId)) return undefined
  return buildBearerDownloadHeaders(options.apiKey)
}
