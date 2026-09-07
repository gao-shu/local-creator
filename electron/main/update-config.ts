/**
 * 桌面端自动更新 feed 配置（generic provider）
 * 下载与更新共用同一目录，地址从 .env 注入
 */

function trimSlashes(value: string): string {
  return String(value || '').replace(/^\/+|\/+$/g, '')
}

function readEnv(key: string): string {
  // 必须用字面量访问，electron-vite define 才能注入打包后的值（process.env[key] 无效）
  if (key === 'VITE_UPDATE_PUBLISH_URL') {
    return trimSlashes(process.env.VITE_UPDATE_PUBLISH_URL || '')
  }
  if (key === 'HAODE_UPDATE_PUBLISH_URL') {
    return trimSlashes(process.env.HAODE_UPDATE_PUBLISH_URL || '')
  }
  if (key === 'VITE_UPDATE_ORIGIN') {
    return trimSlashes(process.env.VITE_UPDATE_ORIGIN || '')
  }
  if (key === 'VITE_UPLOAD_ORIGIN') {
    return trimSlashes(process.env.VITE_UPLOAD_ORIGIN || '')
  }
  return trimSlashes(process.env[key] || '')
}

/** 安装包下载目录（与自动更新 feed 相同） */
export function resolveDesktopDownloadBase(): string {
  return resolveUpdatePublishUrl()
}

export function resolveUpdatePublishUrl(): string {
  const explicit = readEnv('VITE_UPDATE_PUBLISH_URL') || readEnv('HAODE_UPDATE_PUBLISH_URL')
  if (explicit) return explicit
  const updateOrigin = readEnv('VITE_UPDATE_ORIGIN')
  if (updateOrigin) return `${updateOrigin}/haode-client/download`
  const origin = readEnv('VITE_UPLOAD_ORIGIN')
  if (origin) return `${origin}/haode-client/download`
  return ''
}

/** Windows 安装包公网下载地址（与 electron-builder nsis artifactName 一致） */
export function resolveWindowsInstallerUrl(): string {
  const base = resolveUpdatePublishUrl()
  if (!base) return ''
  const version = process.env.npm_package_version || ''
  const productName = '好的漫创'
  if (!version) return `${base}/${productName} Setup.exe`
  return `${base}/${productName} Setup ${version}.exe`
}
