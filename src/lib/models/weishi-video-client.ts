/** 对齐 haode-ai-client weishiVideo：创建 body、轮询、参考图解析 */

import type { ModelConfig } from '@/types/settings'
import { normalizeApiBase } from '@/lib/models/model-endpoint'
import {
  buildVideoEndpointFromBaseUrl,
  pickFirstRatio,
} from '@/lib/models/video-model-utils'
import {
  resolveAudioBlobForWeishiUpload,
  resolveImageBlobForWeishiUpload,
  uploadWeishiMediaAssetReference,
} from '@/lib/models/weishi-asset-service'
import {
  formatWeishiVideoMetadataResolution,
  resolveEffectiveWeishiReferenceMediaUploadMode,
  resolveWeishiReferenceAudioUploadMode,
  resolveWeishiReferenceImageUploadMode,
  pickWeishiVideoDurationSec,
  type WeishiReferenceMediaUploadMode,
} from '@/lib/models/weishi-model-presets'
import type { VideoReferenceMode } from '@/lib/workflow/storyboard-video-presets'
import {
  formatVideoTaskProgress,
  isVideoTaskFailed,
  isVideoTaskSuccess,
  parseVideoPollPayload,
  VIDEO_PROGRESS_COMPLETED,
  VIDEO_PROGRESS_CREATING,
  VIDEO_PROGRESS_SUBMITTED,
  VIDEO_PROGRESS_UPLOADING,
  type VideoProgressCallback,
} from '@/lib/video/video-progress'
import {
  assertNotAborted,
  delayWithAbort,
  mergeFetchSignal,
} from '@/lib/video/video-generation-abort'
import { resolveWeishiApiKey } from '@/lib/auth/org-weishi-key'
import { assertSeedance20WeishiVideoLimits } from '@/lib/models/weishi-video-preflight'
import {
  resolveWeishiVideoImageRole,
  type ShotVideoReferenceKind,
} from '@/lib/workflow/shot-video-utils'
import { VIDEO_POLL_INTERVAL_MS } from '@/constants/batch-concurrency'

async function withResolvedWeishiApiKey<T extends { model: ModelConfig; apiBaseUrl?: string }>(
  input: T,
): Promise<T & { model: ModelConfig }> {
  const apiKey = await resolveWeishiApiKey({
    model: input.model,
    apiBase: input.apiBaseUrl,
  })
  return { ...input, model: { ...input.model, apiKey } }
}

const VIDEOS_SUFFIX = '/v1/videos'
const POLL_TIMEOUT_MS = 30 * 60 * 1000

/** 同一会话内同路径 → asset://，避免分镜图/参考图重复上传 */
const weishiUploadedPathCache = new Map<string, string>()

function weishiUploadCacheKey(endpoint: string, imagePath: string): string {
  return `${String(endpoint || '').trim()}::${imagePath.replace(/\\/g, '/')}`
}

export interface WeishiVideoReferenceItem {
  type: 'image_url' | 'audio_url' | 'video_url'
  url: string
  role?: string
}

export interface WeishiVideoCreateParams {
  model?: string
  prompt?: string
  duration?: number
  ratio?: string
  resolution?: string
  references?: WeishiVideoReferenceItem[]
  /** false 时写入 metadata.generate_audio（完全无声模式） */
  generateAudio?: boolean
}

/** POST /v1/videos body.metadata 扩展字段（对齐微视 API） */
export interface WeishiVideoMetadata {
  callback_url?: string
  return_last_frame?: boolean
  service_tier?: string
  execution_expires_after?: number
  generate_audio?: boolean
  draft?: boolean
  resolution?: string
  ratio?: string
  duration?: number
  frames?: number
  seed?: number
  camera_fixed?: boolean
}

