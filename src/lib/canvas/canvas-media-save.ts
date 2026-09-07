// Copyright (c) Haode AI. All rights reserved.

import type { AppSettings } from '@/types/settings'
import {
  copyMediaFileToDir,
  importLocalImageToDir,
  saveDataUrlImage,
  saveGeneratedImageFromUrl,
  saveGeneratedVideoFromUrl,
  selectLocalVideo,
  selectReferenceImage,
} from '@/lib/storage/fs-service'
import { readSettings } from '@/lib/storage/settings-service'
import {
  isRemoteMediaReference,
  toProjectRelativeMediaPath,
} from '@/lib/storage/media-path-resolver'
import {
  resolveCanvasAssetDir,
  resolveCanvasProjectRoot,
} from '@/lib/canvas/canvas-project-paths'
import { isCanvasApiAvailable } from '@/lib/storage/canvas-service'
import { resolveCanvasVideoImportAspectRatio } from '@/lib/canvas/canvas-video-aspect-probe'
import {
  assertDownloadableVideoUrl,
  extractVideoIdFromApiContentUrl,
  needsAuthenticatedVideoDownload,
  resolveApiOriginVideoContentUrl,
  resolveVideoDownloadHeaders,
  shouldAllowPrivateVideoContentFetch,
} from '@/lib/video/video-content-download'

function buildCanvasMediaFilename(prefix: string, nodeId: string, ext: string): string {
  const safeId = String(nodeId || 'node').replace(/[^a-zA-Z0-9_-]/g, '_')
  return `${prefix}_${safeId}_${Date.now()}${ext}`
}

function toCanvasRelativePath(
  absolutePath: string,
  settings: AppSettings,
  appDataDir: string,
  projectId: string,
): string {
  const projectRoot = resolveCanvasProjectRoot(settings, appDataDir, projectId)
  return toProjectRelativeMediaPath(absolutePath, projectRoot)
}

export async function saveCanvasReferenceFromDataUrl(options: {
  settings: AppSettings
  appDataDir: string
  projectId: string
  nodeId: string
  dataUrl: string
}): Promise<string> {
  const targetDir = resolveCanvasAssetDir(
    options.settings,
    options.appDataDir,
    options.projectId,
    'references',
  )
  const filename = buildCanvasMediaFilename('ref', options.nodeId, '.jpg')
  const saved = await saveDataUrlImage(options.dataUrl, { targetDir, filename })
  if (!saved.success || !saved.filePath) {
    throw new Error(saved.error || '参考图保存失败')
  }
  if (!isCanvasApiAvailable()) {
    return saved.filePath
  }
  return toCanvasRelativePath(saved.filePath, options.settings, options.appDataDir, options.projectId)
}

async function saveCanvasImageFromLocalFile(options: {
  settings: AppSettings
  appDataDir: string
  projectId: string
  nodeId: string
  sourcePath: string
  filenamePrefix: 'upload' | 'ref'
}): Promise<string> {
  const targetDir = resolveCanvasAssetDir(
    options.settings,
    options.appDataDir,
    options.projectId,
    options.filenamePrefix === 'ref' ? 'references' : 'images',
  )
  const filename = buildCanvasMediaFilename(options.filenamePrefix, options.nodeId, '.jpg')
  const saved = await importLocalImageToDir({
    sourcePath: options.sourcePath,
    targetDir,
    filename,
  })
  if (!saved.success || !saved.filePath) {
    throw new Error(saved.error || '图片保存失败')
  }
  if (!isCanvasApiAvailable()) {
    return saved.filePath
  }
  return toCanvasRelativePath(saved.filePath, options.settings, options.appDataDir, options.projectId)
}

export async function saveCanvasReferenceFromFile(options: {
  settings: AppSettings
  appDataDir: string
  projectId: string
  nodeId: string
  sourcePath: string
}): Promise<string> {
  return saveCanvasImageFromLocalFile({ ...options, filenamePrefix: 'ref' })
}

