import { IMAGE_BATCH_CONCURRENCY } from '@/constants/batch-concurrency'
import { shouldUseE2eMockAi, getE2eMockDelayMs, shouldE2eMockFail, createE2eMockFailError } from '@/lib/e2e/e2e-mock-ai'
import {
  GenerationCancelledError,
  isGenerationCancelledError,
} from '@/lib/workflow/shot-image-service'
import type { AppSettings } from '@/types/settings'
import type { WorkflowAsset } from '@/types/workflow'
import { createMockGeneratedImage, generateImage } from '@/lib/models/image-client'
import { readSettings } from '@/lib/storage/settings-service'
import { resolveAssetImageDir, resolveProjectRoot } from '@/lib/storage/project-paths'
import { toProjectRelativeMediaPath, normalizeRemoteMediaUrl, isRemoteMediaReference } from '@/lib/storage/media-path-resolver'
import { saveGeneratedImageFromUrl } from '@/lib/storage/fs-service'
import { isWorkflowApiAvailable } from '@/lib/storage/workflow-service'
import { pickMergedImageModel } from '@/lib/models/merged-model-picker'
import {
  normalizeImageGenerationTierParams,
  resolveAssetImageTierPrefs,
} from '@/lib/models/image-generation-tier-params'
import { buildAssetPrompt, getSelectedReferenceImagePath, validateAssetDescription } from '@/lib/workflow/asset-utils'
import { resolveLayoutPresetValue } from '@/lib/workflow/layout-presets'
import { saveProjectMediaFromDataUrl } from '@/lib/workflow/project-media-save'
import { canUseBackendFileUpload } from '@/lib/auth/login-mode'
import { uploadReferenceImageForGeneration } from '@/lib/workflow/reference-image-upload'
import { resolveStylePresetValue } from '@/lib/workflow/style-presets'

async function resolveSettingsContext(settings?: AppSettings) {
  const res = await readSettings()
  return {
    settings: settings ?? res.data,
    appDataDir: res.appDataDir,
  }
}