export interface WeishiVideoGenerateInput {
  model: ModelConfig
  prompt: string
  durationSec?: number
  aspectRatio?: string
  /** UI 分辨率：480 / 720 / 1080，写入 metadata.resolution */
  resolution?: string
  /** @deprecated 请使用 referenceImagePaths */
  referenceImagePath?: string | null
  /** 按参考模式收集的本地/asset 路径，会逐一上传为 asset:// */
  referenceImagePaths?: string[]
  /** 参考图展示标签（对齐画镜 E2，含 kind / 已缓存 asset://） */
  referenceImageItems?: Array<{
    label: string
    path: string
    kind?: ShotVideoReferenceKind
    weishiAssetUrl?: string
  }>
  /** 视频参考音频本地路径，生视频前上传至后台获取公网 URL */
  referenceAudioPaths?: string[]
  referenceAudioItems?: Array<{ label: string; path: string }>
  referenceMode?: VideoReferenceMode
  projectRoot?: string
  apiBaseUrl?: string
  /** 参考图/音频上传方式（settings.weishiReferenceMediaUploadMode） */
  referenceMediaUploadMode?: WeishiReferenceMediaUploadMode
  /** 确认弹窗前已上传的参考图，避免重复上传 */
  preparedReferences?: WeishiVideoReferenceItem[]
  /** 完全无声：不上传参考音频，且 metadata.generate_audio=false */
  generateAudio?: boolean
  abortSignal?: AbortSignal
}

export interface PreparedWeishiVideoRequest {
  preview: WeishiVideoRequestPreview
  preparedReferences: WeishiVideoReferenceItem[]
  reusedWeishiImageCount?: number
}

export interface WeishiVideoRequestPreview {
  method: 'POST'
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
  context: {
    modelName: string
    modelId: string
    shotNumber?: number
    referenceMode?: string
    referenceModeLabel?: string
    durationSec: number
    aspectRatio: string
    resolution?: string
    referenceImagePath?: string | null
    referenceImagePaths?: string[]
    referenceImageItems?: Array<{
      label: string
      path: string
      kind?: ShotVideoReferenceKind
      weishiAssetUrl?: string
    }>
    referenceAudioItems?: Array<{ label: string; path: string }>
    referenceNote?: string
    batchCount?: number
  }
}

function buildWeishiReferenceDisplayItems(
  input: WeishiVideoGenerateInput & {
    referenceImageItems?: Array<{
      label: string
      path: string
      kind?: ShotVideoReferenceKind
      weishiAssetUrl?: string
    }>
    referenceAudioItems?: Array<{ label: string; path: string }>
  },
  references: WeishiVideoReferenceItem[],
): {
  referenceImageItems?: Array<{
    label: string
    path: string
    kind?: ShotVideoReferenceKind
    weishiAssetUrl?: string
  }>
  referenceImagePaths?: string[]
  referenceAudioItems?: Array<{ label: string; path: string }>
} {
  const imageRefs = references.filter((item) => item.type === 'image_url')
  const audioRefs = references.filter((item) => item.type === 'audio_url')

  const referenceImageItems = input.referenceImageItems?.length
    ? input.referenceImageItems.map((item, index) => ({
        ...item,
        path: imageRefs[index]?.url || item.weishiAssetUrl || item.path,
      }))
    : undefined

  const refPaths = resolveWeishiReferenceImagePaths(input)
  const referenceImagePaths = referenceImageItems?.length
    ? referenceImageItems.map((item) => item.path)
    : refPaths.map((path, index) => imageRefs[index]?.url || path)

  const referenceAudioItems = input.referenceAudioItems?.length
    ? input.referenceAudioItems.map((item, index) => ({
        ...item,
        path: audioRefs[index]?.url || item.path,
      }))
    : undefined

  return { referenceImageItems, referenceImagePaths, referenceAudioItems }
}

