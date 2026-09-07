import { DEFAULT_LOCAL_API_BASE, DEFAULT_TUNNEL_API_BASE, normalizeApiBase, resolveApiBase } from '@/lib/auth/api-base'
import { noteClientSessionFailure } from '@/lib/auth/session-expired'
import type { ApiEnvelope, AuthUser } from '@/types/auth'

const FETCH_TIMEOUT_MS = 15000

type ClientProfile = {
  id: string
  username: string | null
  nickname: string | null
  avatar_url: string | null
  phone: string | null
  bells: number
  invite_code: string | null
  invited_count?: number
  wechat_bound?: boolean
  has_password?: boolean
  is_internal?: boolean
  status: string
}

type AuthTokenData = {
  access_token: string
  token_type: string
  user: ClientProfile
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => {
    controller.abort(
      new DOMException(`Request timed out after ${FETCH_TIMEOUT_MS}ms`, 'AbortError'),
    )
  }, FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    // Chromium 对无 reason 的 abort 会抛 DOMException；统一成 AbortError 便于上层识别
    if (controller.signal.aborted) {
      const timeoutErr = new Error(`连接后端超时（${FETCH_TIMEOUT_MS / 1000}s）`)
      timeoutErr.name = 'AbortError'
      throw timeoutErr
    }
    throw err
  } finally {
    window.clearTimeout(timer)
  }
}

function buildUrl(path: string, apiBase?: string): string {
  const base = resolveApiBase(apiBase)
  return base.startsWith('/')
    ? `${base}${path}`
    : `${base.replace(/\/+$/, '')}${path}`
}

async function apiPostAuth<T>(
  path: string,
  body: unknown,
  token: string,
  apiBase?: string,
): Promise<ApiEnvelope<T>> {
  const base = resolveApiBase(apiBase)
  const url = buildUrl(path, base)
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    noteClientSessionFailure(res.status, text)
    throw new Error(`后端错误 ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }
  return res.json() as Promise<ApiEnvelope<T>>
}

async function apiPost<T>(path: string, body?: unknown, apiBase?: string): Promise<ApiEnvelope<T>> {
  const res = await fetchWithTimeout(buildUrl(path, apiBase), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`后端错误 ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }
  return res.json() as Promise<ApiEnvelope<T>>
}

