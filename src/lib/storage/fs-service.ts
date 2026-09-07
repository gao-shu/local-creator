import {
  fromLocalImageUrl,
  isRemoteMediaReference,
  isAbsoluteMediaPath,
  isLocalImageUrl,
  normalizeRemoteMediaUrl,
  normalizeStoredMediaPath,
  resolveProjectMediaPath,
  toLocalImageUrl,
} from '@/lib/storage/media-path-resolver'
import { assertNotAborted, delayWithAbort } from '@/lib/video/video-generation-abort'

export interface SelectVideoResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  error?: string
}

export interface SelectVideosResult {
  success: boolean
  canceled?: boolean
  filePaths?: string[]
  error?: string
}

export interface FsAPI {
  selectImage: (options?: { includeDataUrl?: boolean }) => Promise<SelectImageResult>
  selectVideo: () => Promise<SelectVideoResult>
  selectVideos: () => Promise<SelectVideosResult>
  importLocalImage: (payload: {
    sourcePath: string
    targetDir: string
    filename?: string
  }) => Promise<{ success: boolean; filePath?: string; error?: string }>
  saveGeneratedImage: (payload: {
    dataUrl: string
    targetDir?: string
    filename?: string
  }) => Promise<SaveImageResult>
  readImageDataUrl: (filePath: string) => Promise<ReadImageResult>
  saveRemoteFile: (payload: {
    url: string
    targetDir?: string
    filename?: string
    headers?: Record<string, string>
    allowPrivateNetwork?: boolean
  }) => Promise<SaveImageResult>
  copyReferenceAudio: (payload: {
    sourcePath: string
    targetDir: string
    filename?: string
  }) => Promise<{ success: boolean; filePath?: string; error?: string }>
  copyMediaFile: (payload: {
    sourcePath: string
    targetDir: string
    filename?: string
    externalTarget?: boolean
  }) => Promise<{ success: boolean; filePath?: string; error?: string }>
  readAudioDataUrl: (filePath: string) => Promise<{
    success: boolean
    dataUrl?: string
    ext?: string
    error?: string
  }>
  ensureDirectories: (directories: string[]) => Promise<{ success: boolean; error?: string }>
  revealPath: (payload: {
    absolutePath: string
    revealFile?: boolean
  }) => Promise<{ success: boolean; error?: string }>
}

export interface SelectImageResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  dataUrl?: string
  error?: string
}

export interface SaveImageResult {
  success: boolean
  filePath?: string
  dataUrl?: string
  error?: string
}

export interface ReadImageResult {
  success: boolean
  dataUrl?: string
  error?: string
}

export async function selectReferenceImage(options?: {
  includeDataUrl?: boolean
}): Promise<SelectImageResult> {
  if (window.fsAPI) {
    return window.fsAPI.selectImage(options)
  }
  return { success: true, canceled: true }
}

export async function selectLocalVideo(): Promise<SelectVideoResult> {
  if (window.fsAPI?.selectVideo) {
    return window.fsAPI.selectVideo()
  }
  return { success: true, canceled: true }
}

export async function selectLocalVideos(): Promise<SelectVideosResult> {
  if (window.fsAPI?.selectVideos) {
    return window.fsAPI.selectVideos()
  }
  return { success: true, canceled: true, filePaths: [] }
}

export async function importLocalImageToDir(payload: {
  sourcePath: string
  targetDir: string
  filename?: string
}): Promise<SaveImageResult> {
  if (window.fsAPI?.importLocalImage) {
    return window.fsAPI.importLocalImage(payload)
  }
  return { success: false, error: '请在桌面客户端中导入图片' }
}

export async function saveDataUrlImage(
  dataUrl: string,
  options?: { targetDir?: string; filename?: string },
): Promise<SaveImageResult> {
  const trimmed = String(dataUrl || '').trim()
  if (!trimmed) return { success: false, error: '缺少图片数据' }
  if (window.fsAPI) {
    return window.fsAPI.saveGeneratedImage({
      dataUrl: trimmed,
      targetDir: options?.targetDir,
      filename: options?.filename,
    })
  }
  return { success: true, dataUrl: trimmed, filePath: trimmed }
}

export async function saveGeneratedImageFromUrl(
  source: string,
  targetDir?: string,
): Promise<SaveImageResult> {
  const trimmed = String(source || '').trim()
  if (window.fsAPI) {
    if (/^https?:\/\//i.test(trimmed) && window.fsAPI.saveRemoteFile) {
      let ext = '.png'
      try {
        const pathname = new URL(trimmed).pathname
        const match = pathname.match(/\.(png|jpe?g|webp|gif)$/i)
        if (match) ext = match[0].toLowerCase()
      } catch {
        /* ignore */
      }
      const filename = `gen_${crypto.randomUUID()}${ext}`
      return window.fsAPI.saveRemoteFile({ url: trimmed, targetDir, filename })
    }
    return window.fsAPI.saveGeneratedImage({ dataUrl: trimmed, targetDir })
  }
  if (isRemoteMediaReference(trimmed) || trimmed.startsWith('data:')) {
    return { success: true, dataUrl: trimmed, filePath: trimmed }
  }
  return { success: true, filePath: trimmed, dataUrl: trimmed }
}