function buildWeishiVideoRequestPreviewFromRefs(
  input: WeishiVideoGenerateInput & {
    referenceMode?: string
    referenceModeLabel?: string
    shotNumber?: number
    batchCount?: number
    referenceImageItems?: Array<{
      label: string
      path: string
      kind?: ShotVideoReferenceKind
      weishiAssetUrl?: string
    }>
    referenceAudioItems?: Array<{ label: string; path: string }>
  },
  references: WeishiVideoReferenceItem[],
  reusedImageCount = 0,
): WeishiVideoRequestPreview {
  const createUrl = resolveWeishiCreateUrl(input.model)
  const refPaths = resolveWeishiReferenceImagePaths(input)
  const refPath = refPaths[0] ?? null
  const imageRefs = references.filter((item) => item.type === 'image_url')
  const durationSec = pickWeishiVideoDurationSec(input.durationSec)
  const aspectRatio = input.aspectRatio ?? pickFirstRatio(input.model)
  const metadataResolution = formatWeishiVideoMetadataResolution(input.resolution)
  const generateAudio = input.generateAudio !== false
  const body = buildWeishiVideoCreateBody({
    model: input.model.model,
    prompt: input.prompt,
    duration: durationSec,
    ratio: aspectRatio,
    resolution: metadataResolution,
    references,
    generateAudio,
  })

  const displayRefs = buildWeishiReferenceDisplayItems(input, references)

  return {
    method: 'POST',
    url: createUrl,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ***',
    },
    body,
    context: {
      modelName: input.model.name || input.model.model || '微视 API',
      modelId: input.model.model || '',
      shotNumber: input.shotNumber,
      referenceMode: input.referenceMode,
      referenceModeLabel: input.referenceModeLabel,
      durationSec,
      aspectRatio,
      resolution: metadataResolution,
      referenceImagePath: displayRefs.referenceImagePaths?.[0] ?? imageRefs[0]?.url ?? refPath,
      referenceImagePaths: displayRefs.referenceImagePaths?.length
        ? displayRefs.referenceImagePaths
        : undefined,
      referenceImageItems: displayRefs.referenceImageItems?.length
        ? displayRefs.referenceImageItems
        : undefined,
      referenceAudioItems: displayRefs.referenceAudioItems?.length
        ? displayRefs.referenceAudioItems
        : undefined,
      referenceNote: buildWeishiReferenceNote(references, reusedImageCount),
      batchCount: input.batchCount,
    },
  }
}

