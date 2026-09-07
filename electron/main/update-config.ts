/**
 * 桌面端自动更新 feed 配置（generic provider）
 * 未配置 VITE_UPDATE_PUBLISH_URL 时禁用自动更新（开源私有阶段默认）
 */

function trimSlashes(value: string): string {
  return String(value || '').replace(/^\/+|\/+$/g, '')
}

function readEnv(key: string): string {
  // 必须用字面量访问，electron-vite define 才能注入打包后的值（process.env[key] 无效）
  if (key === 'VITE_UPDATE_PUBLISH_URL') {
    return trimSlashes(process.env.VITE_UPDATE_PUBLISH_URL || '')
  }
  if (key === 'VITE_UPDATE_ORIGIN') {
    return trimSlashes(process.env.VITE_UPDATE_ORIGIN || '')
  }
  return trimSlashes(process.env[key] || '')
}

/** 安装包下载目录（与自动更新 feed 相同） */
export function resolveDesktopDownloadBase(): string {
  return resolveUpdatePublishUrl()
}

/** 仅认显式更新地址；不再回落公司 haode-client 路径 */
export function resolveUpdatePublishUrl(): string {
  const explicit = readEnv('VITE_UPDATE_PUBLISH_URL')
  if (explicit) return explicit
  const updateOrigin = readEnv('VITE_UPDATE_ORIGIN')
  if (updateOrigin) return `${updateOrigin}/download`
  return ''
}

/** Windows 安装包公网下载地址（与 electron-builder nsis artifactName 一致） */
export function resolveWindowsInstallerUrl(): string {
  const base = resolveUpdatePublishUrl()
  if (!base) return ''
  const version = process.env.npm_package_version || ''
  const productName = '本地漫创'
  if (!version) return `${base}/${productName} Setup.exe`
  return `${base}/${productName} Setup ${version}.exe`
}
