import type { AppSettings } from '@/types/settings'
import type { WorkflowShot } from '@/types/workflow'
import { createMockGeneratedImage, generateImage } from '@/lib/models/image-client'
import { readSettings } from '@/lib/storage/settings-service'
import { resolveProjectMediaDir, resolveProjectRoot } from '@/lib/storage/project-paths'
import { toProjectRelativeMediaPath, normalizeRemoteMediaUrl, isRemoteMediaReference } from '@/lib/storage/media-path-resolver'
import { saveGeneratedImageFromUrl } from '@/lib/storage/fs-service'
import { shouldUseE2eMockAi, getE2eMockDelayMs, shouldE2eMockFail, createE2eMockFailError } from '@/lib/e2e/e2e-mock-ai'
import { isWorkflowApiAvailable } from '@/lib/storage/workflow-service'
import { pickMergedImageModel } from '@/lib/models/merged-model-picker'
import {
  normalizeImageGenerationTierParams,
  resolveStoryboardImageTierPrefs,
} from '@/lib/models/image-generation-tier-params'
import {
  buildImageFieldsFromPaths,
  getGeneratedImagePaths,
  getReferenceImagePaths,
} from '@/lib/workflow/asset-utils'
import {
  collectReferencedAssetImagePaths,
  enrichPromptWithMentions,
  type MentionCandidate,
} from '@/lib/workflow/mention-utils'
import { resolveReferenceImagesForGeneration } from '@/lib/workflow/reference-image-upload'
import { canUseBackendFileUpload } from '@/lib/auth/login-mode'
import { saveProjectMediaFromDataUrl } from '@/lib/workflow/project-media-save'
import { resolveStylePresetValue } from '@/lib/workflow/style-presets'
import {
  buildShotImagePrompt,
  normalizeInferenceFormat,
  resolveImageSizeForInferenceFormat,
  type InferenceFormat,
} from '@/lib/workflow/shot-image-prompt'

export class GenerationCancelledError extends Error {
  constructor() {
    super('已停止生成')
    this.name = 'GenerationCancelledError'
  }
}

export function isGenerationCancelledError(error: unknown): boolean {
  if (error instanceof GenerationCancelledError) return true
  return error instanceof DOMException && error.name === 'AbortError'
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new GenerationCancelledError()
}

function delayWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new GenerationCancelledError())
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new GenerationCancelledError())
      },
      { once: true },
    )
  })
}

/** 生图前快照，用于停止生成时恢复原有分镜图 */
export function snapshotShotImageGenerationState(shot: WorkflowShot): Partial<WorkflowShot> {
  return {
    status: shot.status,
    validated: shot.validated,
    validatedImagePath: shot.validatedImagePath,
    validatedImagePaths: shot.validatedImagePaths,
    referenceImagePath: shot.referenceImagePath,
    referenceImagePaths: shot.referenceImagePaths,
    generatedImagePath: shot.generatedImagePath,
    generatedImagePaths: shot.generatedImagePaths,
    primaryGeneratedImageIndex: shot.primaryGeneratedImageIndex,
    selectedReferenceImageIndex: shot.selectedReferenceImageIndex,
  }
}

export function restoreShotAfterGenerationCancel(snapshot: Partial<WorkflowShot>): Partial<WorkflowShot> {
  return { ...snapshot }
}

async function resolveSettingsContext(settings?: AppSettings) {
  const res = await readSettings()
  return {
    settings: settings ?? res.data,
    appDataDir: res.appDataDir,
  }
}

function buildGenerationPrompt(
  shot: WorkflowShot,
  options: {
    inferenceFormat?: InferenceFormat | string | null
    stylePrefix?: string
    promptPrefix?: string
    promptSuffix?: string
    scriptText?: string
    previousShot?: WorkflowShot | null
    episodeShots?: WorkflowShot[]
    mentionCandidates?: MentionCandidate[]
  },
): string {
  let workingShot = shot
  if (options.mentionCandidates?.length) {
    const enrichedPrompt = enrichPromptWithMentions(shot.prompt || '', options.mentionCandidates)
    const enrichedAnchor = shot.spatialAnchor
      ? enrichPromptWithMentions(shot.spatialAnchor, options.mentionCandidates)
      : shot.spatialAnchor
    workingShot = {
      ...shot,
      prompt: enrichedPrompt,
      spatialAnchor: enrichedAnchor,
    }
  }

  return buildShotImagePrompt({
    shot: workingShot,
    inferenceFormat: normalizeInferenceFormat(options.inferenceFormat),
    styleText: options.stylePrefix,
    promptPrefix: options.promptPrefix,
    promptSuffix: options.promptSuffix,
    scriptText: options.scriptText,
    previousShot: options.previousShot,
    episodeShots: options.episodeShots,
  })
}

/** 分镜生图参考图：分镜上传参考图 + 提示词 @ 引用资产预览图 */
export function collectShotGenerationReferencePaths(
  shot: WorkflowShot,
  candidates: MentionCandidate[] = [],
): string[] {
  const paths: string[] = []
  const seen = new Set<string>()
  const push = (value?: string) => {
    const text = value?.trim()
    if (!text || seen.has(text)) return
    seen.add(text)
    paths.push(text)
  }

  for (const path of getReferenceImagePaths(shot)) push(path)

  const referencedIds = shot.referencedAssetIds ?? []
  for (const path of collectReferencedAssetImagePaths(referencedIds, candidates)) push(path)

  return paths
}

