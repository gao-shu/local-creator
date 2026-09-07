export interface AuthUser {
  id: string
  username: string
  nickname: string
  role: string
  status: string
  remaining_quota: number
  free_quota: number
  used_quota: number
  avatar_url: string | null
  bells?: number
  invite_code?: string | null
  invited_count?: number
  wechat_bound?: boolean
  phone?: string | null
  has_password?: boolean
  is_internal?: boolean
}

export type WechatPollStatus = 'pending' | 'confirmed' | 'expired' | 'consumed' | 'error'

export interface WechatQrcodeSession {
  qrcodeUrl: string
  sceneId: string
  expireSeconds: number
}

export interface WechatPollResult {
  status: WechatPollStatus
  accessToken?: string
  user?: AuthUser
  message?: string
}

export interface ApiEnvelope<T = unknown> {
  code?: number
  message?: string
  data?: T
  success?: boolean
}