export async function readImageAsDataUrl(
  filePath: string,
  projectRoot?: string,
): Promise<string | null> {
  const stored = normalizeStoredMediaPath(filePath)
  if (!stored) return null
  if (stored.startsWith('data:') || stored.startsWith('preview:')) return stored
  if (isLocalImageUrl(stored)) return stored

  if (isRemoteMediaReference(stored)) {
    return normalizeRemoteMediaUrl(stored)
  }

  const resolved = projectRoot ? resolveProjectMediaPath(stored, projectRoot) : stored
  if (!projectRoot && !isAbsoluteMediaPath(resolved)) return null

  if (window.fsAPI && resolved && !isRemoteMediaReference(resolved)) {
    return toLocalImageUrl(resolved)
  }

  if (window.fsAPI) {
    const res = await window.fsAPI.readImageDataUrl(resolved)
    if (res.success && res.dataUrl) return res.dataUrl
  }

  return null
}

/** 读取存储路径对应的图片二进制（导入/复制用，返回 data URL） */
export async function readStoredMediaAsDataUrl(
  filePath: string,
  projectRoot?: string,
): Promise<string | null> {
  const stored = normalizeStoredMediaPath(filePath)
  if (!stored) return null
  if (stored.startsWith('data:')) return stored
  if (stored.startsWith('preview:')) return null

  let resolved = stored
  if (isLocalImageUrl(stored)) {
    resolved = fromLocalImageUrl(stored)
  } else if (isRemoteMediaReference(stored)) {
    resolved = normalizeRemoteMediaUrl(stored)
  } else if (projectRoot) {
    resolved = resolveProjectMediaPath(stored, projectRoot)
  }

  if (!resolved || resolved.startsWith('preview:')) return null
  if (!projectRoot && !isAbsoluteMediaPath(resolved) && !isRemoteMediaReference(resolved)) {
    return null
  }

  if (window.fsAPI && !resolved.startsWith('data:')) {
    const res = await window.fsAPI.readImageDataUrl(resolved)
    if (res.success && res.dataUrl) return res.dataUrl
  }

  return null
}

