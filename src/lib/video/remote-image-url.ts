/**
 * 视频 API 参考图：仅接受后端返回的 http(s) / data URL，不传本地相对路径
 */
export function pickRemoteImageUrlForVideoApi(raw?: string | null): string {
  const url = raw?.trim() || ''
  if (!url) return ''
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url
  return ''
}
