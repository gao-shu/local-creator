import { DEFAULT_LOCAL_API_BASE, DEFAULT_TUNNEL_API_BASE, normalizeApiBase, resolveApiBase } from '@/lib/auth/api-base'
import { mapClientProfile } from '@/lib/auth/auth-service'
import { noteClientSessionFailure } from '@/lib/auth/session-expired'
import type { ApiEnvelope, AuthUser, WechatPollResult, WechatQrcodeSession } from '@/types/auth'

const FETCH_TIMEOUT_MS = 15000

type WechatSessionData = {
  state: string
  auth_url: string
  expires_at: string
}

type WechatPollData = {
  status: string
  message?: string
  access_token?: string
  token_type?: string
}

type ClientProfile = {
  id: string
  username: string | null
  nickname: string | null
  avatar_url: string | null
  phone: string | null
  bells: number
  invite_code: string | null
  status: string
}

function qrImageUrl(authUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(authUrl)}`
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

async function apiPost<T>(path: string, apiBase?: string): Promise<ApiEnvelope<T>> {
  const base = resolveApiBase(apiBase)
  const url = base.startsWith('/')
    ? `${base}${path}`
    : `${base.replace(/\/+$/, '')}${path}`
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`后端错误 ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }
  return res.json() as Promise<ApiEnvelope<T>>
}

async function apiGet<T>(path: string, token?: string, apiBase?: string): Promise<ApiEnvelope<T>> {
  const base = resolveApiBase(apiBase)
  const url = base.startsWith('/')
    ? `${base}${path}`
    : `${base.replace(/\/+$/, '')}${path}`
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetchWithTimeout(url, { headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    if (token) noteClientSessionFailure(res.status, text)
    throw new Error(`后端错误 ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }
  return res.json() as Promise<ApiEnvelope<T>>
}

function mapClientProfileLocal(profile: ClientProfile): AuthUser {
  return mapClientProfile(profile)
}

export async function fetchClientProfile(token: string, apiBase?: string): Promise<AuthUser | null> {
  const body = await apiGet<ClientProfile>('/client/auth/me', token, apiBase)
  if (body.code !== 0 || !body.data) return null
  return mapClientProfileLocal(body.data)
}

export async function createWechatQrcodeSession(apiBase?: string): Promise<WechatQrcodeSession> {
  const body = await apiPost<WechatSessionData>('/client/auth/wechat/session', apiBase)
  if (body.code !== 0 || !body.data) {
    throw new Error(body.message || '获取二维码失败')
  }

  const { state, auth_url, expires_at } = body.data
  const expiresMs = new Date(expires_at).getTime() - Date.now()
  const expireSeconds = Math.max(60, Math.floor(expiresMs / 1000))

  return {
    qrcodeUrl: qrImageUrl(auth_url),
    sceneId: state,
    expireSeconds,
  }
}

export async function pollWechatLogin(sceneId: string, apiBase?: string): Promise<WechatPollResult> {
  const body = await apiGet<WechatPollData>(
    `/client/auth/wechat/poll?state=${encodeURIComponent(sceneId)}`,
    undefined,
    apiBase,
  )

  if (body.code === 1032) {
    return { status: 'expired', message: body.message || '二维码已过期' }
  }
  if (body.code === 1034) {
    return { status: 'consumed', message: body.message || '登录会话已使用，请重新扫码' }
  }
  if (body.code !== 0) {
    return { status: 'error', message: body.message || '检查登录状态失败' }
  }

  const data = body.data
  if (!data || data.status === 'pending') {
    return { status: 'pending' }
  }

  if (data.status === 'success' && data.access_token) {
    const user = await fetchClientProfile(data.access_token, apiBase)
    if (!user) {
      return { status: 'error', message: '获取用户信息失败' }
    }
    return {
      status: 'confirmed',
      accessToken: data.access_token,
      user,
    }
  }

  return { status: 'pending' }
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
        '2. 本地 Docker 用 http://localhost:28080/api',
        '3. 直连 uvicorn 用 http://127.0.0.1:8000',
        '4. 花生壳隧道用 http://xxx.zicp.vip（无 /api 前缀）',
      ].join('\n')
    }
    return err.message
  }
  return '微信登录请求失败'
}

export { DEFAULT_LOCAL_API_BASE, DEFAULT_TUNNEL_API_BASE, normalizeApiBase }