function buildWeishiReferenceNote(
  references: WeishiVideoReferenceItem[],
  reusedImageCount = 0,
): string | undefined {
  const imageRefs = references.filter((item) => item.type === 'image_url')
  const audioRefs = references.filter((item) => item.type === 'audio_url')
  const assetImageCount = imageRefs.filter((item) => /^asset:\/\//i.test(item.url)).length
  const httpsImageCount = imageRefs.filter((item) => /^https:\/\//i.test(item.url)).length
  const parts: string[] = []

  if (assetImageCount > 0) {
    const uploadCount = Math.max(0, assetImageCount - reusedImageCount)
    if (reusedImageCount > 0 && uploadCount > 0) {
      parts.push(
        `角色参考 ${reusedImageCount} 张复用 asset://，新上传 ${uploadCount} 张至 /v1/assets`,
      )
    } else if (reusedImageCount > 0) {
      parts.push(`角色参考 ${reusedImageCount} 张复用 asset://（免上传）`)
    } else {
      parts.push(`角色参考 ${assetImageCount} 张已上传至 /v1/assets`)
    }
  }
  if (httpsImageCount > 0) {
    parts.push(`场景/道具/分镜等 ${httpsImageCount} 张已上传至后台 https`)
  }
  if (audioRefs.length > 0) {
    parts.push(`参考音频 ${audioRefs.length} 个已上传至后台 https`)
  }
  return parts.length ? parts.join('；') : undefined
}

/** 上传参考图/音频后构建确认弹窗预览（展示真实 asset:// / URL） */
export async function prepareWeishiVideoRequestPreview(
  input: WeishiVideoGenerateInput & {
    referenceMode?: string
    referenceModeLabel?: string
    shotNumber?: number
    batchCount?: number
    referenceImageItems?: Array<{
      label: string
      path: string
      kind?: ShotVideoReferenceKind
      weishiAssetUrl?: string
    }>
    referenceAudioItems?: Array<{ label: string; path: string }>
  },
  onProgress?: VideoProgressCallback,
): Promise<PreparedWeishiVideoRequest> {
  onProgress?.(VIDEO_PROGRESS_UPLOADING)
  const collected = input.preparedReferences?.length
    ? { references: input.preparedReferences, reusedImageCount: 0 }
    : await collectWeishiReferences(input)
  return {
    preview: buildWeishiVideoRequestPreviewFromRefs(
      input,
      collected.references,
      collected.reusedImageCount,
    ),
    preparedReferences: collected.references,
    reusedWeishiImageCount: collected.reusedImageCount,
  }
}

/** @deprecated 仅用于已是 asset:// 的同步预览；生视频确认请用 prepareWeishiVideoRequestPreview */
export function buildWeishiVideoRequestPreview(
  input: WeishiVideoGenerateInput & {
    referenceMode?: string
    referenceModeLabel?: string
    shotNumber?: number
    batchCount?: number
    referenceImageItems?: Array<{
      label: string
      path: string
      kind?: ShotVideoReferenceKind
      weishiAssetUrl?: string
    }>
    referenceAudioItems?: Array<{ label: string; path: string }>
  },
): WeishiVideoRequestPreview {
  const refPaths = resolveWeishiReferenceImagePaths(input)
  const references: WeishiVideoReferenceItem[] = refPaths
    .filter((path) => /^asset:\/\//i.test(path))
    .map((url) => ({ type: 'image_url', url, role: 'reference_image' }))
  return buildWeishiVideoRequestPreviewFromRefs(input, references)
}

function resolveWeishiReferenceImagePaths(input: WeishiVideoGenerateInput): string[] {
  const fromList = (input.referenceImagePaths ?? [])
    .map((path) => String(path || '').trim())
    .filter(Boolean)
  if (fromList.length) return fromList
  const single = input.referenceImagePath?.trim()
  return single ? [single] : []
}

function countPlannedWeishiReferenceImages(input: WeishiVideoGenerateInput): number {
  if (input.referenceImageItems?.length) {
    return input.referenceImageItems
      .map((item) => String(item.path || '').trim())
      .filter(Boolean).length
  }
  return resolveWeishiReferenceImagePaths(input).length
}

async function assertWeishiVideoPreflight(input: WeishiVideoGenerateInput): Promise<void> {
  await assertSeedance20WeishiVideoLimits({
    modelName: input.model.model,
    referenceImageCount: countPlannedWeishiReferenceImages(input),
    referenceAudioPaths: input.referenceAudioPaths,
    generateAudio: input.generateAudio,
  })
}

function omitEmpty<T extends Record<string, unknown>>(row: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined && value !== ''),
  ) as Partial<T>
}

export function resolveWeishiCreateUrl(
  model: Pick<ModelConfig, 'endpoint' | 'baseUrl' | 'apiFormat'>,
): string {
  const endpoint = normalizeApiBase(model.endpoint)
  if (endpoint) {
    if (endpoint.toLowerCase().endsWith(VIDEOS_SUFFIX)) return endpoint
    return `${endpoint}${VIDEOS_SUFFIX}`
  }
  const fromBase = buildVideoEndpointFromBaseUrl(model.baseUrl || '', model)
  if (fromBase) return fromBase
  throw new Error('微视视频模型未配置 API 地址')
}

export function buildWeishiStatusUrl(createUrl: string, taskId: string): string {
  const base = normalizeApiBase(createUrl).replace(/\/v1\/videos$/i, '')
  const id = encodeURIComponent(String(taskId || '').trim())
  return `${base}${VIDEOS_SUFFIX}/${id}`
}

export function buildWeishiContentUrl(createUrl: string, taskId: string): string {
  return `${buildWeishiStatusUrl(createUrl, taskId)}/content`
}

export function extractWeishiTaskId(payload: Record<string, unknown>): string {
  const nested = payload.data as Record<string, unknown> | undefined
  return String(
    payload.id ??
      payload.task_id ??
      payload.taskId ??
      nested?.id ??
      nested?.task_id ??
      '',
  ).trim()
}

export function extractWeishiVideoUrl(payload: Record<string, unknown>): string {
  const nested = payload.data as Record<string, unknown> | undefined
  const metadata = (payload.metadata ?? nested?.metadata) as Record<string, unknown> | undefined
  return String(
    payload.url ??
      payload.video_url ??
      payload.output_url ??
      nested?.url ??
      nested?.video_url ??
      metadata?.url ??
      '',
  ).trim()
}

export function parseWeishiPollStatus(payload: Record<string, unknown>) {
  return parseVideoPollPayload(payload)
}

/** @deprecated 使用 formatVideoTaskProgress */
export function formatWeishiVideoProgress(status: string, progress?: number) {
  return formatVideoTaskProgress(status, progress)
}

function isWeishiTerminalSuccess(status: string): boolean {
  return isVideoTaskSuccess(status)
}

function isWeishiTerminalFailed(status: string): boolean {
  return isVideoTaskFailed(status)
}

export function buildWeishiVideoCreateBody(params: WeishiVideoCreateParams): Record<string, unknown> {
  const prompt = String(params.prompt || '').trim()
  const content: Array<Record<string, unknown>> = []

  if (prompt) {
    content.push({ type: 'text', text: prompt })
  }

  for (const ref of params.references ?? []) {
    const url = normalizeWeishiContentMediaUrl(String(ref.url || '').trim())
    if (!url) continue
    if (ref.type === 'image_url') {
      content.push({
        type: 'image_url',
        image_url: { url },
        role: ref.role || 'reference_image',
      })
    } else if (ref.type === 'audio_url') {
      content.push({
        type: 'audio_url',
        audio_url: { url },
        role: ref.role || 'reference_audio',
      })
    } else if (ref.type === 'video_url') {
      content.push({
        type: 'video_url',
        video_url: { url },
        role: ref.role || 'reference_video',
      })
    }
  }

  const metadata = omitEmpty({
    duration: params.duration ? Number(params.duration) : undefined,
    ratio: params.ratio?.trim() || undefined,
    resolution: params.resolution?.trim() || undefined,
    generate_audio: params.generateAudio === false ? false : undefined,
  } satisfies WeishiVideoMetadata)

  const body: Record<string, unknown> = {
    model: String(params.model || 'seedance-2.0').trim() || 'seedance-2.0',
  }

  if (content.length > 0) {
    body.content = content
  } else if (prompt) {
    body.prompt = prompt
  }

  if (Object.keys(metadata).length > 0) {
    body.metadata = metadata
  }

  return body
}

async function uploadWeishiAssetReferenceUrl(
  imagePath: string,
  options: {
    model: ModelConfig
    projectRoot?: string
    label?: string
  },
): Promise<string> {
  const { blob, filename } = await resolveImageBlobForWeishiUpload(imagePath, {
    projectRoot: options.projectRoot,
    label: options.label ?? 'storyboard',
  })
  return uploadWeishiMediaAssetReference({
    endpoint: options.model.endpoint || '',
    apiKey: options.model.apiKey || '',
    blob,
    filename,
    assetType: 'image',
  })
}

async function uploadWeishiAssetReferenceAudioUrl(
  audioPath: string,
  options: {
    model: ModelConfig
    projectRoot?: string
    label?: string
  },
): Promise<string> {
  const { blob, filename } = await resolveAudioBlobForWeishiUpload(audioPath, {
    projectRoot: options.projectRoot,
    label: options.label ?? 'weishi_ref_audio',
  })
  return uploadWeishiMediaAssetReference({
    endpoint: options.model.endpoint || '',
    apiKey: options.model.apiKey || '',
    blob,
    filename,
    assetType: 'audio',
  })
}

function normalizeWeishiContentMediaUrl(url: string): string {
  const trimmed = url.trim()
  if (/^asset:\/\//i.test(trimmed)) return trimmed
  if (/^https:\/\//i.test(trimmed)) return trimmed
  if (/^data:/i.test(trimmed)) return trimmed
  if (/^http:\/\//i.test(trimmed)) {
    throw new Error(
      '微视 API 不支持 http 媒体地址，请重新上传参考音频/图片（应使用 asset:// 引用）',
    )
  }
  return trimmed
}

async function resolveWeishiReferenceImageUrl(
  ref: string,
  options: {
    model: ModelConfig
    projectRoot?: string
    apiBaseUrl?: string
    label?: string
    cachedAssetUrl?: string
    uploadMode?: WeishiReferenceMediaUploadMode
  },
): Promise<string> {
  const trimmed = ref.trim()
  if (!trimmed) throw new Error('缺少首帧参考图')

  const uploadMode =
    options.uploadMode ??
    resolveEffectiveWeishiReferenceMediaUploadMode(undefined, options.model)
  const cachedAsset = String(options.cachedAssetUrl || '').trim()
  if (uploadMode === 'weishi_asset' && /^asset:\/\//i.test(cachedAsset)) return cachedAsset

  if (uploadMode === 'weishi_asset' && /^asset:\/\//i.test(trimmed)) return trimmed

  const cacheKey = weishiUploadCacheKey(options.model.endpoint || '', trimmed)
  const sessionCached = weishiUploadedPathCache.get(cacheKey)
  if (sessionCached) {
    if (/^asset:\/\//i.test(sessionCached)) return sessionCached
    if (sessionCached.startsWith('http://')) weishiUploadedPathCache.delete(cacheKey)
  }

  const url = await uploadWeishiAssetReferenceUrl(trimmed, options)
  weishiUploadedPathCache.set(cacheKey, url)
  return normalizeWeishiContentMediaUrl(url)
}

async function resolveWeishiReferenceAudioUrl(
  ref: string,
  options: {
    model: ModelConfig
    projectRoot?: string
    apiBaseUrl?: string
    label?: string
    uploadMode?: WeishiReferenceMediaUploadMode
  },
): Promise<string> {
  const trimmed = ref.trim()
  if (!trimmed) throw new Error('缺少参考音频')

  if (/^asset:\/\//i.test(trimmed)) return trimmed

  const cacheKey = weishiUploadCacheKey(options.model.endpoint || '', trimmed)
  const sessionCached = weishiUploadedPathCache.get(cacheKey)
  if (sessionCached) {
    if (/^asset:\/\//i.test(sessionCached)) return sessionCached
    if (sessionCached.startsWith('http://')) weishiUploadedPathCache.delete(cacheKey)
  }

  const url = await uploadWeishiAssetReferenceAudioUrl(trimmed, options)

  weishiUploadedPathCache.set(cacheKey, url)
  return normalizeWeishiContentMediaUrl(url)
}

export async function collectWeishiReferences(
  input: WeishiVideoGenerateInput,
): Promise<{ references: WeishiVideoReferenceItem[]; reusedImageCount: number }> {
  const resolved = await withResolvedWeishiApiKey(input)
  await assertWeishiVideoPreflight(resolved)
  const mode = resolved.referenceMode ?? 'multimodal'
  const itemMeta = new Map(
    (input.referenceImageItems ?? []).map((item) => [
      String(item.path || '').trim(),
      item.weishiAssetUrl,
    ]),
  )

  const imageItems: Array<{ path: string; kind: ShotVideoReferenceKind; weishiAssetUrl?: string }> =
    input.referenceImageItems?.length
      ? input.referenceImageItems
          .map((item) => ({
            path: String(item.path || '').trim(),
            kind: item.kind ?? 'shot_reference',
            weishiAssetUrl: item.weishiAssetUrl,
          }))
          .filter((item) => item.path)
      : resolveWeishiReferenceImagePaths(input).map((path, index) => ({
          path,
          kind: (index === 0 ? 'storyboard' : 'shot_reference') as ShotVideoReferenceKind,
          weishiAssetUrl: itemMeta.get(path),
        }))

  const audioPaths = input.generateAudio === false
    ? []
    : (input.referenceAudioPaths ?? [])
        .map((path) => String(path || '').trim())
        .filter(Boolean)

  const refs: WeishiVideoReferenceItem[] = []
  let reusedImageCount = 0

  for (let index = 0; index < imageItems.length; index += 1) {
    assertNotAborted(input.abortSignal)
    const item = imageItems[index]
    const refMeta = input.referenceImageItems?.find(
      (row) => String(row.path || '').trim() === item.path,
    )
    const itemUploadMode = resolveWeishiReferenceImageUploadMode(
      { kind: item.kind, label: refMeta?.label ?? '' },
      resolved.model,
      resolved.referenceMediaUploadMode,
    )
    const cachedAssetUrl =
      itemUploadMode === 'weishi_asset' ? item.weishiAssetUrl?.trim() : undefined
    const cacheKey = weishiUploadCacheKey(resolved.model.endpoint || '', item.path)
    const hadAssetCache = Boolean(cachedAssetUrl && /^asset:\/\//i.test(cachedAssetUrl))
    const hadSessionCache =
      itemUploadMode === 'weishi_asset' &&
      !hadAssetCache &&
      weishiUploadedPathCache.has(cacheKey)

    const url = await resolveWeishiReferenceImageUrl(item.path, {
      model: resolved.model,
      projectRoot: resolved.projectRoot,
      apiBaseUrl: resolved.apiBaseUrl,
      label: refMeta?.label || (index === 0 ? 'storyboard' : `storyboard_ref_${index + 1}`),
      cachedAssetUrl,
      uploadMode: itemUploadMode,
    })

    if (hadAssetCache || hadSessionCache) reusedImageCount += 1

    refs.push({
      type: 'image_url',
      url,
      role: resolveWeishiVideoImageRole(item, mode),
    })
  }

  const audioUploadMode = resolveWeishiReferenceAudioUploadMode(
    resolved.model,
    resolved.referenceMediaUploadMode,
  )

  for (let index = 0; index < audioPaths.length; index += 1) {
    assertNotAborted(input.abortSignal)
    const path = audioPaths[index]
    const url = await resolveWeishiReferenceAudioUrl(path, {
      model: resolved.model,
      projectRoot: resolved.projectRoot,
      apiBaseUrl: resolved.apiBaseUrl,
      label: `storyboard_audio_${index + 1}`,
      uploadMode: audioUploadMode,
    })
    refs.push({ type: 'audio_url', url, role: 'reference_audio' })
  }

  return { references: refs, reusedImageCount }
}

export async function createWeishiVideoTask(
  input: WeishiVideoGenerateInput,
  abortSignal?: AbortSignal,
): Promise<{ taskId: string; videoUrl: string; createUrl: string }> {
  const resolved = await withResolvedWeishiApiKey(input)
  const effectiveSignal = abortSignal ?? resolved.abortSignal
  assertNotAborted(effectiveSignal)
  const createUrl = resolveWeishiCreateUrl(resolved.model)
  const references =
    resolved.preparedReferences?.length
      ? resolved.preparedReferences
      : (await collectWeishiReferences({ ...resolved, abortSignal: effectiveSignal })).references

  if (resolved.preparedReferences?.length) {
    await assertSeedance20WeishiVideoLimits({
      modelName: resolved.model.model,
      referenceImageCount: references.filter((item) => item.type === 'image_url').length,
      referenceAudioPaths: resolved.referenceAudioPaths,
      generateAudio: resolved.generateAudio,
    })
  }
  const body = buildWeishiVideoCreateBody({
    model: resolved.model.model,
    prompt: resolved.prompt,
    duration: pickWeishiVideoDurationSec(resolved.durationSec),
    ratio: resolved.aspectRatio ?? pickFirstRatio(resolved.model),
    resolution: formatWeishiVideoMetadataResolution(resolved.resolution),
    references,
    generateAudio: resolved.generateAudio !== false,
  })

  const apiKey = resolved.model.apiKey?.trim()
  if (!apiKey) throw new Error('微视视频创建失败：缺少 API Key')

  const response = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: mergeFetchSignal(effectiveSignal, 120_000),
  })

  const text = await response.text()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`微视视频创建失败 (${response.status})：${text.slice(0, 200)}`)
  }

  if (!response.ok) {
    const msg =
      (data.error as { message?: string } | undefined)?.message ||
      (data.message as string) ||
      text.slice(0, 200)
    throw new Error(`微视视频创建失败 (${response.status})：${msg}`)
  }

  const taskId = extractWeishiTaskId(data)
  const videoUrl = extractWeishiVideoUrl(data)
  return { taskId, videoUrl, createUrl }
}

export async function pollWeishiVideoTask(
  apiKey: string,
  createUrl: string,
  taskId: string,
  onProgress?: VideoProgressCallback,
  abortSignal?: AbortSignal,
): Promise<string> {
  const statusUrl = buildWeishiStatusUrl(createUrl, taskId)
  const contentUrl = buildWeishiContentUrl(createUrl, taskId)
  const start = Date.now()
  let pollRound = 0

  while (Date.now() - start < POLL_TIMEOUT_MS) {
    assertNotAborted(abortSignal)
    pollRound += 1
    const response = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: mergeFetchSignal(abortSignal, 60_000),
    })
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
    if (!response.ok) {
      const msg =
        (data.error as { message?: string } | undefined)?.message ||
        (data.message as string) ||
        `HTTP ${response.status}`
      throw new Error(`微视视频查询失败：${msg}`)
    }

    const { status, progress, error } = parseWeishiPollStatus(data)
    onProgress?.(formatVideoTaskProgress(status, progress, pollRound))

    const directUrl = extractWeishiVideoUrl(data)
    if (isWeishiTerminalSuccess(status)) {
      onProgress?.(VIDEO_PROGRESS_COMPLETED)
      if (directUrl) return directUrl
      return contentUrl
    }
    if (directUrl && !status) return directUrl

    if (isWeishiTerminalFailed(status)) {
      throw new Error(
        error || `微视视频生成失败（${formatVideoTaskProgress(status, progress).message}）`,
      )
    }

    await delayWithAbort(VIDEO_POLL_INTERVAL_MS, abortSignal)
  }

  throw new Error('微视视频生成超时')
}

export async function generateWeishiVideo(
  input: WeishiVideoGenerateInput,
  onProgress?: VideoProgressCallback,
  callbacks?: {
    onRemoteJobCreated?: (payload: { apiTaskId: string; createUrl?: string }) => void | Promise<void>
  },
  abortSignal?: AbortSignal,
): Promise<string> {
  assertNotAborted(abortSignal)
  onProgress?.(VIDEO_PROGRESS_CREATING)
  const durationSec = pickWeishiVideoDurationSec(input.durationSec)
  const { taskId, videoUrl, createUrl } = await createWeishiVideoTask(input, abortSignal)

  if (taskId && callbacks?.onRemoteJobCreated) {
    await callbacks.onRemoteJobCreated({ apiTaskId: taskId, createUrl })
  }

  if (videoUrl) {
    onProgress?.(VIDEO_PROGRESS_COMPLETED)
    return videoUrl
  }
  if (!taskId) {
    throw new Error('微视视频 API 未返回任务 ID 或视频地址')
  }

  onProgress?.(VIDEO_PROGRESS_SUBMITTED)
  const apiKey =
    (await resolveWeishiApiKey({
      model: input.model,
      apiBase: input.apiBaseUrl,
    })) || ''
  return pollWeishiVideoTask(apiKey, createUrl, taskId, onProgress, abortSignal)
}
