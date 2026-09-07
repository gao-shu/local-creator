import { resolveApiBase, resolveUploadOrigin, resolveVerifyUploadOrigin } from '@/lib/auth/api-base'
import { isReusableRemoteUploadUrl, isTosPublicUrl } from '@/lib/auth/upload-storage'
import { canUseBackendFileUpload, isRealUserSession } from '@/lib/auth/login-mode'
import { noteClientSessionFailure } from '@/lib/auth/session-expired'
import { useAuthStore } from '@/stores/auth-store'
import type { ApiEnvelope, ClientFileOut } from '@/types/client-file'

const UPLOAD_TIMEOUT_MS = 120_000
const VERIFY_TIMEOUT_MS = 15_000

/** 参考图等临时素材走 /uploads/temp/，便于统一清理 */
const CLIENT_FILE_UPLOAD_CATEGORY = 'temp'

export type ClientFileUploadCategory = 'temp' | 'images' | 'videos' | 'audios'

function resolveUploadPublicOrigin(apiBase: string): string {
  return resolveUploadOrigin(apiBase)
}

function resolveVerifyPublicOrigin(apiBase: string): string {
  return resolveVerifyUploadOrigin(apiBase)
}

function extractUploadPathname(pathOrUrl: string): string {
  const raw = pathOrUrl.trim()
  if (!raw) return ''
  if (raw.startsWith('/')) return raw
  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).pathname
    } catch {
      return raw
    }
  }
  return `/${raw.replace(/^\/+/, '')}`
}

/**
 * 将后端返回的 file_path / url 转为第三方 API 可拉取的公网绝对地址。
 * /uploads/ 路径始终用 VITE_UPLOAD_ORIGIN（或 apiBase 推导的 Origin）拼接，
 * 避免后端 data.url 仍带过期花生壳/内网穿透域名。
 */
export function toPublicFileUrl(pathOrUrl: string, apiBase?: string): string {
  const raw = pathOrUrl.trim()
  if (!raw) return ''

  const origin = resolveUploadPublicOrigin(apiBase ?? resolveApiBase()).replace(/\/+$/, '')
  const pathname = extractUploadPathname(raw)

  if (pathname.includes('/uploads/')) {
    const path = pathname.startsWith('/') ? pathname : `/${pathname}`
    return `${origin}${path}`
  }

  if (isTosPublicUrl(raw)) return raw

  if (/^https?:\/\//i.test(raw)) return raw
  if (raw.startsWith('/')) return `${origin}${raw}`
  return `${origin}/${raw}`
}

/** 上传接口响应 → 给大模型用的公网 URL（优先 file_path，忽略后端可能过期的 url 域名） */
export function resolveClientFilePublicUrl(
  uploaded: Pick<ClientFileOut, 'url' | 'file_path'>,
  apiBase?: string,
): string {
  const filePath = String(uploaded.file_path || '').trim()
  const url = String(uploaded.url || '').trim()
  if (isTosPublicUrl(filePath)) return filePath
  if (isTosPublicUrl(url)) return url
  if (/^https?:\/\//i.test(filePath) && !filePath.includes('/uploads/')) return filePath
  return toPublicFileUrl(filePath || url, apiBase)
}

/** 上传后本地校验用 URL（开发态走本机 /uploads，与对外公网 URL 分离） */
export function toVerifyFileUrl(pathOrUrl: string, apiBase?: string): string {
  const raw = pathOrUrl.trim()
  if (!raw) return raw
  if (isTosPublicUrl(raw)) return raw

  let path = raw
  if (/^https?:\/\//i.test(raw)) {
    if (!raw.includes('/uploads/')) return raw
    try {
      path = new URL(raw).pathname
    } catch {
      return raw
    }
  }
  const origin = resolveVerifyPublicOrigin(apiBase ?? resolveApiBase())
  if (path.startsWith('/')) return `${origin}${path}`
  return `${origin}/${path}`
}

/** 上传后 HEAD/GET 校验文件是否可访问（供大模型拉取参考图） */
export async function verifyPublicFileUrl(url: string): Promise<void> {
  const target = url.trim()
  if (!target) throw new Error('参考图地址为空，无法校验')

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

  try {
    let res = await fetch(target, { method: 'HEAD', signal: controller.signal })
    if (!res.ok) {
      res = await fetch(target, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal: controller.signal,
      })
    }
    if (!res.ok) {
      throw new Error(`参考图上传校验失败 (${res.status})，文件可能未落盘或地址不可访问`)
    }
    const contentType = res.headers.get('content-type') || ''
    if (contentType && !contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
      throw new Error(`参考图校验异常：返回类型 ${contentType}`)
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`参考图校验超时（${VERIFY_TIMEOUT_MS / 1000}s）`)
    }
    if (err instanceof TypeError || (err instanceof Error && /failed to fetch|network/i.test(err.message))) {
      throw new Error('参考图上传校验失败：无法访问上传地址，请确认后台 /uploads 可访问或重新上传参考图')
    }
    throw err
  } finally {
    window.clearTimeout(timer)
  }
}