async function resolveReferenceImageUrls(
  asset: WorkflowAsset,
  options?: {
    apiBaseUrl?: string
    projectRoot?: string
    onReferencePhase?: (phase: 'start' | 'done') => void
  },
): Promise<string[] | undefined> {
  const selectedPath = getSelectedReferenceImagePath(asset)
  if (!selectedPath) return undefined

  options?.onReferencePhase?.('start')
  try {
    const publicUrl = await uploadReferenceImageForGeneration(selectedPath, {
      apiBaseUrl: canUseBackendFileUpload() ? options?.apiBaseUrl : undefined,
      label: asset.name?.trim() || 'reference',
      projectRoot: options?.projectRoot,
    })
    return [publicUrl]
  } finally {
    options?.onReferencePhase?.('done')
  }
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

export async function generateAssetImage(
  asset: WorkflowAsset,
  options?: {
    settings?: AppSettings
    projectId?: string
    appDataDir?: string
    projectStyleKey?: string
    imageSize?: string
    promptPrefix?: string
    promptSuffix?: string
    signal?: AbortSignal
    /** 参考图上传/校验阶段回调（用于顶部 toast，勿与整次生图绑定） */
    onReferencePhase?: (phase: 'start' | 'done') => void
  },
): Promise<string> {
  const { settings, appDataDir } = await resolveSettingsContext(options?.settings)
  const layoutValue = resolveLayoutPresetValue(
    asset.kind,
    asset.layoutKey,
    settings.defaultAssetLayoutKeys,
    settings,
  )
  const styleValue = resolveStylePresetValue(
    asset.styleKey,
    options?.projectStyleKey,
    settings,
  )
  const descriptionError = validateAssetDescription(asset)
  if (descriptionError) throw new Error(descriptionError)
  const prompt = buildAssetPrompt(asset, layoutValue, styleValue, {
    prefix: options?.promptPrefix,
    suffix: options?.promptSuffix,
  })
  if (!prompt.trim()) throw new Error(descriptionError ?? '描述为空，无法生图')

  if (!isWorkflowApiAvailable() || shouldUseE2eMockAi()) {
    await delayWithAbort(getE2eMockDelayMs(900), options?.signal)
    if (shouldE2eMockFail('asset-image')) {
      throw createE2eMockFailError('asset-image')
    }
    const mockUrl = createMockGeneratedImage(asset.name)
    if (options?.projectId) {
      return saveProjectMediaFromDataUrl({
        settings,
        appDataDir: options.appDataDir || appDataDir,
        projectId: options.projectId,
        dataUrl: mockUrl,
        entityId: asset.id,
        target: asset.kind,
        purpose: 'gen',
        ext: '.svg',
      })
    }
    return mockUrl
  }

  const projectRoot =
    options?.projectId
      ? resolveProjectRoot(settings, options.appDataDir || appDataDir, options.projectId)
      : undefined

  const model = pickMergedImageModel(settings)
  const tierParams = normalizeImageGenerationTierParams(
    model,
    null,
    resolveAssetImageTierPrefs(settings),
  )
  const referenceImageUrls = await resolveReferenceImageUrls(asset, {
    apiBaseUrl: settings.apiBaseUrl,
    projectRoot,
    onReferencePhase: options?.onReferencePhase,
  })

  const remoteUrl = await generateImage(
    model,
    prompt,
    options?.imageSize,
    referenceImageUrls,
    options?.signal,
    'consume_image',
    tierParams,
  )

  const saveDir =
    options?.projectId
      ? resolveAssetImageDir(
          settings,
          options.appDataDir || appDataDir,
          options.projectId,
          asset.kind,
        )
      : settings.generatedImagesPath

  const saved = await saveGeneratedImageFromUrl(remoteUrl, saveDir)
  if (!saved.success || !saved.filePath) {
    if (options?.projectId) {
      throw new Error(saved.error || '生成图保存到项目目录失败，请检查数据根目录权限')
    }
    if (remoteUrl.startsWith('http') || remoteUrl.startsWith('data:')) {
      return remoteUrl
    }
    throw new Error(saved.error || '保存生成图失败')
  }

  const filePath = saved.filePath || saved.dataUrl || remoteUrl
  if (options?.projectId && filePath.startsWith('data:')) {
    throw new Error('生成图未能保存到本地，请重试')
  }
  if (
    options?.projectId &&
    filePath &&
    !filePath.startsWith('data:') &&
    !isRemoteMediaReference(filePath)
  ) {
    const root = projectRoot ?? resolveProjectRoot(
      settings,
      options.appDataDir || appDataDir,
      options.projectId,
    )
    return toProjectRelativeMediaPath(filePath, root)
  }
  if (options?.projectId && isRemoteMediaReference(filePath)) {
    throw new Error('生成图未能保存到本地，请重试')
  }
  if (isRemoteMediaReference(filePath)) {
    return normalizeRemoteMediaUrl(filePath)
  }
  return filePath
}

export { isGenerationCancelledError }

export interface GenerateAssetImageBatchResult {
  results: Record<string, string>
  errors: Record<string, string>
  successCount: number
  failedCount: number
}

export async function generateAssetImageBatch(
  assets: WorkflowAsset[],
  options?: {
    settings?: AppSettings
    projectId?: string
    appDataDir?: string
    projectStyleKey?: string
    imageSize?: string
    promptPrefix?: string
    promptSuffix?: string
    /** 并发数；默认 IMAGE_BATCH_CONCURRENCY（3） */
    concurrency?: number
    onItemStart?: (asset: WorkflowAsset) => void | Promise<void>
    onItemComplete?: (asset: WorkflowAsset, imagePath: string | null, error?: string) => void | Promise<void>
    resolveItemOptions?: (
      asset: WorkflowAsset,
    ) => Pick<NonNullable<Parameters<typeof generateAssetImage>[1]>, 'signal'> | void
    onProgress?: (done: number, total: number, asset: WorkflowAsset) => void
    signal?: AbortSignal
  },
): Promise<GenerateAssetImageBatchResult> {
  if (!assets.length) {
    return { results: {}, errors: {}, successCount: 0, failedCount: 0 }
  }

  const limit = options?.concurrency ?? IMAGE_BATCH_CONCURRENCY
  const results: Record<string, string> = {}
  const errors: Record<string, string> = {}
  let cursor = 0
  let done = 0

  const runOne = async (asset: WorkflowAsset) => {
    await options?.onItemStart?.(asset)
    const itemOptions = options?.resolveItemOptions?.(asset)
    try {
      const imagePath = await generateAssetImage(asset, {
        ...options,
        ...itemOptions,
        signal: itemOptions?.signal ?? options?.signal,
      })
      results[asset.id] = imagePath
      await options?.onItemComplete?.(asset, imagePath)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '生图失败'
      errors[asset.id] = message
      await options?.onItemComplete?.(asset, null, message)
    } finally {
      done += 1
      options?.onProgress?.(done, assets.length, asset)
    }
  }

  const workers = Array.from({ length: Math.min(limit, assets.length) }, async () => {
    while (cursor < assets.length) {
      const index = cursor
      cursor += 1
      if (index >= assets.length) break
      await runOne(assets[index])
    }
  })

  await Promise.all(workers)

  return {
    results,
    errors,
    successCount: Object.keys(results).length,
    failedCount: Object.keys(errors).length,
  }
}
