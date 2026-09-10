// Copyright (c) local-creator contributors. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import type { AppSettings } from '@/types/settings'
import type {
  CanvasImageNodeData,
  CanvasReferenceImageNodeData,
  CanvasVideoNodeData,
} from '@/types/canvas-nodes'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import {
  createE2eMockFailError,
  getE2eMockDelayMs,
  shouldE2eMockFail,
  shouldUseE2eMockAi,
} from '@/lib/e2e/e2e-mock-ai'
import { createMockGeneratedImage, generateImage, pickImageModel } from '@/lib/models/image-client'
import { readSettings } from '@/lib/storage/settings-service'
import { isCanvasApiAvailable } from '@/lib/storage/canvas-service'
import { uploadReferenceImageForGeneration } from '@/lib/workflow/reference-image-upload'
import {
  DEFAULT_IMAGE_SIZE,
  normalizeImageSizePreset,
  resolveImageSizeApiValue,
} from '@/lib/workflow/image-size-presets'
import { canUseBackendFileUpload } from '@/lib/auth/login-mode'
import {
  buildImageProxyTierPayload,
  normalizeImageGenerationTierParams,
  resolveAssetImageTierPrefs,
} from '@/lib/models/image-generation-tier-params'
import { resolveSoftwareImageModelId } from '@/lib/models/software-model-prefs'
import { mergeModelsForKind } from '@/lib/models/model-merge'
import { useSettingsStore } from '@/stores/settings-store'
import {
  resolveCanvasImageNodePrompt,
  resolveNodeImageSource,
} from '@/lib/canvas/canvas-graph-utils'
import {
  buildCanvasMentionCandidates,
  collectCanvasVideoReferenceBarAssets,
} from '@/lib/canvas/canvas-mention-utils'
import {
  buildLightingPrompt,
  buildSubjectViewPrompt,
} from '@/lib/canvas/canvas-image-tool-prompts'
import { buildCanvasImageGeneratePrompt } from '@/lib/canvas/canvas-image-generate-prompt'
import {
  saveCanvasGeneratedImage,
  saveCanvasGeneratedVideo,
} from '@/lib/canvas/canvas-media-save'
import {
  resolveCanvasMediaProjectRootSync,
  type CanvasMediaLocation,
} from '@/lib/canvas/canvas-media-resolve'
import { resolveCanvasVideoGenerateInput } from '@/lib/canvas/canvas-video-generate-preview'
import { assertNotAborted, delayWithAbort, isVideoGenerationAbortError } from '@/lib/video/video-generation-abort'
import { VIDEO_PROGRESS_DOWNLOADING } from '@/lib/video/video-progress'
import { generateVideoRemoteUrl } from '@/lib/video/video-client'
import {
  formatVideoContentDownloadErrorMessage,
  VideoContentDownloadError,
} from '@/lib/video/video-content-download'

export interface CanvasRunOptions {
  /** 单次工具附加提示词（擦除/高清/抠图等） */
  toolPrompt?: string
  /** 将当前节点输出图作为首要参考图 */
  useSelfReference?: boolean
}

export interface CanvasRunContext {
  projectId: string
  nodes: Node[]
  edges: Edge[]
  settings?: AppSettings
  appDataDir?: string
  runOptions?: CanvasRunOptions
  onProgress?: (message: string) => void
  onImageNodePatch?: (nodeId: string, patch: Partial<CanvasImageNodeData>) => void
  onRemoteJobCreated?: (job: import('@/types/video-remote-job').VideoRemoteJobSnapshot) => void | Promise<void>
  resumeJob?: import('@/types/video-remote-job').VideoRemoteJobSnapshot
  abortSignal?: AbortSignal
}

async function resolveRunContext(ctx: CanvasRunContext) {
  const res = await readSettings()
  const settings = ctx.settings ?? res.data
  const appDataDir = ctx.appDataDir ?? res.appDataDir
  if (!settings) {
    throw new Error('无法读取系统设置，请重启应用后重试')
  }
  if (!settings.dataRootPath?.trim() && !appDataDir?.trim()) {
    throw new Error('请先在「系统设置 → 存储位置」中选择数据根目录')
  }
  return { settings, appDataDir }
}

