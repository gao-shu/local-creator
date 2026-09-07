// Copyright (c) 2025 好的AI. All rights reserved.

export type FeedbackType = 'general' | 'bug' | 'feature' | 'other'

export type FeedbackDiagnostics = {
  appVersion: string
  route: string
  userId: string | null
  projectId: string | null
  apiBase: string
  loginRequired: boolean
  platform: 'electron' | 'web'
  timestamp: string
  recentErrors: Array<{ at: string; message: string; code?: number }>
}

const MAX_RECENT_ERRORS = 8
const recentErrors: FeedbackDiagnostics['recentErrors'] = []

/** 供全局错误捕获写入，反馈提交时一并带上 */
export function recordFeedbackError(message: string, code?: number): void {
  const entry = { at: new Date().toISOString(), message: message.slice(0, 500), code }
  recentErrors.unshift(entry)
  if (recentErrors.length > MAX_RECENT_ERRORS) {
    recentErrors.length = MAX_RECENT_ERRORS
  }
}

declare const __APP_VERSION__: string

export function resolveAppVersion(): string {
  if (typeof __APP_VERSION__ === 'string' && __APP_VERSION__) {
    return __APP_VERSION__
  }
  return 'unknown'
}

export function buildFeedbackDiagnostics(input: {
  route: string
  userId: string | null
  projectId: string | null
  apiBase: string
  loginRequired: boolean
}): FeedbackDiagnostics {
  const isElectron =
    typeof window !== 'undefined' &&
    Boolean((window as Window & { electronAPI?: unknown }).electronAPI)

  return {
    appVersion: resolveAppVersion(),
    route: input.route,
    userId: input.userId,
    projectId: input.projectId,
    apiBase: input.apiBase,
    loginRequired: input.loginRequired,
    platform: isElectron ? 'electron' : 'web',
    timestamp: new Date().toISOString(),
    recentErrors: [...recentErrors],
  }
}
