// Copyright (c) local-creator contributors. All rights reserved.

import { isLoginRequired } from '@/lib/auth/login-mode'

/** 与 AuthSessionListener 约定的全局会话失效事件 */
export const AUTH_SESSION_EXPIRED_EVENT = 'auth:session-expired'

const SESSION_INVALID_TEXT =
  /无效令牌|登录已过期|未登录|token\s*(is\s*)?(invalid|expired)|unauthorized|authentication\s*required/i

const NOTIFY_DEBOUNCE_MS = 2500
let lastNotifyAt = 0

/** HTTP / 文案是否表示登录 JWT 已失效（非业务 403、非模型 Key） */
export function isClientSessionInvalid(
  status: number,
  bodyTextOrMessage?: string | null,
  envelopeCode?: number | null,
): boolean {
  if (status === 401) return true
  if (envelopeCode === 401 || envelopeCode === 40101) return true
  const text = (bodyTextOrMessage || '').trim()
  if (!text) return false
  if (status === 403 && SESSION_INVALID_TEXT.test(text)) return true
  if (SESSION_INVALID_TEXT.test(text) && (status === 401 || status === 403 || status === 0)) {
    return true
  }
  return false
}

/** 触发一次会话过期处理（监听器内防抖 + 本处防抖，避免整页多接口连环弹） */
export function notifyAuthSessionExpired(): void {
  if (typeof window === 'undefined') return
  if (!isLoginRequired()) return
  const now = Date.now()
  if (now - lastNotifyAt < NOTIFY_DEBOUNCE_MS) return
  lastNotifyAt = now
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT))
}

/**
 * 登录态接口失败时调用：若判定会话无效则派发过期事件。
 * @returns 是否已按会话失效处理
 */
export function noteClientSessionFailure(
  status: number,
  bodyTextOrMessage?: string | null,
  envelopeCode?: number | null,
): boolean {
  if (!isClientSessionInvalid(status, bodyTextOrMessage, envelopeCode)) return false
  notifyAuthSessionExpired()
  return true
}
