/** 侧边栏「官网」固定落地页（勿用 env 覆盖） */
export const DEFAULT_OFFICIAL_WEBSITE_URL =
  'https://duanju.haodeweishi.cn/haode-client/download/'

/** @deprecated 使用 DEFAULT_OFFICIAL_WEBSITE_URL */
export const DEFAULT_OFFICIAL_DOWNLOAD_URL = DEFAULT_OFFICIAL_WEBSITE_URL

/** 侧边栏「官网」：固定打开 HTML 下载落地页 */
export function resolveOfficialWebsiteUrl(): string {
  return DEFAULT_OFFICIAL_WEBSITE_URL
}

/** 官网下载页（version.json 等；发布脚本可用 env，侧边栏官网不用此函数） */
export function resolveOfficialDownloadPageUrl(): string {
  const fromEnv = import.meta.env.VITE_UPDATE_PUBLISH_URL?.trim()
  if (fromEnv && !/\.volces\.com/i.test(fromEnv)) {
    return fromEnv.replace(/\/?$/, '/')
  }

  return DEFAULT_OFFICIAL_WEBSITE_URL
}
