/**
 * HTTP 下载信任：内网/回环 SSRF 防护与本机视频 API 放行。
 * localhost / 127.0.0.1 / ::1 视为同一回环主机（同协议+端口即可）。
 */

export function isPrivateHttpHostname(hostname: string): boolean {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
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

function normalizeLoopbackHostname(hostname: string): string {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return '127.0.0.1'
  }
  return host
}

function urlPortKey(u: URL): string {
  if (u.port) return u.port
  return u.protocol === 'https:' ? '443' : '80'
}

/** 同源，或同协议+同端口的回环地址（localhost ≡ 127.0.0.1 ≡ ::1） */
export function httpOriginsMatchAllowingLoopback(urlA: string, urlB: string): boolean {
  try {
    const aHref = String(urlA || '').trim()
    const bHref = String(urlB || '').trim()
    if (!aHref || !bHref) return false
    const a = new URL(aHref.includes('://') ? aHref : `https://${aHref}`)
    const b = new URL(bHref.includes('://') ? bHref : `https://${bHref}`)
    if (a.origin === b.origin) return true
    if (a.protocol !== b.protocol) return false
    if (urlPortKey(a) !== urlPortKey(b)) return false
    const ha = normalizeLoopbackHostname(a.hostname)
    const hb = normalizeLoopbackHostname(b.hostname)
    return ha === '127.0.0.1' && hb === '127.0.0.1'
  } catch {
    return false
  }
}

export function collectTrustedHttpBasesFromSettings(settings: {
  apiBaseUrl?: string | null
  llmModels?: Array<{ endpoint?: string; baseUrl?: string }>
  imageModels?: Array<{ endpoint?: string; baseUrl?: string }>
  videoModels?: Array<{ endpoint?: string; baseUrl?: string }>
}): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw?: string | null) => {
    const v = String(raw || '').trim()
    if (!v || seen.has(v)) return
    seen.add(v)
    out.push(v)
  }
  push(settings.apiBaseUrl)
  for (const list of [settings.llmModels, settings.imageModels, settings.videoModels]) {
    for (const m of list || []) {
      push(m.endpoint)
      push(m.baseUrl)
    }
  }
  return out
}

/** 若 url 为内网且与任一信任基址同源（含回环等价），返回该基址；否则 null */
export function findTrustedBaseForPrivateUrl(
  rawUrl: string,
  trustedBases: string[],
): string | null {
  const url = String(rawUrl || '').trim()
  if (!url || trustedBases.length === 0) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (!isPrivateHttpHostname(parsed.hostname)) return null
    for (const base of trustedBases) {
      if (httpOriginsMatchAllowingLoopback(url, base)) return base
    }
    return null
  } catch {
    return null
  }
}
