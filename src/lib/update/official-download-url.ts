/** 侧边栏「官网」占位（P4/P6 再换成自有站点） */
export const DEFAULT_OFFICIAL_WEBSITE_URL = 'https://example.com/'

/** @deprecated 使用 DEFAULT_OFFICIAL_WEBSITE_URL */
export const DEFAULT_OFFICIAL_DOWNLOAD_URL = DEFAULT_OFFICIAL_WEBSITE_URL

/** 侧边栏「官网」 */
export function resolveOfficialWebsiteUrl(): string {
  return DEFAULT_OFFICIAL_WEBSITE_URL
}

/** 更新/下载页：仅认环境变量，不再回落公司域名 */
export function resolveOfficialDownloadPageUrl(): string {
  const fromEnv = import.meta.env.VITE_UPDATE_PUBLISH_URL?.trim()
  if (fromEnv) {
    return fromEnv.replace(/\/?$/, '/')
  }
  return ''
}
