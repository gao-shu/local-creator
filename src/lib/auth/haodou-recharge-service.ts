// Copyright (c) Haode AI. All rights reserved.

import { resolveApiBase } from '@/lib/auth/api-base'
import { noteClientSessionFailure } from '@/lib/auth/session-expired'
import type { ApiEnvelope } from '@/types/auth'

export type HaodouPaymentInfo = {
  mode: string
  methods: string[]
  epay_ready: boolean
  mock_enabled: boolean
}

export type HaodouPackageItem = {
  package_key: string
  name: string
  haodou_amount: number
  price_fen: number
  description?: string | null
}

export type HaodouOrderResult = {
  trade_no: string
  status: string
  package_key: string
  package_name?: string
  haodou_amount: number
  price_fen: number
  payment_method: string
  pay_url?: string | null
  balance?: number | null
  paid_at?: string | null
  expires_at?: string | null
}

function buildUrl(path: string, apiBase?: string): string {
  const base = resolveApiBase(apiBase)
  return base.startsWith('/') ? `${base}${path}` : `${base.replace(/\/+$/, '')}${path}`
}

async function authedJson<T>(
  path: string,
  token: string,
  init: RequestInit,
  apiBase?: string,
): Promise<T> {
  const res = await fetch(buildUrl(path, apiBase), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const json = (await res.json()) as ApiEnvelope<T> & { detail?: string }
  if (!res.ok || json.code !== 0 || json.data === undefined) {
    const hint = json.message || (typeof json.detail === 'string' ? json.detail : undefined)
    noteClientSessionFailure(res.status, hint, json.code)
    throw new Error(json.message || hint || `请求失败 (${res.status})`)
  }
  return json.data
}

export function formatHaodouPackagePrice(priceFen: number): string {
  if (priceFen <= 0) return '免费（内测）'
  const yuan = priceFen / 100
  return Number.isInteger(yuan) ? `¥${yuan}` : `¥${yuan.toFixed(2)}`
}

export function formatHaodouPaymentMethod(method: string): string {
  if (method === 'wxpay') return '微信支付'
  if (method === 'alipay') return '支付宝'
  return method
}

export async function fetchHaodouPaymentInfo(
  token: string,
  apiBase?: string,
): Promise<HaodouPaymentInfo> {
  return authedJson<HaodouPaymentInfo>('/client/haodou/payment/info', token, { method: 'GET' }, apiBase)
}

export async function fetchHaodouPackages(
  token: string,
  apiBase?: string,
): Promise<HaodouPackageItem[]> {
  const data = await authedJson<{ list: HaodouPackageItem[] }>(
    '/client/haodou/packages',
    token,
    { method: 'GET' },
    apiBase,
  )
  return data.list ?? []
}

export async function mockPurchaseHaodouPackage(
  token: string,
  packageKey: string,
  apiBase?: string,
): Promise<{ balance: number; package_key: string }> {
  return authedJson<{ balance: number; package_key: string }>(
    '/client/haodou/purchase',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ package_key: packageKey }),
    },
    apiBase,
  )
}

export async function createHaodouPaymentOrder(
  token: string,
  options: { packageKey: string; paymentMethod: string },
  apiBase?: string,
): Promise<HaodouOrderResult> {
  return authedJson<HaodouOrderResult>(
    '/client/haodou/orders',
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        package_key: options.packageKey,
        payment_method: options.paymentMethod,
      }),
    },
    apiBase,
  )
}

export async function fetchHaodouOrder(
  token: string,
  tradeNo: string,
  apiBase?: string,
): Promise<HaodouOrderResult> {
  return authedJson<HaodouOrderResult>(
    `/client/haodou/orders/${encodeURIComponent(tradeNo)}`,
    token,
    { method: 'GET' },
    apiBase,
  )
}