async function resolveShotReferenceImageUrls(
  shot: WorkflowShot,
  options?: {
    settings?: AppSettings
    projectId?: string
    appDataDir?: string
    mentionCandidates?: MentionCandidate[]
  },
): Promise<string[] | undefined> {
  const refPaths = collectShotGenerationReferencePaths(shot, options?.mentionCandidates ?? [])
  if (!refPaths.length) return undefined

  const settings = options?.settings
  const projectRoot =
    options?.projectId && settings
      ? resolveProjectRoot(settings, options.appDataDir ?? '', options.projectId)
      : undefined

  const urls = await resolveReferenceImagesForGeneration(refPaths, {
    apiBaseUrl: canUseBackendFileUpload() ? settings?.apiBaseUrl : undefined,
    projectRoot,
    label: `shot_${shot.shotNumber}`,
  })
  return urls.length ? urls : undefined
}

export async function generateShotImage(
  shot: WorkflowShot,
  options?: {
    settings?: AppSettings
    projectId?: string
    appDataDir?: string
    imageSize?: string
    imageSizePreset?: string
    projectStyleKey?: string
    inferenceFormat?: InferenceFormat | string | null
    promptPrefix?: string
    promptSuffix?: string
    scriptText?: string
    previousShot?: WorkflowShot | null
    episodeShots?: WorkflowShot[]
    mentionCandidates?: MentionCandidate[]
    signal?: AbortSignal
  },
): Promise<string> {
  const { settings, appDataDir } = await resolveSettingsContext(options?.settings)
  const signal = options?.signal
  assertNotAborted(signal)
  if (!shot.prompt?.trim()) {
    throw new Error(`镜号 ${shot.shotNumber} 请先填写分镜提示词`)
  }
  const stylePrefix = resolveStylePresetValue(undefined, options?.projectStyleKey, settings)
  const inferenceFormat = normalizeInferenceFormat(options?.inferenceFormat)
  const prompt = buildGenerationPrompt(shot, {
    inferenceFormat,
    stylePrefix,
    promptPrefix: options?.promptPrefix,
    promptSuffix: options?.promptSuffix,
    scriptText: options?.scriptText,
    previousShot: options?.previousShot,
    episodeShots: options?.episodeShots,
    mentionCandidates: options?.mentionCandidates,
  })
  const apiSize = resolveImageSizeForInferenceFormat(
    inferenceFormat,
    options?.imageSizePreset || options?.imageSize || '2k-16:9',
  )

  if (!isWorkflowApiAvailable() || shouldUseE2eMockAi()) {
    await delayWithAbort(getE2eMockDelayMs(900), signal)
    if (shouldE2eMockFail('shot-image')) {
      throw createE2eMockFailError('shot-image')
    }
    const mockUrl = createMockGeneratedImage(`镜${shot.shotNumber}`)
    if (options?.projectId) {
      return saveProjectMediaFromDataUrl({
        settings,
        appDataDir: options.appDataDir || appDataDir,
        projectId: options.projectId,
        dataUrl: mockUrl,
        entityId: shot.id,
        target: 'shot',
        purpose: 'gen',
        ext: '.svg',
      })
    }
    return mockUrl
  }

  const model = pickMergedImageModel(settings)
  const tierParams = normalizeImageGenerationTierParams(
    model,
    null,
    resolveStoryboardImageTierPrefs(settings),
  )
  const referenceImageUrls = await resolveShotReferenceImageUrls(shot, {
    settings,
    projectId: options?.projectId,
    appDataDir: options?.appDataDir || appDataDir,
    mentionCandidates: options?.mentionCandidates,
  })

  assertNotAborted(signal)
  const remoteUrl = await generateImage(
    model,
    prompt,
    apiSize,
    referenceImageUrls,
    signal,
    'consume_image',
    tierParams,
  )
  const normalizedRemoteUrl = normalizeRemoteMediaUrl(remoteUrl)

  const saveDir = options?.projectId
    ? resolveProjectMediaDir(settings, options.appDataDir || appDataDir, options.projectId, 'shot')
    : settings.generatedImagesPath

  assertNotAborted(signal)
  const saved = await saveGeneratedImageFromUrl(normalizedRemoteUrl, saveDir)
  if (!saved.success || !saved.filePath) {
    if (options?.projectId) {
      throw new Error(saved.error || '分镜图保存到项目目录失败，请检查数据根目录权限')
    }
    return normalizedRemoteUrl
  }
  const filePath = saved.filePath
  if (
    options?.projectId &&
    filePath &&
    !filePath.startsWith('data:') &&
    !isRemoteMediaReference(filePath)
  ) {
    const projectRoot = resolveProjectRoot(
      settings,
      options.appDataDir || appDataDir,
      options.projectId,
    )
    return toProjectRelativeMediaPath(filePath, projectRoot)
  }
  if (options?.projectId) {
    throw new Error('分镜图未能保存到本地，请重试')
  }
  if (isRemoteMediaReference(filePath)) {
    return normalizeRemoteMediaUrl(filePath)
  }
  return filePath
}

export async function generateShotImageBatch(
  shots: WorkflowShot[],
  options?: {
    settings?: AppSettings
    projectId?: string
    appDataDir?: string
    imageSize?: string
    mentionCandidates?: MentionCandidate[]
    onProgress?: (done: number, total: number) => void
  },
): Promise<Record<string, string>> {
  const results: Record<string, string> = {}
  let done = 0
  for (const shot of shots) {
    if (!shot.prompt.trim()) continue
    try {
      results[shot.id] = await generateShotImage(shot, options)
    } catch {
      // 单镜失败不中断批量，由调用方标记 failed
    }
    done += 1
    options?.onProgress?.(done, shots.length)
  }
  return results
}

export function appendShotGeneratedImage(shot: WorkflowShot, imagePath: string): Partial<WorkflowShot> {
  const gens = [...getGeneratedImagePaths(shot as Parameters<typeof getGeneratedImagePaths>[0]), imagePath]
  return {
    ...buildImageFieldsFromPaths([], gens, gens.length - 1),
    status: 'done' as const,
  }
}
