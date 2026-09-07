import {
  resolveClientFilePublicUrl,
  toPublicFileUrl,
  toVerifyFileUrl,
  uploadClientAudioFile,
  verifyPublicAudioFileUrl,
} from '@/lib/auth/client-file-service'
import { isBackendUploadPathUrl, isTosPublicUrl } from '@/lib/auth/upload-storage'
import { resolveApiBase } from '@/lib/auth/api-base'
import { canUseBackendFileUpload } from '@/lib/auth/login-mode'
import { readAudioAsDataUrl } from '@/lib/storage/fs-service'
import { uploadReferenceImageForGeneration } from '@/lib/workflow/reference-image-upload'

export { uploadReferenceImageForGeneration }

async function audioPathToFile(
  audioPath: string,
  label = 'reference_audio',
  projectRoot?: string,
): Promise<File> {
  const trimmed = audioPath.trim()
  if (!trimmed) throw new Error('未选择参考音频')

  const dataUrl =
    trimmed.startsWith('data:') || /^https?:\/\//i.test(trimmed)
      ? trimmed
      : await readAudioAsDataUrl(trimmed, projectRoot)
  if (!dataUrl) throw new Error('无法读取参考音频，请确认文件存在')

  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const ext = trimmed.toLowerCase().includes('.wav') || blob.type.includes('wav') ? 'wav' : 'mp3'
  return new File([blob], `${label}.${ext}`, { type: blob.type || `audio/${ext}` })
}

async function refetchUploadPathAsAudioFile(
  pathOrUrl: string,
  apiBase: string,
  label: string,
): Promise<File> {
  const verifyUrl = toVerifyFileUrl(pathOrUrl, apiBase)
  const res = await fetch(verifyUrl)
  if (!res.ok) {
    throw new Error(`无法读取参考音频 (${res.status})，请重新上传`)
  }
  const blob = await res.blob()
  const ext = verifyUrl.toLowerCase().includes('.wav') || blob.type.includes('wav') ? 'wav' : 'mp3'
  return new File([blob], `${label}.${ext}`, { type: blob.type || `audio/${ext}` })
}

async function verifyUploadedAudio(publicUrl: string, apiBase: string): Promise<void> {
  const verifyUrl = toVerifyFileUrl(publicUrl, apiBase)
  try {
    await verifyPublicAudioFileUrl(verifyUrl)
  } catch (error) {
    if (verifyUrl === publicUrl) throw error
    await verifyPublicAudioFileUrl(publicUrl)
  }
}

async function tryReuseBackendAudioUploadUrl(
  pathOrUrl: string,
  apiBase: string,
): Promise<string | null> {
  const trimmed = pathOrUrl.trim()
  if (!isBackendUploadPathUrl(trimmed)) return null

  const publicUrl = toPublicFileUrl(trimmed, apiBase)
  try {
    await verifyUploadedAudio(publicUrl, apiBase)
    return publicUrl
  } catch {
    return null
  }
}

/**
 * 将本地参考音频上传至 haode-ai-admin，返回公网 URL。
 * 已有 /uploads/ 地址时优先 rewrite+校验复用。
 */
export async function uploadReferenceAudioForGeneration(
  audioPath: string,
  options?: { apiBaseUrl?: string; label?: string; projectRoot?: string },
): Promise<string> {
  const trimmed = audioPath.trim()
  if (!trimmed) throw new Error('未选择参考音频')

  if (!canUseBackendFileUpload()) {
    throw new Error('本地模式不支持后台上传参考音频，请使用微视 /v1/assets（系统设置 → 微视参考素材上传）')
  }

  const apiBase = resolveApiBase(options?.apiBaseUrl)
  const label = options?.label ?? 'reference_audio'

  if (isTosPublicUrl(trimmed)) return trimmed

  const reused = await tryReuseBackendAudioUploadUrl(trimmed, apiBase)
  if (reused) return reused

  if (/^https?:\/\//i.test(trimmed)) {
    if (isBackendUploadPathUrl(trimmed)) {
      const file = await refetchUploadPathAsAudioFile(trimmed, apiBase, label)
      const uploaded = await uploadClientAudioFile(file, apiBase)
      const publicUrl = resolveClientFilePublicUrl(uploaded, apiBase)
      await verifyUploadedAudio(publicUrl, apiBase)
      return publicUrl
    }
    if (/^https:\/\//i.test(trimmed)) return trimmed
    throw new Error('微视 API 不支持 http 媒体地址，请改用 https 或切换为「微视 /v1/assets」上传')
  }

  const file = await audioPathToFile(trimmed, label, options?.projectRoot)
  const uploaded = await uploadClientAudioFile(file, apiBase)
  const publicUrl = resolveClientFilePublicUrl(uploaded, apiBase)
  await verifyUploadedAudio(publicUrl, apiBase)
  return publicUrl
}

export async function resolveReferenceAudiosForGeneration(
  paths: string[],
  options?: { apiBaseUrl?: string; label?: string; projectRoot?: string },
): Promise<string[]> {
  const urls: string[] = []
  const label = options?.label ?? 'reference_audio'

  for (const [index, rawPath] of paths.entries()) {
    const path = String(rawPath || '').trim()
    if (!path) continue
    try {
      const url = await uploadReferenceAudioForGeneration(path, {
        apiBaseUrl: options?.apiBaseUrl,
        label: `${label}_${index + 1}`,
        projectRoot: options?.projectRoot,
      })
      if (url && !urls.includes(url)) urls.push(url)
    } catch (error) {
      console.warn('[resolveReferenceAudiosForGeneration] 参考音频处理失败:', error)
      throw error
    }
  }

  return urls
}