async function resolveReferenceUrls(
  sources: CanvasMediaLocation[],
  settings: AppSettings,
  appDataDir: string,
  canvasProjectId: string,
): Promise<string[] | undefined> {
  if (!sources.length) return undefined
  const urls: string[] = []
  for (const source of sources) {
    const projectRoot = await resolveCanvasMediaProjectRootSync(
      canvasProjectId,
      settings,
      appDataDir,
      source,
    )
    const url = await uploadReferenceImageForGeneration(source.path, {
      apiBaseUrl: canUseBackendFileUpload() ? settings.apiBaseUrl : undefined,
      label: 'canvas-ref',
      projectRoot,
    })
    urls.push(url)
  }
  return urls
}

function createMockVideoDataUrl(label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#0f172a"/><text x="50%" y="46%" fill="#67e8f9" font-size="22" text-anchor="middle" font-family="sans-serif">${label}</text><text x="50%" y="58%" fill="#94a3b8" font-size="14" text-anchor="middle" font-family="sans-serif">预览模式 · 视频</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export async function runCanvasImageNode(
  node: Node,
  ctx: CanvasRunContext,
): Promise<Partial<CanvasImageNodeData>> {
  const data = node.data as CanvasImageNodeData
  const runOptions = ctx.runOptions
  const toolExtras = [
    runOptions?.toolPrompt,
    buildSubjectViewPrompt(data.subjectView),
    buildLightingPrompt(data.lightingConfig),
  ]
  const needsSelfReference =
    Boolean(runOptions?.useSelfReference) ||
    Boolean(runOptions?.toolPrompt) ||
    Boolean(data.subjectView) ||
    Boolean(data.lightingConfig)

  const runContext = await resolveRunContext(ctx)
  let prompt = buildCanvasImageGeneratePrompt(
    data,
    resolveCanvasImageNodePrompt(node.id, ctx.nodes, ctx.edges, data.prompt),
    toolExtras,
    { settings: runContext.settings },
  )
  if (!prompt.trim() && needsSelfReference) {
    prompt = '保持画面主体、构图与风格一致'
  }
  if (!prompt.trim()) {
    throw new Error('请先连接 Prompt 节点或填写描述')
  }

  const { settings, appDataDir } = runContext

  // 参考图与控制台参考条完全同源：只用输入框里的描述（node.prompt），
  // 禁止对「风格+布局包装后的整段 prompt」再跑自动@（否则条上空也会静默 edits）
  const consolePrompt = String(data.prompt || '')
  const mentionCandidates = buildCanvasMentionCandidates(ctx.nodes, [], ctx.edges)
  const barAssets = collectCanvasVideoReferenceBarAssets({
    videoNodeId: node.id,
    prompt: consolePrompt,
    nodes: ctx.nodes,
    edges: ctx.edges,
    mentionCandidates,
    consoleReferenceImagePaths: data.consoleReferenceImagePaths,
  })
  let refSources: CanvasMediaLocation[] = barAssets.map((asset) => ({
    path: asset.path,
    ownerKind: asset.ownerKind,
    ownerProjectId: asset.ownerProjectId,
  }))

  if (needsSelfReference) {
    const selfSource = resolveNodeImageSource(node)
    if (selfSource) {
      const selfKey = `${selfSource.ownerKind || 'canvas'}:${selfSource.ownerProjectId || ''}:${selfSource.path}`
      refSources = [
        selfSource,
        ...refSources.filter(
          (item) =>
            `${item.ownerKind || 'canvas'}:${item.ownerProjectId || ''}:${item.path}` !== selfKey,
        ),
      ]
    } else if (runOptions?.toolPrompt || data.subjectView || data.lightingConfig) {
      throw new Error('请先生成或上传图片后再使用此工具')
    }
  }

  if (!isCanvasApiAvailable() || shouldUseE2eMockAi()) {
    await delayWithAbort(getE2eMockDelayMs(900), ctx.abortSignal)
    assertNotAborted(ctx.abortSignal)
    if (shouldE2eMockFail('asset-image')) {
      throw createE2eMockFailError('asset-image')
    }
    const mockUrl = createMockGeneratedImage('画布生图')
    if (isCanvasApiAvailable()) {
      const outputPath = await saveCanvasGeneratedImage({
        settings,
        appDataDir,
        projectId: ctx.projectId,
        nodeId: node.id,
        remoteUrl: mockUrl,
      })
      return {
        outputPath,
        outputOwnerKind: 'canvas',
        outputOwnerProjectId: ctx.projectId,
        status: 'success',
        error: undefined,
        prompt: data.prompt,
      }
    }
    return {
      outputPath: mockUrl,
      status: 'success',
      error: undefined,
      prompt: data.prompt,
    }
  }

  const systemByKind = useSettingsStore.getState().systemModelsByKind
  const imageModels = mergeModelsForKind('image', settings.imageModels, systemByKind)
  const model = pickImageModel(imageModels, resolveSoftwareImageModelId(settings, imageModels))
  const referenceImageUrls = await resolveReferenceUrls(
    refSources,
    settings,
    appDataDir,
    ctx.projectId,
  )
  if (typeof console !== 'undefined') {
    const refCount = referenceImageUrls?.length ?? 0
    console.info(
      `[canvas-image] refs=${refCount} → ${refCount > 0 ? 'edits' : 'generations'}`,
      refCount
        ? barAssets.map((a) => `${a.source || 'ref'}:${a.label || a.path}`).slice(0, 6)
        : '',
    )
  }
  const imageSizePreset = normalizeImageSizePreset(
    data.imageSize || settings.lastUsedAssetImageSize,
    DEFAULT_IMAGE_SIZE,
  )
  const tierParams = normalizeImageGenerationTierParams(
    model,
    { resolution: data.imageResolution, quality: data.imageQuality },
    resolveAssetImageTierPrefs(settings),
  )
  const remoteUrl = await generateImage(
    model,
    prompt,
    resolveImageSizeApiValue(imageSizePreset),
    referenceImageUrls,
    ctx.abortSignal,
    'consume_image',
    tierParams,
  )
  const outputPath = await saveCanvasGeneratedImage({
    settings,
    appDataDir,
    projectId: ctx.projectId,
    nodeId: node.id,
    remoteUrl,
  })

  return {
    outputPath,
    outputOwnerKind: 'canvas',
    outputOwnerProjectId: ctx.projectId,
    status: 'success',
    error: undefined,
    prompt: data.prompt,
  }
}

