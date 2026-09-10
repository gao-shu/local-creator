// Copyright (c) local-creator. All rights reserved.

import { isBackendUploadPathUrl } from '@/lib/auth/upload-storage'
import {
  uploadReferenceAudioForGeneration,
  uploadReferenceImageForGeneration,
} from '@/lib/workflow/reference-audio-upload'
import { assertNotAborted } from '@/lib/video/video-generation-abort'
import { toPublicFileUrl } from '@/lib/workflow/reference-image-upload'

export interface ResolveVideoApiMediaOptions {
  apiBaseUrl?: string
  projectRoot?: string
  label?: string
  abortSignal?: AbortSignal
}

function isRemoteHttpsUrl(value: string): boolean {
  return /^https:\/\//i.test(value.trim())
}

/**
 * 视频 API：本地路径 → data URL / https。
 * 公司后台上传已移除；若 API 强制 https，请提供 https 参考图或改用支持本地/data URL 的模型。
 */
export async function resolveVideoApiImageUrl(
  imagePath: string,
  options?: ResolveVideoApiMediaOptions,
): Promise<string> {
  const trimmed = String(imagePath || '').trim()
  if (!trimmed) throw new Error('缺少参考图')

  if (isBackendUploadPathUrl(trimmed)) {
    const url = toPublicFileUrl(trimmed, options?.apiBaseUrl)
    if (isRemoteHttpsUrl(url)) return url
    throw new Error('公司后台上传已移除，请改用支持本地/data URL 的模型或提供 https 参考图')
  }
  if (isRemoteHttpsUrl(trimmed)) return trimmed

  return uploadReferenceImageForGeneration(trimmed, {
    apiBaseUrl: options?.apiBaseUrl,
    projectRoot: options?.projectRoot,
    label: options?.label ?? 'video_ref_image',
  })
}

export async function resolveVideoApiImageUrls(
  paths: string[],
  options?: ResolveVideoApiMediaOptions,
): Promise<string[]> {
  const label = options?.label ?? 'video_ref_image'
  const urls: string[] = []

  for (const [index, rawPath] of paths.entries()) {
    assertNotAborted(options?.abortSignal)
    const path = String(rawPath || '').trim()
    if (!path) continue
    const url = await resolveVideoApiImageUrl(path, {
      ...options,
      label: `${label}_${index + 1}`,
    })
    if (url && !urls.includes(url)) urls.push(url)
  }

  return urls
}

export async function resolveVideoApiAudioUrl(
  audioPath: string,
  options?: ResolveVideoApiMediaOptions,
): Promise<string> {
  const trimmed = String(audioPath || '').trim()
  if (!trimmed) throw new Error('缺少参考音频')

  if (isBackendUploadPathUrl(trimmed)) {
    const url = toPublicFileUrl(trimmed, options?.apiBaseUrl)
    if (isRemoteHttpsUrl(url)) return url
    throw new Error('公司后台上传已移除，请改用支持本地/data URL 的模型或提供 https 参考音频')
  }
  if (isRemoteHttpsUrl(trimmed)) return trimmed

  return uploadReferenceAudioForGeneration(trimmed, {
    apiBaseUrl: options?.apiBaseUrl,
    projectRoot: options?.projectRoot,
    label: options?.label ?? 'video_ref_audio',
  })
}

export async function resolveVideoApiAudioUrls(
  paths: string[],
  options?: ResolveVideoApiMediaOptions,
): Promise<string[]> {
  const label = options?.label ?? 'video_ref_audio'
  const urls: string[] = []

  for (const [index, rawPath] of paths.entries()) {
    const path = String(rawPath || '').trim()
    if (!path) continue
    const url = await resolveVideoApiAudioUrl(path, {
      ...options,
      label: `${label}_${index + 1}`,
    })
    if (url && !urls.includes(url)) urls.push(url)
  }

  return urls
}
