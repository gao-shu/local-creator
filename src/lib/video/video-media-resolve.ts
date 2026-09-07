// Copyright (c) haode-ai-client. All rights reserved.

import { toPublicFileUrl } from '@/lib/auth/client-file-service'
import { isBackendUploadPathUrl } from '@/lib/auth/upload-storage'
import { canUseBackendFileUpload } from '@/lib/auth/login-mode'
import {
  uploadReferenceAudioForGeneration,
  uploadReferenceImageForGeneration,
} from '@/lib/workflow/reference-audio-upload'
import { assertNotAborted } from '@/lib/video/video-generation-abort'

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
 * 非微视视频 API：本地/项目相对路径 → 后台 admin upload → 公网 https URL。
 * 已是 https 或后台 /uploads/ 地址时 rewrite 到当前 Origin 并复用。
 */
export async function resolveVideoApiImageUrl(
  imagePath: string,
  options?: ResolveVideoApiMediaOptions,
): Promise<string> {
  const trimmed = String(imagePath || '').trim()
  if (!trimmed) throw new Error('缺少参考图')

  if (isBackendUploadPathUrl(trimmed)) {
    return toPublicFileUrl(trimmed, options?.apiBaseUrl)
  }
  if (isRemoteHttpsUrl(trimmed)) return trimmed

  requireBackendUpload()
  return uploadReferenceImageForGeneration(trimmed, {
    apiBaseUrl: options?.apiBaseUrl,
    projectRoot: options?.projectRoot,
    label: options?.label ?? 'video_ref_image',
  })
}

function requireBackendUpload(): void {
  if (!canUseBackendFileUpload()) {
    throw new Error(
      '当前视频模型需将参考素材上传至后台服务器（https）。请开启登录（VITE_LOGIN_REQUIRED）并完成账号登录，或改用微视 API。',
    )
  }
}

/** 批量解析分镜参考图，供智谱/OpenAI 兼容等视频模型使用 */
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

/** 非微视视频 API：参考音频上传后台并返回 https URL */
export async function resolveVideoApiAudioUrl(
  audioPath: string,
  options?: ResolveVideoApiMediaOptions,
): Promise<string> {
  const trimmed = String(audioPath || '').trim()
  if (!trimmed) throw new Error('缺少参考音频')

  if (isBackendUploadPathUrl(trimmed)) {
    return toPublicFileUrl(trimmed, options?.apiBaseUrl)
  }
  if (isRemoteHttpsUrl(trimmed)) return trimmed

  requireBackendUpload()
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
