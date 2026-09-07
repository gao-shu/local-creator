// Copyright (c) 2025 好的AI. All rights reserved.

import type { AuthUser } from '@/types/auth'

/** 本地模式占位 Token（不要求登录时使用） */
export const OFFLINE_LOCAL_TOKEN = 'offline-local-token'

export const OFFLINE_LOCAL_USER: AuthUser = {
  id: 'local-offline',
  username: 'local',
  nickname: '本地用户',
  role: 'user',
  status: 'active',
  remaining_quota: 999999,
  free_quota: 999999,
  used_quota: 0,
  avatar_url: null,
}

function envFlag(name: string, defaultValue = false): boolean {
  const raw = import.meta.env?.[name]?.trim()?.toLowerCase()
  if (!raw) return defaultValue
  return raw === 'true' || raw === '1' || raw === 'yes'
}

/**
 * 是否要求登录（开启后须真实账号 Session，否则为本地离线模式）。
 * Electron E2E 运行时由 preload 注入 __HAODE_E2E__，强制走本地模式。
 */
export function isLoginRequired(): boolean {
  if (typeof window !== 'undefined' && window.__HAODE_E2E__) return false
  return envFlag('VITE_LOGIN_REQUIRED', false)
}

/** 一期默认仅账号密码；微信待服务号就绪后 VITE_AUTH_WECHAT_ENABLED=true */
export function isWechatLoginEnabled(): boolean {
  return envFlag('VITE_AUTH_WECHAT_ENABLED', false)
}

/** 短信登录；待火山 SMS 配置完成后 VITE_AUTH_SMS_ENABLED=true */
export function isSmsLoginEnabled(): boolean {
  return envFlag('VITE_AUTH_SMS_ENABLED', false)
}

/** 账号密码登录（一期默认开启） */
export function isAccountLoginEnabled(): boolean {
  return envFlag('VITE_AUTH_ACCOUNT_ENABLED', true)
}

/** 是否允许走 haode 后台 /client/files/upload（需开启登录；具体 Token 用 isRealUserSession 校验） */
export function canUseBackendFileUpload(): boolean {
  return isLoginRequired()
}

/** 登录模式下是否为真实用户 Session（非本地占位 Token） */
export function isRealUserSession(token: string | null | undefined): boolean {
  if (!isLoginRequired()) return true
  return Boolean(token && !isOfflineLocalToken(token))
}

/** 是否存在已持久化的真实 JWT（含本地模式下残留的微信/账号 Session） */
export function hasPersistedRealToken(token: string | null | undefined): boolean {
  return Boolean(token && !isOfflineLocalToken(token))
}

export function isOfflineLocalToken(token: string | null | undefined): boolean {
  return token === OFFLINE_LOCAL_TOKEN
}

/** 本地模式下用户主动进入登录页（侧栏「账号登录」） */
export function isOptionalLoginIntent(search: string): boolean {
  return new URLSearchParams(search).get('intent') === 'login'
}

export const OPTIONAL_LOGIN_PATH = '/login?intent=login'