export async function saveCanvasUploadedImageFromFile(options: {
  settings: AppSettings
  appDataDir: string
  projectId: string
  nodeId: string
  sourcePath: string
}): Promise<string> {
  return saveCanvasImageFromLocalFile({ ...options, filenamePrefix: 'upload' })
}

export async function saveCanvasUploadedImageFromDataUrl(options: {
  settings: AppSettings
  appDataDir: string
  projectId: string
  nodeId: string
  dataUrl: string
}): Promise<string> {
  const targetDir = resolveCanvasAssetDir(
    options.settings,
    options.appDataDir,
    options.projectId,
    'images',
  )
  const filename = buildCanvasMediaFilename('upload', options.nodeId, '.jpg')
  const saved = await saveDataUrlImage(options.dataUrl, { targetDir, filename })
  if (!saved.success || !saved.filePath) {
    throw new Error(saved.error || '图片上传失败')
  }
  if (!isCanvasApiAvailable()) {
    return saved.filePath
  }
  return toCanvasRelativePath(saved.filePath, options.settings, options.appDataDir, options.projectId)
}

function resolveVideoFileExt(sourcePath: string): string {
  const match = String(sourcePath || '').match(/\.(mp4|webm|mov)$/i)
  return match ? match[0].toLowerCase() : '.mp4'
}

export async function saveCanvasUploadedVideoFromFile(options: {
  settings: AppSettings
  appDataDir: string
  projectId: string
  nodeId: string
  sourcePath: string
}): Promise<string> {
  const targetDir = resolveCanvasAssetDir(
    options.settings,
    options.appDataDir,
    options.projectId,
    'videos',
  )
  const ext = resolveVideoFileExt(options.sourcePath)
  const filename = buildCanvasMediaFilename('upload', options.nodeId, ext)
  const saved = await copyMediaFileToDir({
    sourcePath: options.sourcePath,
    targetDir,
    filename,
  })
  if (!saved.success || !saved.filePath) {
    throw new Error(saved.error || '视频保存失败')
  }
  if (!isCanvasApiAvailable()) {
    return saved.filePath
  }
  return toCanvasRelativePath(saved.filePath, options.settings, options.appDataDir, options.projectId)
}

/** 系统文件选择器上传画布视频（视频节点） */
export async function pickCanvasLocalVideo(options: {
  projectId: string
  nodeId: string
}): Promise<{ outputPath: string; aspectRatio?: string } | null> {
  const picked = await selectLocalVideo()
  if (!picked.success || picked.canceled) return null
  if (!picked.filePath) {
    throw new Error('未选择视频')
  }

  const aspectRatio = await resolveCanvasVideoImportAspectRatio(picked.filePath)
  const settingsRes = await readSettings()
  const outputPath = await saveCanvasUploadedVideoFromFile({
    settings: settingsRes.data,
    appDataDir: settingsRes.appDataDir,
    projectId: options.projectId,
    nodeId: options.nodeId,
    sourcePath: picked.filePath,
  })
  return { outputPath, ...(aspectRatio ? { aspectRatio } : {}) }
}

/** 系统文件选择器上传画布图片（生图节点 / 参考图节点） */
export async function pickCanvasLocalImage(options: {
  projectId: string
  nodeId: string
  kind: 'upload' | 'reference'
}): Promise<string | null> {
  const picked = await selectReferenceImage()
  if (!picked.success || picked.canceled) return null
  if (!picked.filePath && !picked.dataUrl) {
    throw new Error('未选择图片')
  }

  const settingsRes = await readSettings()
  const base = {
    settings: settingsRes.data,
    appDataDir: settingsRes.appDataDir,
    projectId: options.projectId,
    nodeId: options.nodeId,
  }

  if (picked.filePath) {
    return options.kind === 'reference'
      ? saveCanvasReferenceFromFile({ ...base, sourcePath: picked.filePath })
      : saveCanvasUploadedImageFromFile({ ...base, sourcePath: picked.filePath })
  }

  return options.kind === 'reference'
    ? saveCanvasReferenceFromDataUrl({ ...base, dataUrl: picked.dataUrl! })
    : saveCanvasUploadedImageFromDataUrl({ ...base, dataUrl: picked.dataUrl! })
}