export async function verifyPublicAudioFileUrl(url: string): Promise<void> {
  const target = url.trim()
  if (!target) throw new Error('参考音频地址为空，无法校验')

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

  try {
    let res = await fetch(target, { method: 'HEAD', signal: controller.signal })
    if (!res.ok) {
      res = await fetch(target, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal: controller.signal,
      })
    }
    if (!res.ok) {
      throw new Error(`参考音频上传校验失败 (${res.status})，文件可能未落盘或地址不可访问`)
    }
    const contentType = res.headers.get('content-type') || ''
    if (
      contentType &&
      !contentType.startsWith('audio/') &&
      contentType !== 'application/octet-stream'
    ) {
      throw new Error(`参考音频校验异常：返回类型 ${contentType}`)
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`参考音频校验超时（${VERIFY_TIMEOUT_MS / 1000}s）`)
    }
    throw err
  } finally {
    window.clearTimeout(timer)
  }
}

export async function uploadClientAudioFile(
  file: File,
  apiBase?: string,
): Promise<ClientFileOut> {
  const token = useAuthStore.getState().token
  if (!canUseBackendFileUpload() || !isRealUserSession(token)) {
    throw new Error('请先登录后再上传参考音频')
  }

  const base = resolveApiBase(apiBase)
  const url = `${base.replace(/\/+$/, '')}/client/files/upload?category=${CLIENT_FILE_UPLOAD_CATEGORY}`
  const formData = new FormData()
  formData.append('file', file)

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      noteClientSessionFailure(res.status, text)
      throw new Error(`上传失败 ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
    }
    const body = (await res.json()) as ApiEnvelope<ClientFileOut>
    if (body.code !== 0 || !body.data?.url) {
      noteClientSessionFailure(res.status, body.message, body.code)
      throw new Error(body.message || '上传参考音频失败')
    }
    return body.data
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`上传超时（${UPLOAD_TIMEOUT_MS / 1000}s）`)
    }
    throw err
  } finally {
    window.clearTimeout(timer)
  }
}

export async function uploadClientImageFile(
  file: File,
  apiBase?: string,
  category: ClientFileUploadCategory = CLIENT_FILE_UPLOAD_CATEGORY,
): Promise<ClientFileOut> {
  const token = useAuthStore.getState().token
  if (!canUseBackendFileUpload() || !isRealUserSession(token)) {
    throw new Error('请先登录后再上传参考图')
  }

  const base = resolveApiBase(apiBase)
  const url = `${base.replace(/\/+$/, '')}/client/files/upload?category=${category}`
  const formData = new FormData()
  formData.append('file', file)

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      signal: controller.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      noteClientSessionFailure(res.status, text)
      throw new Error(`上传失败 ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
    }
    const body = (await res.json()) as ApiEnvelope<ClientFileOut>
    if (body.code !== 0 || !body.data?.url) {
      noteClientSessionFailure(res.status, body.message, body.code)
      throw new Error(body.message || '上传参考图失败')
    }
    return body.data
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`上传超时（${UPLOAD_TIMEOUT_MS / 1000}s）`)
    }
    throw err
  } finally {
    window.clearTimeout(timer)
  }
}
