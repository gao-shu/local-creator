import { readAudioAsDataUrl } from '@/lib/storage/fs-service'
import { isBackendUploadPathUrl } from '@/lib/auth/upload-storage'
import { uploadReferenceImageForGeneration } from '@/lib/workflow/reference-image-upload'

export { uploadReferenceImageForGeneration }

/**
 * 开源版：无公司后台。https/data 原样返回，本地路径转 data URL。
 * 第三方视频 API 若强制 https，请提供 https 参考音频。
 */
export async function uploadReferenceAudioForGeneration(
  audioPath: string,
  options?: { apiBaseUrl?: string; label?: string; projectRoot?: string },
): Promise<string> {
  const trimmed = audioPath.trim()
  if (!trimmed) throw new Error('未选择参考音频')

  if (isBackendUploadPathUrl(trimmed)) {
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    throw new Error('公司后台上传已移除，请使用本地 data URL 或 https 参考音频')
  }

  if (trimmed.startsWith('data:') || /^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  const dataUrl = await readAudioAsDataUrl(trimmed, options?.projectRoot)
  if (!dataUrl) throw new Error('无法读取参考音频，请确认文件存在')
  return dataUrl
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
    const url = await uploadReferenceAudioForGeneration(path, {
      apiBaseUrl: options?.apiBaseUrl,
      label: `${label}_${index + 1}`,
      projectRoot: options?.projectRoot,
    })
    if (url && !urls.includes(url)) urls.push(url)
  }

  return urls
}