export async function runCanvasVideoNode(
  node: Node,
  ctx: CanvasRunContext,
): Promise<Partial<CanvasVideoNodeData>> {
  const data = node.data as CanvasVideoNodeData
  const { settings, appDataDir } = await resolveRunContext(ctx)

  if (!isCanvasApiAvailable() || shouldUseE2eMockAi()) {
    await delayWithAbort(getE2eMockDelayMs(1200), ctx.abortSignal)
    assertNotAborted(ctx.abortSignal)
    if (shouldE2eMockFail('shot-video')) {
      throw createE2eMockFailError('shot-video')
    }
    if (isCanvasApiAvailable()) {
      return {
        outputPath: `preview:video:canvas:${node.id}:${Date.now()}`,
        outputOwnerKind: 'canvas',
        outputOwnerProjectId: ctx.projectId,
        status: 'success',
        error: undefined,
        prompt: data.prompt,
        remoteJob: undefined,
      }
    }
    return {
      outputPath: createMockVideoDataUrl('画布视频'),
      status: 'success',
      error: undefined,
      prompt: data.prompt,
    }
  }

  const input = await resolveCanvasVideoGenerateInput(node, {
    projectId: ctx.projectId,
    nodes: ctx.nodes,
    edges: ctx.edges,
  })

  const model = input.model
  const prompt = input.prompt
  const referenceImageItems = input.referenceImageItems.map((item) => ({
    label: item.label,
    path: item.path,
    kind: item.kind,
  }))

  const remoteUrl = await generateVideoRemoteUrl({
    model,
    prompt,
    durationSec: input.durationSec,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    referenceImagePath: input.referenceImagePaths[0] ?? null,
    referenceImagePaths: input.referenceImagePaths.length ? input.referenceImagePaths : undefined,
    referenceImageItems: referenceImageItems.length ? referenceImageItems : undefined,
    referenceAudioPaths: input.referenceAudioPaths.length ? input.referenceAudioPaths : undefined,
    referenceMode: input.referenceMode,
    projectRoot: input.videoProjectRoot,
    apiBaseUrl: settings.apiBaseUrl,
    onProgress: (update) => {
      ctx.onProgress?.(update.message)
    },
    onRemoteJobCreated: ctx.onRemoteJobCreated,
    resumeJob: ctx.resumeJob ?? data.remoteJob,
  })

  // 中转 done 后主进程 GET …/content 落盘（页面 Network 看不到）
  const downloadStartedAt = Date.now()
  const pushDownloadProgress = (suffix?: string) => {
    const base = VIDEO_PROGRESS_DOWNLOADING.message.replace(/\s*100%\s*$/, '').trim()
    ctx.onProgress?.(suffix ? `${base}${suffix} 100%` : VIDEO_PROGRESS_DOWNLOADING.message)
  }
  pushDownloadProgress()

  if (typeof console !== 'undefined') {
    console.info('[canvas-video] downloading content', String(remoteUrl).slice(0, 160))
  }

  const heartbeat = setInterval(() => {
    const waitedSec = Math.max(1, Math.round((Date.now() - downloadStartedAt) / 1000))
    pushDownloadProgress(`（已等 ${waitedSec}s）`)
  }, 5000)

  let outputPath: string
  try {
    outputPath = await saveCanvasGeneratedVideo({
      settings,
      appDataDir,
      projectId: ctx.projectId,
      nodeId: node.id,
      remoteUrl,
      apiKey: model.apiKey,
      // 系统模型 remoteJob.apiTaskId 是 admin jobId，勿当作上游 video_* 去强制要 Key
      videoId:
        ctx.resumeJob?.provider === 'system' || data.remoteJob?.provider === 'system'
          ? undefined
          : ctx.resumeJob?.apiTaskId || data.remoteJob?.apiTaskId,
      apiBaseUrl:
        ctx.resumeJob?.createUrl || data.remoteJob?.createUrl || model.endpoint || model.baseUrl,
      abortSignal: ctx.abortSignal,
      downloadRetries: 3,
      allowUnauthenticatedDownload:
        !String(model.apiKey || '').trim() ||
        /\/client\/legacy-proxy-jobs\/video\/jobs\//i.test(String(remoteUrl || '')),
    })
  } catch (error: unknown) {
    if (isVideoGenerationAbortError(error)) throw error
    const message = formatVideoContentDownloadErrorMessage(error)
    throw new VideoContentDownloadError(message, remoteUrl)
  } finally {
    clearInterval(heartbeat)
  }
  assertNotAborted(ctx.abortSignal)

  // 落盘成功即收尾字段（上层再 flush）；避免仅写了 outputPath 却残留 running/remoteJob
  return {
    outputPath,
    outputOwnerKind: 'canvas',
    outputOwnerProjectId: ctx.projectId,
    status: 'success',
    error: undefined,
    progressMessage: undefined,
    prompt: data.prompt,
    remoteJob: undefined,
    pendingDownloadUrl: undefined,
  }
}

export async function runCanvasNode(
  node: Node,
  ctx: CanvasRunContext,
): Promise<{ nodeId: string; patch: Record<string, unknown> } | null> {
  if (node.type === CANVAS_NODE_TYPES.imageNode) {
    const patch = await runCanvasImageNode(node, ctx)
    return { nodeId: node.id, patch }
  }
  if (node.type === CANVAS_NODE_TYPES.storyVideo) {
    const patch = await runCanvasVideoNode(node, ctx)
    return { nodeId: node.id, patch }
  }
  return null
}

export function canRunCanvasNode(node: Node): boolean {
  return node.type === CANVAS_NODE_TYPES.imageNode || node.type === CANVAS_NODE_TYPES.storyVideo
}

export type { CanvasReferenceImageNodeData }
