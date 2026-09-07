/**
 * 客户端发版安装包 → 火山 TOS 配置解析
 */
import { readEnv } from './read-env.mjs'

export const DEFAULT_TOS_RELEASE_PREFIX = 'releases/client/download'

function trimSlashes(value) {
  return String(value || '').replace(/^\/+|\/+$/g, '')
}

export function isTosReleaseEnabled(readEnvFn = readEnv) {
  const mode = (readEnvFn('RELEASE_STORAGE') || '').trim().toLowerCase()
  if (mode === 'server') return false
  if (mode === 'tos') return true
  return Boolean(readEnvFn('TOS_BUCKET')?.trim())
}

export function readTosReleaseConfig(readEnvFn = readEnv) {
  const bucket = readEnvFn('TOS_BUCKET')?.trim()
  const accessKey = readEnvFn('TOS_ACCESS_KEY')?.trim()
  const secretKey = readEnvFn('TOS_SECRET_KEY')?.trim()
  const endpoint = (readEnvFn('TOS_ENDPOINT') || 'tos-cn-beijing.volces.com').trim()
  const region = (readEnvFn('TOS_REGION') || 'cn-beijing').trim()
  const prefix = trimSlashes(readEnvFn('TOS_RELEASE_PREFIX') || DEFAULT_TOS_RELEASE_PREFIX)
  const publicBase = (
    readEnvFn('TOS_PUBLIC_BASE_URL')?.trim() ||
    (bucket ? `https://${bucket}.${endpoint.replace(/^https?:\/\//, '')}` : '')
  ).replace(/\/+$/, '')

  return {
    bucket,
    accessKey,
    secretKey,
    endpoint: endpoint.replace(/^https?:\/\//, '').replace(/\/+$/, ''),
    region,
    prefix,
    publicBase,
    keepVersions: Math.max(
      1,
      Number.parseInt(readEnvFn('TOS_KEEP_INSTALLER_VERSIONS') || readEnvFn('DEPLOY_KEEP_INSTALLER_VERSIONS') || '5', 10) ||
        5,
    ),
  }
}

export function assertTosReleaseConfig(config) {
  const missing = []
  if (!config.bucket) missing.push('TOS_BUCKET')
  if (!config.accessKey) missing.push('TOS_ACCESS_KEY')
  if (!config.secretKey) missing.push('TOS_SECRET_KEY')
  if (!config.publicBase) missing.push('TOS_PUBLIC_BASE_URL 或 TOS_BUCKET+TOS_ENDPOINT')
  if (missing.length > 0) {
    throw new Error(`TOS 发版配置不完整，请在 .env.production 填写：${missing.join('、')}`)
  }
}

/** 自动更新 feed 与官网直链根目录（优先 TOS，否则 VITE_UPDATE_PUBLISH_URL） */
export function resolveUpdatePublishUrl(readEnvFn = readEnv) {
  if (isTosReleaseEnabled(readEnvFn)) {
    const { publicBase, prefix } = readTosReleaseConfig(readEnvFn)
    if (publicBase && prefix) {
      return `${publicBase}/${prefix}`
    }
  }
  return (readEnvFn('VITE_UPDATE_PUBLISH_URL') || '').trim().replace(/\/+$/, '')
}

export function tosObjectKey(prefix, fileName) {
  return `${trimSlashes(prefix)}/${fileName}`
}

export function tosPublicUrl(config, fileName) {
  return `${config.publicBase}/${tosObjectKey(config.prefix, fileName)}`
}
