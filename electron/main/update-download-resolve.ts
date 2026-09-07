export type PendingUpdateFile = {
  url: string
  sha512: string
  fileName: string
}

function extractFileNameFromUrl(rawUrl: string): string {
  try {
    return decodeURIComponent(new URL(rawUrl).pathname.split('/').pop() || '')
  } catch {
    return ''
  }
}

function isServerMirrorFeed(feedBaseUrl: string): boolean {
  return /115\.191\.9\.56/i.test(feedBaseUrl)
}

/** 解析 latest.yml 中的安装包 URL；相对路径拼 feed 根目录；业务服务器 feed 优先走同源镜像 */
export function resolveUpdateFileUrl(rawUrl: string, feedBaseUrl: string): string {
  const trimmed = String(rawUrl || '').trim()
  if (!trimmed) return ''

  if (/^https?:\/\//i.test(trimmed)) {
    // 旧版 feed 在业务服务器、yml 仍写 TOS 绝对地址时，改走服务器镜像（单连接也能 5MB/s+）
    if (isServerMirrorFeed(feedBaseUrl) && /volces\.com/i.test(trimmed)) {
      const fileName = extractFileNameFromUrl(trimmed)
      if (fileName) return resolveUpdateFileUrl(fileName, feedBaseUrl)
    }
    return trimmed
  }

  const base = feedBaseUrl.replace(/\/+$/, '')
  const relative = trimmed.replace(/^\/+/, '')
  const encoded = relative.includes('/')
    ? relative.split('/').map((part) => encodeURIComponent(part)).join('/')
    : encodeURIComponent(relative)
  return `${base}/${encoded}`
}

export function pickPendingUpdateFile(
  updateInfo: {
    version?: string
    sha512?: string
    path?: string
    files?: Array<{ url?: string; sha512?: string }>
  },
  feedBaseUrl: string,
): PendingUpdateFile | null {
  const primary = updateInfo.files?.[0]
  const rawUrl = String(primary?.url || updateInfo.path || '').trim()
  const sha512 = String(primary?.sha512 || updateInfo.sha512 || '').trim()
  if (!rawUrl || !sha512) return null

  const url = resolveUpdateFileUrl(rawUrl, feedBaseUrl)
  let fileName = '好的漫创 Setup.exe'
  const fromUrl = extractFileNameFromUrl(url)
  if (fromUrl) fileName = fromUrl

  return { url, sha512, fileName }
}