async function apiGet<T>(path: string, apiBase?: string): Promise<ApiEnvelope<T>> {
  const res = await fetchWithTimeout(buildUrl(path, apiBase))
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`后端错误 ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }
  return res.json() as Promise<ApiEnvelope<T>>
}

export function mapClientProfile(profile: ClientProfile): AuthUser {
  return {
    id: profile.id,
    username: profile.username || String(profile.id),
    nickname: profile.nickname || profile.username || '用户',
    role: 'user',
    status: profile.status || 'active',
    remaining_quota: profile.bells ?? 0,
    free_quota: profile.bells ?? 0,
    used_quota: 0,
    avatar_url: profile.avatar_url || null,
    bells: profile.bells ?? 0,
    invite_code: profile.invite_code || null,
    invited_count: profile.invited_count ?? 0,
    wechat_bound: profile.wechat_bound ?? false,
    phone: profile.phone || null,
    has_password: profile.has_password ?? false,
    is_internal: profile.is_internal ?? false,
  }
}

export async function fetchClientProfile(
  token: string,
  apiBase?: string,
  options?: { reportSessionExpired?: boolean },
): Promise<AuthUser | null> {
  const reportSessionExpired = options?.reportSessionExpired !== false
  const base = resolveApiBase(apiBase)
  const url = buildUrl('/client/auth/me', base)
  const res = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (reportSessionExpired) noteClientSessionFailure(res.status, text)
    return null
  }
  const body = (await res.json()) as ApiEnvelope<ClientProfile>
  if (body.code !== 0 || !body.data) {
    if (reportSessionExpired) noteClientSessionFailure(res.status, body.message, body.code)
    return null
  }
  return mapClientProfile(body.data)
}

export type BellLedgerItem = {
  id: string
  delta: number
  balance_after: number
  reason: string
  remark: string | null
  created_at: string
}

/** GET /client/auth/bells/ledger — 当前用户好豆流水 */
export async function fetchBellLedger(
  token: string,
  apiBase?: string,
  page = 1,
  pageSize = 20,
): Promise<{ list: BellLedgerItem[]; total: number }> {
  const base = resolveApiBase(apiBase)
  const url = buildUrl(
    `/client/auth/bells/ledger?page=${page}&page_size=${pageSize}`,
    base,
  )
  const res = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    noteClientSessionFailure(res.status, text)
    throw new Error('获取好豆记录失败')
  }
  const body = (await res.json()) as ApiEnvelope<{ list: BellLedgerItem[]; total: number }>
  if (body.code !== 0 || !body.data) {
    noteClientSessionFailure(res.status, body.message, body.code)
    throw new Error(body.message || '获取好豆记录失败')
  }
  return body.data
}

export async function registerAccount(
  username: string,
  password: string,
  inviteCode?: string,
  apiBase?: string,
): Promise<{ accessToken: string; user: AuthUser }> {
  const body = await apiPost<AuthTokenData>('/client/auth/register', {
    username,
    password,
    invite_code: inviteCode || undefined,
  }, apiBase)
  if (body.code !== 0 || !body.data) {
    throw new Error(body.message || '注册失败')
  }
  return {
    accessToken: body.data.access_token,
    user: mapClientProfile(body.data.user),
  }
}

export async function loginAccount(
  username: string,
  password: string,
  apiBase?: string,
): Promise<{ accessToken: string; user: AuthUser }> {
  const body = await apiPost<AuthTokenData>('/client/auth/login', {
    username,
    password,
  }, apiBase)
  if (body.code !== 0 || !body.data) {
    throw new Error(body.message || '登录失败')
  }
  return {
    accessToken: body.data.access_token,
    user: mapClientProfile(body.data.user),
  }
}

export async function checkUsernameAvailable(username: string, apiBase?: string): Promise<boolean> {
  const body = await apiGet<{ available: boolean }>(
    `/client/auth/check-username?username=${encodeURIComponent(username)}`,
    apiBase,
  )
  if (body.code !== 0 || !body.data) return false
  return body.data.available
}

export async function checkPhoneAvailable(phone: string, apiBase?: string): Promise<boolean> {
  const body = await apiGet<{ available: boolean }>(
    `/client/auth/check-phone?phone=${encodeURIComponent(phone)}`,
    apiBase,
  )
  if (body.code !== 0 || !body.data) return false
  return body.data.available
}

export async function sendSmsCode(
  phone: string,
  apiBase?: string,
  scene: 'login' | 'bind' = 'login',
): Promise<number> {
  const body = await apiPost<{ expire_seconds: number }>('/client/auth/sms/send', {
    phone,
    scene,
  }, apiBase)
  if (body.code !== 0 || !body.data) {
    throw new Error(body.message || '发送验证码失败')
  }
  return body.data.expire_seconds
}

export async function loginWithSms(
  phone: string,
  code: string,
  inviteCode?: string,
  apiBase?: string,
): Promise<{ accessToken: string; user: AuthUser }> {
  const body = await apiPost<AuthTokenData>('/client/auth/sms/login', {
    phone,
    code,
    invite_code: inviteCode || undefined,
  }, apiBase)
  if (body.code !== 0 || !body.data) {
    throw new Error(body.message || '登录失败')
  }
  return {
    accessToken: body.data.access_token,
    user: mapClientProfile(body.data.user),
  }
}

export async function setAccountPassword(
  token: string,
  newPassword: string,
  oldPassword?: string,
  apiBase?: string,
): Promise<AuthUser> {
  const body = await apiPostAuth<ClientProfile>(
    '/client/auth/set-password',
    { new_password: newPassword, old_password: oldPassword || undefined },
    token,
    apiBase,
  )
  if (body.code !== 0 || !body.data) throw new Error(body.message || '设置密码失败')
  return mapClientProfile(body.data)
}

export async function setAccountUsername(
  token: string,
  username: string,
  apiBase?: string,
): Promise<AuthUser> {
  const body = await apiPostAuth<ClientProfile>(
    '/client/auth/set-username',
    { username },
    token,
    apiBase,
  )
  if (body.code !== 0 || !body.data) throw new Error(body.message || '设置用户名失败')
  return mapClientProfile(body.data)
}

export async function setAccountNickname(
  token: string,
  nickname: string,
  apiBase?: string,
): Promise<AuthUser> {
  const body = await apiPostAuth<ClientProfile>(
    '/client/auth/set-nickname',
    { nickname },
    token,
    apiBase,
  )
  if (body.code !== 0 || !body.data) throw new Error(body.message || '修改昵称失败')
  return mapClientProfile(body.data)
}

export async function uploadAccountAvatar(
  token: string,
  file: File,
  apiBase?: string,
): Promise<AuthUser> {
  const base = resolveApiBase(apiBase)
  const url = buildUrl('/client/auth/set-avatar', base)
  const form = new FormData()
  form.append('file', file)

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    noteClientSessionFailure(res.status, text)
    throw new Error(`头像上传失败 ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }
  const body = (await res.json()) as ApiEnvelope<ClientProfile>
  if (body.code !== 0 || !body.data) {
    noteClientSessionFailure(res.status, body.message, body.code)
    throw new Error(body.message || '头像上传失败')
  }
  return mapClientProfile(body.data)
}

export async function bindAccountPhone(
  token: string,
  phone: string,
  code: string,
  apiBase?: string,
): Promise<AuthUser> {
  const body = await apiPostAuth<ClientProfile>(
    '/client/auth/bind-phone',
    { phone, code },
    token,
    apiBase,
  )
  if (body.code !== 0 || !body.data) throw new Error(body.message || '绑定手机失败')
  return mapClientProfile(body.data)
}

export function formatAuthFetchError(err: unknown, apiBase?: string): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') {
      return `连接后端超时（${FETCH_TIMEOUT_MS / 1000}s），请确认后端已启动：${apiBase ?? ''}`
    }
    if (err.message === 'Failed to fetch') {
      return [
        '无法连接后端（Failed to fetch）',
        '请检查：',
        `1. 系统设置 → 后端 API 地址（当前：${apiBase ?? '未配置'}）`,
        '2. 本地 Docker 用 http://localhost:28000',
        '3. 直连 uvicorn 用 http://127.0.0.1:8000',
        '4. 花生壳隧道用 http://xxx.zicp.vip（无 /api 前缀）',
      ].join('\n')
    }
    return err.message
  }
  return '认证请求失败'
}

export { DEFAULT_LOCAL_API_BASE, DEFAULT_TUNNEL_API_BASE, normalizeApiBase }
