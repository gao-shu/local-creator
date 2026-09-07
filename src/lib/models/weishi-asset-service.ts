import { readImageAsDataUrl } from '@/lib/storage/fs-service'
import { isAssetReviewValidForImage } from '@/lib/workflow/asset-utils'
import type { WorkflowAsset } from '@/types/workflow'

const VIDEOS_SUFFIX = '/v1/videos'
const ASSETS_SUFFIX = '/v1/assets'

export interface WeishiAssetResult {
  assetId: string
  assetUrl: string
  status: string
  sourceUrl: string
}

function normalizeApiFormatStatus(raw: string): string {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (s === 'ready') return 'active'
  return s
}

export function isWeishiAssetReady(status: string): boolean {
  const s = normalizeApiFormatStatus(status)
  return s === 'active' || s === 'succeeded' || s === 'success'
}

export function isWeishiAssetFailed(status: string): boolean {
  const s = normalizeApiFormatStatus(status)
  return s === 'failed' || s === 'deleted'
}

/** 将微视 assetId / assetUrl 规范为 content 可用的 asset:// 引用 */
export function normalizeWeishiAssetReferenceUrl(
  asset: Pick<WorkflowAsset, 'weishiAssetId' | 'weishiAssetUrl'>,
): string | null {
  const url = String(asset.weishiAssetUrl || '').trim()
  if (/^asset:\/\//i.test(url)) return url
  const id = String(asset.weishiAssetId || '').trim()
  if (id) return `asset://${id.replace(/^asset:\/\//i, '')}`
  return null
}

/** 资产已同步微视且绑定图未变时，直接复用 asset://，免重复 POST /v1/assets */
export function resolveWeishiAssetReferenceUrl(
  asset: WorkflowAsset,
  imagePath: string,
): string | null {
  if (!isAssetReviewValidForImage(asset, imagePath)) return null
  const url = normalizeWeishiAssetReferenceUrl(asset)
  if (!url) return null

  const status = String(asset.weishiAssetStatus || '').trim()
  if (!status) return url
  if (isWeishiAssetFailed(status)) return null
  if (!isWeishiAssetReady(status)) return null
  return url
}

/** 将 /v1/videos 基址转为 /v1/assets 上传地址 */
export function resolveWeishiAssetsUploadUrl(endpoint: string): string {
  const trimmed = String(endpoint || '').trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (trimmed.endsWith(ASSETS_SUFFIX)) return trimmed
  if (trimmed.endsWith(VIDEOS_SUFFIX)) {
    return `${trimmed.slice(0, -VIDEOS_SUFFIX.length)}${ASSETS_SUFFIX}`
  }
  return `${trimmed}${ASSETS_SUFFIX}`
}

export function resolveWeishiAssetQueryUrl(endpoint: string, assetId: string): string {
  const base = resolveWeishiAssetsUploadUrl(endpoint)
  const id = encodeURIComponent(String(assetId || '').trim())
  if (!base || !id) return ''
  return `${base}/${id}`
}

function parseWeishiAssetPayload(payload: unknown): WeishiAssetResult {
  const row = (payload as { data?: Record<string, unknown> })?.data ?? payload
  const data = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
  return {
    assetId: String(data.asset_id ?? data.assetId ?? data.id ?? '').trim(),
    assetUrl: String(data.asset_url ?? data.assetUrl ?? data.url ?? '').trim(),
    status: String(data.status ?? '').trim(),
    sourceUrl: String(data.source_url ?? data.sourceUrl ?? data.source ?? '').trim(),
  }
}

function assertApiSuccess(payload: unknown, fallback: string) {
  const row = payload as { success?: boolean; message?: string }
  if (row?.success === false) {
    throw new Error(String(row.message || '').trim() || fallback)
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

function guessFilename(pathOrUrl: string, fallback = 'character.png'): string {
  const trimmed = String(pathOrUrl || '').trim()
  if (!trimmed) return fallback
  try {
    const name = new URL(trimmed).pathname.split('/').filter(Boolean).pop()
    if (name) return name
  } catch {
    const local = trimmed.replace(/\\/g, '/').split('/').filter(Boolean).pop()
    if (local) return local
  }
  return fallback
}

function ensureFilenameExt(filename: string, blob: Blob): string {
  const base = String(filename || 'asset').trim() || 'asset'
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base
  const ext =
    blob.type === 'image/jpeg'
      ? '.jpg'
      : blob.type === 'image/webp'
        ? '.webp'
        : blob.type === 'image/gif'
          ? '.gif'
          : '.png'
  return `${base}${ext}`
}

/** 读取本地/远程/ data URL 为 Blob，供微视 multipart 上传 */
export async function resolveImageBlobForWeishiUpload(
  imagePath: string,
  options?: { projectRoot?: string; label?: string },
): Promise<{ blob: Blob; filename: string }> {
  const trimmed = String(imagePath || '').trim()
  if (!trimmed) throw new Error('缺少角色图片，无法提交微视审核')

  let dataUrl = trimmed
  if (!trimmed.startsWith('data:') && !trimmed.startsWith('http')) {
    const read = await readImageAsDataUrl(trimmed, options?.projectRoot)
    if (!read) throw new Error('角色图片读取失败，无法提交微视审核')
    dataUrl = read
  } else if (trimmed.startsWith('http')) {
    const res = await fetch(trimmed)
    if (!res.ok) throw new Error(`下载角色图失败 (${res.status})`)
    const blob = await res.blob()
    const label = (options?.label || 'character').replace(/\s+/g, '')
    return { blob, filename: ensureFilenameExt(guessFilename(trimmed, `${label}.png`), blob) }
  }

  const blob = await dataUrlToBlob(dataUrl)
  const label = (options?.label || 'character').replace(/\s+/g, '') || 'character'
  return {
    blob,
    filename: ensureFilenameExt(`${label}.png`, blob),
  }
}

function guessAudioFilename(pathOrUrl: string, blob: Blob, fallback = 'reference_audio'): string {
  const trimmed = String(pathOrUrl || '').trim()
  const lower = trimmed.toLowerCase()
  if (/\.wav$/i.test(lower) || blob.type.includes('wav')) return ensureFilenameExt(`${fallback}.wav`, blob)
  if (/\.m4a$/i.test(lower) || blob.type.includes('mp4')) return ensureFilenameExt(`${fallback}.m4a`, blob)
  if (/\.ogg$/i.test(lower) || blob.type.includes('ogg')) return ensureFilenameExt(`${fallback}.ogg`, blob)
  return ensureFilenameExt(`${fallback}.mp3`, blob)
}

/** 读取本地/远程/data URL 音频为 Blob，供微视 multipart 上传 */
export async function resolveAudioBlobForWeishiUpload(
  audioPath: string,
  options?: { projectRoot?: string; label?: string },
): Promise<{ blob: Blob; filename: string }> {
  const trimmed = String(audioPath || '').trim()
  if (!trimmed) throw new Error('缺少参考音频')

  if (trimmed.startsWith('data:')) {
    const blob = await dataUrlToBlob(trimmed)
    const label = (options?.label || 'reference_audio').replace(/\s+/g, '') || 'reference_audio'
    return { blob, filename: guessAudioFilename(trimmed, blob, label) }
  }

  if (trimmed.startsWith('http')) {
    const res = await fetch(trimmed)
    if (!res.ok) throw new Error(`下载参考音频失败 (${res.status})`)
    const blob = await res.blob()
    const label = (options?.label || 'reference_audio').replace(/\s+/g, '') || 'reference_audio'
    return { blob, filename: guessAudioFilename(trimmed, blob, label) }
  }

  const { readAudioAsDataUrl } = await import('@/lib/storage/fs-service')
  const dataUrl = await readAudioAsDataUrl(trimmed, options?.projectRoot)
  if (!dataUrl) throw new Error('参考音频读取失败，无法上传微视')
  const blob = await dataUrlToBlob(dataUrl)
  const label = (options?.label || 'reference_audio').replace(/\s+/g, '') || 'reference_audio'
  return { blob, filename: guessAudioFilename(trimmed, blob, label) }
}

/** 微视 /v1/assets 上传结果 → content 可用的 asset:// 引用 */
export function formatWeishiAssetReferenceUrl(uploaded: WeishiAssetResult): string {
  const assetUrl = uploaded.assetUrl?.trim()
  if (assetUrl && /^asset:\/\//i.test(assetUrl)) return assetUrl
  const assetId = uploaded.assetId?.trim()
  if (assetId) return `asset://${assetId.replace(/^asset:\/\//i, '')}`
  throw new Error('微视素材上传成功，但未返回 assetId')
}

export async function uploadWeishiMediaAssetReference(params: {
  endpoint: string
  apiKey: string
  blob: Blob
  filename: string
  assetType: 'image' | 'audio' | string
  maxAttempts?: number
  intervalMs?: number
}): Promise<string> {
  let uploaded = await uploadWeishiReviewAsset({
    endpoint: params.endpoint,
    apiKey: params.apiKey,
    blob: params.blob,
    filename: params.filename,
    assetType: params.assetType,
  })
  if (!isWeishiAssetReady(uploaded.status)) {
    uploaded = await pollWeishiReviewAsset({
      endpoint: params.endpoint,
      apiKey: params.apiKey,
      assetId: uploaded.assetId,
      maxAttempts: params.maxAttempts ?? 20,
      intervalMs: params.intervalMs ?? 3000,
    })
  }
  if (!isWeishiAssetReady(uploaded.status)) {
    throw new Error('微视开白处理中，请稍后再试')
  }
  return formatWeishiAssetReferenceUrl(uploaded)
}

export async function uploadWeishiReviewAsset(params: {
  endpoint: string
  apiKey: string
  blob: Blob
  filename: string
  assetType?: string
}): Promise<WeishiAssetResult> {
  const uploadUrl = resolveWeishiAssetsUploadUrl(params.endpoint)
  if (!uploadUrl) throw new Error('微视素材上传失败：缺少 API 地址')
  if (!params.apiKey?.trim()) throw new Error('微视素材上传失败：缺少 API Key')
  if (!params.blob) throw new Error('微视素材上传失败：缺少上传内容')

  const form = new FormData()
  form.append('file', params.blob, ensureFilenameExt(params.filename, params.blob))
  if (params.assetType) form.append('asset_type', params.assetType)

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.apiKey.trim()}` },
    body: form,
  })
  const body = await res.json().catch(() => ({}))
  assertApiSuccess(body, '微视素材上传失败')
  if (!res.ok) {
    throw new Error(String((body as { message?: string }).message || '').trim() || `微视素材上传失败 (${res.status})`)
  }
  const parsed = parseWeishiAssetPayload(body)
  if (!parsed.assetId) throw new Error('微视素材上传成功，但未返回 assetId')
  return parsed
}

export async function pollWeishiReviewAsset(params: {
  endpoint: string
  apiKey: string
  assetId: string
  maxAttempts?: number
  intervalMs?: number
}): Promise<WeishiAssetResult> {
  const queryUrl = resolveWeishiAssetQueryUrl(params.endpoint, params.assetId)
  if (!queryUrl) throw new Error('微视素材轮询失败：缺少 assetId 或 endpoint')
  if (!params.apiKey?.trim()) throw new Error('微视素材轮询失败：缺少 API Key')

  const maxAttempts = Math.max(1, params.maxAttempts ?? 10)
  const intervalMs = Math.max(0, params.intervalMs ?? 3000)
  let last: WeishiAssetResult = {
    assetId: params.assetId,
    assetUrl: '',
    status: '',
    sourceUrl: '',
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(queryUrl, {
      headers: { Authorization: `Bearer ${params.apiKey.trim()}` },
    })
    const body = await res.json().catch(() => ({}))
    assertApiSuccess(body, '微视素材查询失败')
    if (!res.ok) {
      throw new Error(
        String((body as { message?: string }).message || '').trim() ||
          `微视素材查询失败 (${res.status})`,
      )
    }
    last = parseWeishiAssetPayload(body)
    const normalized = normalizeApiFormatStatus(last.status)
    if (isWeishiAssetReady(normalized)) {
      return { ...last, status: normalized }
    }
    if (isWeishiAssetFailed(normalized)) {
      throw new Error('微视素材审核失败')
    }
    if (attempt < maxAttempts && intervalMs > 0) {
      await new Promise((r) => setTimeout(r, intervalMs))
    }
  }
  return last
}
