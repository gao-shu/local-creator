import { resolveApiBase } from '@/lib/auth/api-base'
import { canUseBackendFileUpload } from '@/lib/auth/login-mode'
import { useAuthStore } from '@/stores/auth-store'

export interface JimengAssetResult {
  recordId: string
  jimengAssetId: string
  status: string
  sourceUrl?: string
}

function jimengAssetsUrl(apiBase: string | undefined, path: string): string {
  const base = resolveApiBase(apiBase).replace(/\/+$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}/jimeng-assets${suffix}`
}

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token
  if (!canUseBackendFileUpload() || !token || token === 'offline-local-token') {
    throw new Error('请先登录后再提交即梦审核')
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

function normalizeJimengAssetStatus(raw: string): string {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (s === 'ready') return 'active'
  return s
}

export function isJimengAssetReady(status: string): boolean {
  const s = normalizeJimengAssetStatus(status)
  return s === 'active' || s === 'succeeded' || s === 'success'
}

export function isJimengAssetFailed(status: string): boolean {
  const s = normalizeJimengAssetStatus(status)
  return s === 'failed' || s === 'deleted'
}

function parseJimengAssetPayload(payload: unknown): JimengAssetResult {
  const row = (payload as { data?: Record<string, unknown> })?.data ?? payload
  const data = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
  const recordId = String(data.id ?? '').trim()
  const jimengAssetId = String(
    data.jimeng_asset_id ?? data.jimengAssetId ?? data.assetJimengId ?? data.remoteAssetId ?? '',
  ).trim()
  return {
    recordId,
    jimengAssetId,
    status: String(data.status ?? '').trim(),
    sourceUrl: String(data.source_url ?? data.sourceUrl ?? data.url ?? '').trim() || undefined,
  }
}

function assertApiSuccess(payload: unknown, fallback: string) {
  const row = payload as { success?: boolean; code?: number; message?: string }
  if (row?.success === false || (typeof row?.code === 'number' && row.code !== 0)) {
    throw new Error(String(row.message || '').trim() || fallback)
  }
}

/** 对齐 haode-ai-client POST /api/jimeng-assets/upload */
export async function uploadJimengReviewAsset(params: {
  apiBaseUrl?: string
  url: string
  name: string
  assetType?: string
}): Promise<JimengAssetResult> {
  const imageUrl = String(params.url || '').trim()
  if (!imageUrl) throw new Error('缺少角色图片 URL，无法提交即梦审核')

  const res = await fetch(jimengAssetsUrl(params.apiBaseUrl, '/upload'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      url: imageUrl,
      name: params.name,
      asset_type: params.assetType || 'Image',
    }),
  })
  const body = await res.json().catch(() => ({}))
  assertApiSuccess(body, '即梦素材上传失败')
  if (!res.ok) {
    throw new Error(
      String((body as { message?: string }).message || '').trim() ||
        `即梦素材上传失败 (${res.status})`,
    )
  }
  const parsed = parseJimengAssetPayload(body)
  if (!parsed.recordId && !parsed.jimengAssetId) {
    throw new Error('即梦素材上传成功，但未返回 assetId')
  }
  return parsed
}

/** 对齐 haode-ai-client POST /api/jimeng-assets/{id}/refresh */
export async function refreshJimengReviewAsset(params: {
  apiBaseUrl?: string
  recordId: string
}): Promise<JimengAssetResult> {
  const recordId = String(params.recordId || '').trim()
  if (!recordId) throw new Error('即梦素材刷新失败：缺少 recordId')

  const res = await fetch(jimengAssetsUrl(params.apiBaseUrl, `/${encodeURIComponent(recordId)}/refresh`), {
    method: 'POST',
    headers: authHeaders(),
  })
  const body = await res.json().catch(() => ({}))
  assertApiSuccess(body, '即梦素材刷新失败')
  if (!res.ok) {
    throw new Error(
      String((body as { message?: string }).message || '').trim() ||
        `即梦素材刷新失败 (${res.status})`,
    )
  }
  return parseJimengAssetPayload(body)
}

export async function pollJimengReviewAsset(params: {
  apiBaseUrl?: string
  recordId: string
  maxAttempts?: number
  intervalMs?: number
}): Promise<JimengAssetResult> {
  const maxAttempts = Math.max(1, params.maxAttempts ?? 10)
  const intervalMs = Math.max(0, params.intervalMs ?? 3000)
  let last: JimengAssetResult = {
    recordId: params.recordId,
    jimengAssetId: '',
    status: '',
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    last = await refreshJimengReviewAsset({
      apiBaseUrl: params.apiBaseUrl,
      recordId: params.recordId,
    })
    const normalized = normalizeJimengAssetStatus(last.status)
    if (isJimengAssetReady(normalized)) {
      return { ...last, status: normalized }
    }
    if (isJimengAssetFailed(normalized)) {
      throw new Error('即梦素材审核失败')
    }
    if (attempt < maxAttempts && intervalMs > 0) {
      await new Promise((r) => setTimeout(r, intervalMs))
    }
  }
  return last
}
