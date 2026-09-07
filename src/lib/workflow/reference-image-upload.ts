import { resolveApiBase } from '@/lib/auth/api-base'
import {
  resolveClientFilePublicUrl,
  toPublicFileUrl,
  toVerifyFileUrl,
  uploadClientImageFile,
  verifyPublicFileUrl,
} from '@/lib/auth/client-file-service'
import {
  isBackendUploadPathUrl,
  isTosPublicUrl,
  shouldReuseRemoteUploadUrl,
} from '@/lib/auth/upload-storage'
import { canUseBackendFileUpload } from '@/lib/auth/login-mode'
import { readStoredMediaAsDataUrl } from '@/lib/storage/fs-service'

/** 将本地/项目相对路径转为 API 可用的 data URL（禁止 local-image: 协议） */
async function resolveImagePathForApi(
  imagePath: string,
  projectRoot?: string,
): Promise<string> {
  const trimmed = String(imagePath || '').trim()
  if (!trimmed) throw new Error('未选择参考图')
  if (trimmed.startsWith('data:')) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const dataUrl = await readStoredMediaAsDataUrl(trimmed, projectRoot)
  if (dataUrl?.startsWith('data:')) return dataUrl
  throw new Error('无法读取参考图为 base64，请确认文件存在')
}

async function blobToReferenceFile(blob: Blob, label: string): Promise<File> {
  const ext = blob.type?.split('/')[1] || 'jpg'
  return new File([blob], `${label}.${ext}`, { type: blob.type || 'image/jpeg' })
}

async function imagePathToFile(
  imagePath: string,
  label = 'reference',
  projectRoot?: string,
): Promise<File> {
  const dataUrl = await resolveImagePathForApi(imagePath, projectRoot)

  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return blobToReferenceFile(blob, label)
}

/** 从 /uploads/ 地址读取并重新上传（文件已删除或本地不可达时） */
async function refetchUploadPathAsFile(
  pathOrUrl: string,
  apiBase: string,
  label = 'reference',
): Promise<File> {
  const verifyUrl = toVerifyFileUrl(pathOrUrl, apiBase)
  const res = await fetch(verifyUrl)
  if (!res.ok) {
    throw new Error(`无法读取参考图 (${res.status})，请重新上传`)
  }
  const blob = await res.blob()
  return blobToReferenceFile(blob, label)
}

async function verifyUploadedReference(publicUrl: string, apiBase: string): Promise<void> {
  const verifyUrl = toVerifyFileUrl(publicUrl, apiBase)
  try {
    await verifyPublicFileUrl(verifyUrl)
  } catch (error) {
    if (verifyUrl === publicUrl) throw error
    await verifyPublicFileUrl(publicUrl)
  }
}

/**
 * 已有后台 /uploads/ 地址：换当前公网 Origin 后校验，可访问则复用，避免重复上传。
 * 临时隧道域名过期时仍可通过 pathname 在本机 /uploads 找到原文件。
 */
export async function tryReuseBackendUploadUrl(
  pathOrUrl: string,
  apiBase: string,
): Promise<string | null> {
  const trimmed = pathOrUrl.trim()
  if (!isBackendUploadPathUrl(trimmed)) return null

  const publicUrl = toPublicFileUrl(trimmed, apiBase)
  try {
    await verifyUploadedReference(publicUrl, apiBase)
    return publicUrl
  } catch {
    return null
  }
}

/**
 * 将选中的本地/数据 URL 参考图上传至 haode-ai-admin（/uploads/temp/），返回公网可访问 URL。
 * 已是后台 /uploads/ 地址时优先 rewrite+校验复用，仅在文件不可达时重新上传。
 */
export async function uploadReferenceImageForGeneration(
  imagePath: string,
  options?: { apiBaseUrl?: string; label?: string; projectRoot?: string },
): Promise<string> {
  const trimmed = imagePath.trim()
  if (!trimmed) throw new Error('未选择参考图')

  if (!canUseBackendFileUpload()) {
    if (isBackendUploadPathUrl(trimmed) || shouldReuseRemoteUploadUrl(trimmed)) {
      return toPublicFileUrl(trimmed, options?.apiBaseUrl)
    }
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
      return trimmed
    }
    return resolveImagePathForApi(trimmed, options?.projectRoot)
  }

  const apiBase = resolveApiBase(options?.apiBaseUrl)
  const label = options?.label ?? 'reference'

  if (isTosPublicUrl(trimmed)) return trimmed

  const reused = await tryReuseBackendUploadUrl(trimmed, apiBase)
  if (reused) return reused

  if (shouldReuseRemoteUploadUrl(trimmed)) {
    const publicUrl = toPublicFileUrl(trimmed, apiBase)
    await verifyUploadedReference(publicUrl, apiBase)
    return publicUrl
  }

  if (isBackendUploadPathUrl(trimmed)) {
    const file = await refetchUploadPathAsFile(trimmed, apiBase, label)
    const uploaded = await uploadClientImageFile(file, apiBase)
    const publicUrl = resolveClientFilePublicUrl(uploaded, apiBase)
    await verifyUploadedReference(publicUrl, apiBase)
    return publicUrl
  }

  const file = await imagePathToFile(trimmed, label, options?.projectRoot)
  const uploaded = await uploadClientImageFile(file, apiBase)
  const publicUrl = resolveClientFilePublicUrl(uploaded, apiBase)
  await verifyUploadedReference(publicUrl, apiBase)
  return publicUrl
}

/** 批量上传/解析生图参考图，返回 API 可用的 URL 或 data URL */
export async function resolveReferenceImagesForGeneration(
  paths: string[],
  options?: { apiBaseUrl?: string; label?: string; projectRoot?: string },
): Promise<string[]> {
  const urls: string[] = []
  const label = options?.label ?? 'reference'
  const apiBase = options?.apiBaseUrl ? resolveApiBase(options.apiBaseUrl) : undefined

  for (const [index, rawPath] of paths.entries()) {
    const path = String(rawPath || '').trim()
    if (!path) continue

    const pushUnique = (value?: string | null) => {
      const text = String(value || '').trim()
      if (!text || urls.includes(text)) return
      if (text.startsWith('local-image:')) return
      urls.push(text)
    }

    try {
      if (
        (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) &&
        !path.includes('/uploads/')
      ) {
        pushUnique(path)
        continue
      }
      if (canUseBackendFileUpload() && apiBase) {
        pushUnique(
          await uploadReferenceImageForGeneration(path, {
            apiBaseUrl: apiBase,
            label: `${label}_${index + 1}`,
            projectRoot: options?.projectRoot,
          }),
        )
        continue
      }
      pushUnique(await resolveImagePathForApi(path, options?.projectRoot))
    } catch (error) {
      console.warn('[resolveReferenceImagesForGeneration] 参考图处理失败:', error)
    }
  }

  return urls
}
