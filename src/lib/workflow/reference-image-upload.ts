import { readStoredMediaAsDataUrl } from '@/lib/storage/fs-service'
import {
  isBackendUploadPathUrl,
  shouldReuseRemoteUploadUrl,
} from '@/lib/auth/upload-storage'

/** 将本地/项目相对路径转为 API 可用的 data URL */
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

/**
 * 开源版：无公司后台上传。已是 http(s)/data URL 原样返回，本地路径转 data URL。
 */
export async function uploadReferenceImageForGeneration(
  imagePath: string,
  options?: { apiBaseUrl?: string; label?: string; projectRoot?: string },
): Promise<string> {
  const trimmed = imagePath.trim()
  if (!trimmed) throw new Error('未选择参考图')

  if (isBackendUploadPathUrl(trimmed) || shouldReuseRemoteUploadUrl(trimmed)) {
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    throw new Error('公司后台上传已移除，请使用本地文件或 https 参考图')
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed
  }
  return resolveImagePathForApi(trimmed, options?.projectRoot)
}

/** @deprecated 公司后台上传已移除 */
export async function tryReuseBackendUploadUrl(
  _pathOrUrl: string,
  _apiBase: string,
): Promise<string | null> {
  return null
}

export async function uploadReferenceImagesForGeneration(
  imagePaths: string[],
  options?: { apiBaseUrl?: string; label?: string; projectRoot?: string },
): Promise<string[]> {
  const results: string[] = []
  for (let i = 0; i < imagePaths.length; i++) {
    const path = imagePaths[i]
    if (!path?.trim()) continue
    results.push(
      await uploadReferenceImageForGeneration(path, {
        ...options,
        label: options?.label ? `${options.label}_${i}` : `reference_${i}`,
      }),
    )
  }
  return results
}

export async function resolveReferenceImagesForGeneration(
  paths: string[],
  options?: { apiBaseUrl?: string; label?: string; projectRoot?: string },
): Promise<string[]> {
  return uploadReferenceImagesForGeneration(paths, options)
}

/** 兼容旧调用：仅透传 http(s) */
export function toPublicFileUrl(pathOrUrl: string, _apiBase?: string): string {
  return String(pathOrUrl || '').trim()
}