export async function readAudioAsDataUrl(
  filePath: string,
  projectRoot?: string,
): Promise<string | null> {
  const stored = normalizeStoredMediaPath(filePath)
  if (!stored) return null
  if (stored.startsWith('data:')) return stored
  if (/^https?:\/\//i.test(stored)) return stored

  const resolved = projectRoot ? resolveProjectMediaPath(stored, projectRoot) ?? stored : stored
  if (!projectRoot && !isAbsoluteMediaPath(resolved) && !isRemoteMediaReference(resolved)) {
    return null
  }

  if (window.fsAPI?.readAudioDataUrl && !resolved.startsWith('data:')) {
    const res = await window.fsAPI.readAudioDataUrl(resolved)
    if (res.success && res.dataUrl) return res.dataUrl
  }

  return null
}

/** 解析存储路径为可用于 img/video 的预览地址（本地文件走 local-image://） */
export async function resolveImagePreviewSrc(
  storedPath: string,
  projectRoot?: string,
): Promise<string | null> {
  return readImageAsDataUrl(storedPath, projectRoot)
}

/** 解析视频存储路径为可用于 video 标签的预览地址（本地文件走 local-image://，支持 Range） */
export async function resolveVideoPreviewSrc(
  storedPath: string,
  projectRoot?: string,
): Promise<string | null> {
  const stored = normalizeStoredMediaPath(storedPath)
  if (!stored) return null
  if (stored.startsWith('preview:')) return stored
  if (isLocalImageUrl(stored)) return stored
  if (isRemoteMediaReference(stored)) {
    return normalizeRemoteMediaUrl(stored)
  }

  const resolved = projectRoot ? resolveProjectMediaPath(stored, projectRoot) : stored
  if (!projectRoot && !isAbsoluteMediaPath(resolved)) return null
  if (!resolved || isRemoteMediaReference(resolved)) return null

  return toLocalImageUrl(resolved)
}

/** 解析音频存储路径为可用于 audio 标签的预览地址（本地文件走 local-image://，支持 Range） */
export async function resolveAudioPreviewSrc(
  storedPath: string,
  projectRoot?: string,
): Promise<string | null> {
  return resolveVideoPreviewSrc(storedPath, projectRoot)
}

export interface SaveGeneratedVideoOptions {
  filename?: string
  /** 下载失败时的重试次数，默认 1（不重试） */
  retries?: number
  retryDelayMs?: number
  abortSignal?: AbortSignal
  /** 中转 /videos/{id}/content 等需鉴权下载时传入 */
  headers?: Record<string, string>
  /** 本机/内网视频 API：仅对已配置 API 源放开内网下载 */
  allowPrivateNetwork?: boolean
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function saveGeneratedVideoOnce(
  remoteUrl: string,
  targetDir: string | undefined,
  filename: string,
  headers?: Record<string, string>,
  allowPrivateNetwork?: boolean,
): Promise<SaveImageResult> {
  if (window.fsAPI?.saveRemoteFile) {
    return window.fsAPI.saveRemoteFile({
      url: remoteUrl,
      targetDir,
      filename,
      headers,
      allowPrivateNetwork,
    })
  }
  if (/^https?:\/\//i.test(remoteUrl)) {
    return { success: true, filePath: remoteUrl, dataUrl: remoteUrl }
  }
  return { success: false, error: '无法保存视频' }
}

export async function saveGeneratedVideoFromUrl(
  remoteUrl: string,
  targetDir?: string,
  filenameOrOptions?: string | SaveGeneratedVideoOptions,
): Promise<SaveImageResult> {
  const trimmed = String(remoteUrl || '').trim()
  if (!trimmed) return { success: false, error: '缺少视频地址' }

  let filename: string | undefined
  let retries = 1
  let retryDelayMs = 2000
  let abortSignal: AbortSignal | undefined
  let headers: Record<string, string> | undefined
  let allowPrivateNetwork: boolean | undefined
  if (typeof filenameOrOptions === 'string') {
    filename = filenameOrOptions
  } else if (filenameOrOptions) {
    filename = filenameOrOptions.filename
    retries = Math.max(1, filenameOrOptions.retries ?? 1)
    retryDelayMs = filenameOrOptions.retryDelayMs ?? 2000
    abortSignal = filenameOrOptions.abortSignal
    headers = filenameOrOptions.headers
    allowPrivateNetwork = filenameOrOptions.allowPrivateNetwork
  }

  assertNotAborted(abortSignal)

  if (!filename) {
    let ext = '.mp4'
    try {
      const pathname = new URL(trimmed).pathname
      if (/\/content\/?$/i.test(pathname)) {
        ext = '.mp4'
      } else {
        const match = pathname.match(/\.(mp4|webm|mov)$/i)
        if (match) ext = match[0].toLowerCase()
      }
    } catch {
      /* ignore */
    }
    filename = `video_${crypto.randomUUID()}${ext}`
  }

  let lastError = '无法保存视频'
  for (let attempt = 1; attempt <= retries; attempt++) {
    assertNotAborted(abortSignal)
    const result = await saveGeneratedVideoOnce(
      trimmed,
      targetDir,
      filename,
      headers,
      allowPrivateNetwork,
    )
    if (result.success) return result
    lastError = result.error || lastError
    if (attempt < retries) {
      await delayWithAbort(retryDelayMs * attempt, abortSignal)
    }
  }
  return { success: false, error: lastError }
}

/** 本地媒体文件 URL（Electron 下用于 video 标签；需传入已解析或绝对路径） */
export function resolveMediaUrl(filePath: string): string {
  if (!filePath || filePath.startsWith('preview:')) return ''
  if (isLocalImageUrl(filePath)) return filePath
  if (/^https?:\/\//i.test(filePath)) return filePath
  if (isAbsoluteMediaPath(filePath.replace(/\\/g, '/'))) {
    return toLocalImageUrl(filePath)
  }
  return ''
}

export async function ensureDataDirectories(
  directories: string[],
): Promise<{ success: boolean; error?: string }> {
  if (window.fsAPI?.ensureDirectories) {
    return window.fsAPI.ensureDirectories(directories)
  }
  return { success: true }
}

export async function revealPathInExplorer(
  absolutePath: string,
  options?: { revealFile?: boolean },
): Promise<{ success: boolean; error?: string }> {
  const trimmed = String(absolutePath || '').trim()
  if (!trimmed) return { success: false, error: '路径为空' }
  if (window.fsAPI?.revealPath) {
    return window.fsAPI.revealPath({
      absolutePath: trimmed,
      revealFile: options?.revealFile,
    })
  }
  return { success: false, error: '请在桌面客户端中打开文件夹' }
}

export async function copyReferenceAudioFile(payload: {
  sourcePath: string
  targetDir: string
  filename?: string
}): Promise<{ success: boolean; filePath?: string; error?: string }> {
  if (window.fsAPI?.copyReferenceAudio) {
    return window.fsAPI.copyReferenceAudio(payload)
  }
  return { success: false, error: '请在桌面客户端中保存参考音色' }
}

export async function copyMediaFileToDir(payload: {
  sourcePath: string
  targetDir: string
  filename?: string
  /** 目标目录为用户在系统对话框中选择的任意可写路径 */
  externalTarget?: boolean
}): Promise<{ success: boolean; filePath?: string; error?: string }> {
  if (window.fsAPI?.copyMediaFile) {
    return window.fsAPI.copyMediaFile(payload)
  }
  return { success: false, error: '请在桌面客户端中复制媒体文件' }
}
