// Copyright (c) haode-ai-client. All rights reserved.

/** 是否为火山 TOS / 对象存储公网 URL（非本站 /uploads/） */
export function isTosPublicUrl(url: string): boolean {
  const raw = String(url || '').trim().toLowerCase()
  if (!/^https?:\/\//i.test(raw)) return false
  if (raw.includes('/uploads/')) return false

  const cdn = import.meta.env.VITE_TOS_PUBLIC_ORIGIN?.trim().toLowerCase()
  if (cdn && raw.startsWith(cdn.replace(/\/+$/, ''))) return true

  return (
    /\.volces\.com/i.test(raw) ||
    /\.volcengineapi\.com/i.test(raw) ||
    /\.tos[-.]/.test(raw)
  )
}

/** 后台已上传、可复用的远程地址（本地 /uploads/ 或 TOS） */
export function isReusableRemoteUploadUrl(url: string): boolean {
  const raw = String(url || '').trim()
  if (!/^https?:\/\//i.test(raw)) return false
  if (isTosPublicUrl(raw)) return true
  return raw.includes('/uploads/')
}

/** 后台 /uploads/ 公网地址（含临时隧道域名，路径不变仅 Origin 可能过期） */
export function isBackendUploadPathUrl(url: string): boolean {
  const raw = String(url || '').trim()
  if (!/^https?:\/\//i.test(raw)) return false
  return raw.includes('/uploads/')
}

/** 内网穿透 / 临时隧道域名（连接不稳定，域名会轮换） */
export function isEphemeralTunnelUploadUrl(url: string): boolean {
  const raw = String(url || '').trim().toLowerCase()
  if (!/^https?:\/\//i.test(raw)) return false
  return (
    raw.includes('trycloudflare.com') ||
    raw.includes('ngrok-free.app') ||
    raw.includes('ngrok.io') ||
    raw.includes('loca.lt')
  )
}

/** 生图参考图是否可跳过重复上传（稳定公网 /uploads/ 或 TOS；临时隧道走 rewrite+verify） */
export function shouldReuseRemoteUploadUrl(url: string): boolean {
  if (!isReusableRemoteUploadUrl(url)) return false
  if (isEphemeralTunnelUploadUrl(url)) return false
  return true
}