export async function saveCanvasGeneratedImage(options: {
  settings: AppSettings
  appDataDir: string
  projectId: string
  nodeId: string
  remoteUrl: string
}): Promise<string> {
  if (!isCanvasApiAvailable()) {
    return options.remoteUrl
  }

  const targetDir = resolveCanvasAssetDir(
    options.settings,
    options.appDataDir,
    options.projectId,
    'images',
  )
  const saved = await saveGeneratedImageFromUrl(options.remoteUrl, targetDir)
  if (!saved.success || !saved.filePath) {
    throw new Error(saved.error || '生成图保存失败')
  }
  if (isRemoteMediaReference(saved.filePath)) {
    throw new Error('生成图未能保存到本地')
  }
  return toCanvasRelativePath(saved.filePath, options.settings, options.appDataDir, options.projectId)
}

export async function saveCanvasGeneratedVideo(options: {
  settings: AppSettings
  appDataDir: string
  projectId: string
  nodeId: string
  remoteUrl: string
  /** 恢复下载时的重试次数，默认 1 */
  downloadRetries?: number
  /** 中转 content 鉴权下载用 */
  apiKey?: string
  /** OpenAI 风格任务 id（video_*）；用于判断是否带 Bearer */
  videoId?: string
  /** 创建/轮询 API 地址；跨源 /content 改写到此源，并判断是否允许内网下载 */
  apiBaseUrl?: string
  abortSignal?: AbortSignal
  /** 系统模型等：无本地 API Key 时仍尝试下载（依赖 admin 返回可直链） */
  allowUnauthenticatedDownload?: boolean
}): Promise<string> {
  const videoIdHint = String(options.videoId || '').trim()
  const remoteUrl = resolveApiOriginVideoContentUrl({
    contentUrl: assertDownloadableVideoUrl(options.remoteUrl),
    apiBaseUrl: options.apiBaseUrl,
    preferredVideoId: videoIdHint,
  })

  if (!isCanvasApiAvailable()) {
    return remoteUrl
  }

  const videoId = videoIdHint || extractVideoIdFromApiContentUrl(remoteUrl)

  const headers = resolveVideoDownloadHeaders({
    url: remoteUrl,
    apiKey: options.apiKey,
    videoId,
  })
  if (
    needsAuthenticatedVideoDownload(remoteUrl, videoId) &&
    !String(options.apiKey || '').trim() &&
    !options.allowUnauthenticatedDownload &&
    !/\/client\/system-models\/video\/jobs\/[^/]+\/content\/?$/i.test(remoteUrl)
  ) {
    throw new Error('下载成片需要 API Key，请在设置中检查该视频模型的密钥')
  }

  const targetDir = resolveCanvasAssetDir(
    options.settings,
    options.appDataDir,
    options.projectId,
    'videos',
  )
  const filename = buildCanvasMediaFilename('video', options.nodeId, '.mp4')
  const saved = await saveGeneratedVideoFromUrl(remoteUrl, targetDir, {
    filename,
    retries: options.downloadRetries ?? 3,
    headers,
    allowPrivateNetwork: shouldAllowPrivateVideoContentFetch(remoteUrl, options.apiBaseUrl),
    abortSignal: options.abortSignal,
  })
  if (!saved.success || !saved.filePath) {
    throw new Error(saved.error || '视频保存失败')
  }
  // 远程 URL 回退不算本地成片，避免节点展示无效地址却仍占「进行中」
  if (isRemoteMediaReference(saved.filePath)) {
    throw new Error('视频未能保存到本地，请检查网络或下载地址后重试')
  }
  return toCanvasRelativePath(saved.filePath, options.settings, options.appDataDir, options.projectId)
}
