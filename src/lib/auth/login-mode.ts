// Copyright (c) 2025 local-creator. All rights reserved.

import type { AuthUser } from '@/types/auth'

/** 本地模式占位 Token */
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

/** 开源版强制本地模式，永不要求公司云登录 */
export function isLoginRequired(): boolean {
  return false
}

export function isWechatLoginEnabled(): boolean {
  return false
}

export function isSmsLoginEnabled(): boolean {
  return false
}

export function isAccountLoginEnabled(): boolean {
  return false
}

/** 公司后台上传已移除 */
export function canUseBackendFileUpload(): boolean {
  return false
}

/** 本地模式下始终视为可用会话 */
export function isRealUserSession(_token: string | null | undefined): boolean {
  return true
}

export function hasPersistedRealToken(token: string | null | undefined): boolean {
  return Boolean(token && !isOfflineLocalToken(token))
}

export function isOfflineLocalToken(token: string | null | undefined): boolean {
  return token === OFFLINE_LOCAL_TOKEN
}

export function isOptionalLoginIntent(_search: string): boolean {
  return false
}

export const OPTIONAL_LOGIN_PATH = '/login'
