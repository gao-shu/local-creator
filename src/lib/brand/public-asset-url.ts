/** 解析 public/ 静态资源 URL（Electron file:// 下 /foo.png 会变成 C:/foo.png，需相对 index.html） */
export function resolvePublicAssetUrl(assetPath: string): string {
  const trimmed = assetPath.trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed
  const relative = trimmed.replace(/^\/+/, '')
  if (typeof window !== 'undefined' && window.location?.href) {
    return new URL(relative, window.location.href).toString()
  }
  const base = import.meta.env.BASE_URL || './'
  return new URL(relative, base).toString()
}
