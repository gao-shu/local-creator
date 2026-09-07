// Copyright (c) Haode AI. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import type { AppSettings } from '@/types/settings'
import type { CanvasVideoNodeData } from '@/types/canvas-nodes'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import type { VideoRemoteJobSnapshot } from '@/types/video-remote-job'
import { readCanvasData } from '@/lib/storage/canvas-service'
import { readSettings } from '@/lib/storage/settings-service'
import { getMergedVideoModels } from '@/lib/models/merged-model-picker'
import { generateVideoRemoteUrl } from '@/lib/video/video-client'
import { isVideoRemoteJobStale, resolveModelForRemoteJob } from '@/lib/video/video-remote-job'
import type { VideoProgressCallback } from '@/lib/video/video-progress'
import { saveCanvasGeneratedVideo } from '@/lib/canvas/canvas-media-save'
import {
  formatVideoContentDownloadErrorMessage,
  isVideoContentDownloadError,
  VideoContentDownloadError,
} from '@/lib/video/video-content-download'
import {
  finishCanvasVideoTask,
  updateCanvasVideoTaskProgress,
} from '@/lib/canvas/canvas-video-task-service'
import { hasCanvasVideoLocalOutput } from '@/lib/canvas/canvas-video-drag-items'
import { resolveCanvasVideoGenerateInput } from '@/lib/canvas/canvas-video-generate-preview'
import { isWeishiApiModel } from '@/lib/models/weishi-model-presets'
import { composeWeishiVideoPrompt } from '@/lib/workflow/weishi-video-prompt'
import {
  ensureCanvasNodeRunAttemptForResume,
  finishCanvasNodeRunAttempt,
  updateCanvasNodeRunAttempt,
} from '@/lib/canvas/canvas-run-history-service'
import { getNodeDisplayLabel } from '@/lib/canvas/canvas-group-utils'

export function isCanvasVideoNodeResumable(node: Node, now = Date.now()): boolean {
  if (node.type !== CANVAS_NODE_TYPES.storyVideo) return false
  const data = node.data as CanvasVideoNodeData
  if (hasCanvasVideoLocalOutput(data)) return false
  if (data.status !== 'running') return false
  if (!data.remoteJob?.apiTaskId?.trim()) return false
  if (isVideoRemoteJobStale(data.remoteJob, now)) return false
  return true
}

export function listResumableCanvasVideoNodes(nodes: Node[]): Node[] {
  return nodes.filter((node) => isCanvasVideoNodeResumable(node))
}

export function buildPersistedCanvasRemoteJob(
  job: VideoRemoteJobSnapshot,
): VideoRemoteJobSnapshot {
  return { ...job, createdAt: job.createdAt || Date.now() }
}

export async function resumeCanvasVideoFromNode(options: {
  projectId: string
  nodeId: string
  nodes?: Node[]
  edges?: Edge[]
  settings?: AppSettings
  appDataDir?: string
  onProgress?: VideoProgressCallback
  onImageNodePatch?: (nodeId: string, patch: Record<string, unknown>) => void
}): Promise<boolean> {
  const { projectId, nodeId } = options
  const data = await readCanvasData(projectId)
  const nodes = options.nodes ?? data.nodes
  const edges = options.edges ?? data.edges
  const node = nodes.find((item) => item.id === nodeId)
  if (!node || !isCanvasVideoNodeResumable(node)) {
    return false
  }

  const nodeData = node.data as CanvasVideoNodeData
  const remoteJob = nodeData.remoteJob!
  const runAttemptId = await ensureCanvasNodeRunAttemptForResume({
    projectId,
    node,
    label: getNodeDisplayLabel(node),
  })
  const settingsRes = await readSettings()
  const settings = options.settings ?? settingsRes.data
  const appDataDir = options.appDataDir ?? settingsRes.appDataDir
  if (!settings) throw new Error('无法读取系统设置')

  const input = await resolveCanvasVideoGenerateInput(node, {
    projectId,
    nodes,
    edges,
    onImageNodePatch: options.onImageNodePatch,
  })
  const model = resolveModelForRemoteJob(
    getMergedVideoModels(settings),
    remoteJob,
    nodeData.videoModelId ?? input.model.id,
  )

  let prompt = input.prompt
  if (isWeishiApiModel(model)) {
    prompt = composeWeishiVideoPrompt({
      shotBody: input.prompt,
      imageItems:
        input.referenceMode !== 'text_to_video'
          ? input.referenceImageItems.map((item) => ({
              label: item.label,
              path: item.path,
              kind: item.kind,
            }))
          : [],
      audioItems: input.referenceAudioItems,
    })
  }

  const onProgress = async (update: { message: string }) => {
    options.onProgress?.(update)
    await updateCanvasVideoTaskProgress(projectId, nodeId, update.message)
    await updateCanvasNodeRunAttempt(projectId, runAttemptId, {
      progressMessage: update.message,
    })
  }

  try {
    const remoteUrl = await generateVideoRemoteUrl({
      model,
      prompt,
      durationSec: input.durationSec,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      referenceImagePath: input.referenceImagePaths[0] ?? null,
      referenceImagePaths: input.referenceImagePaths.length ? input.referenceImagePaths : undefined,
      referenceImageItems: input.referenceImageItems.map((item) => ({
        label: item.label,
        path: item.path,
        kind: item.kind,
        weishiAssetUrl: item.weishiAssetUrl,
      })),
      referenceAudioPaths: input.referenceAudioPaths.length ? input.referenceAudioPaths : undefined,
      referenceMode: input.referenceMode,
      projectRoot: input.canvasProjectRoot,
      apiBaseUrl: settings.apiBaseUrl,
      resumeJob: remoteJob,
      onProgress,
    })

    let outputPath: string
    try {
      outputPath = await saveCanvasGeneratedVideo({
        settings,
        appDataDir,
        projectId,
        nodeId,
        remoteUrl,
        downloadRetries: 3,
        apiKey: model.apiKey,
        videoId: remoteJob.provider === 'system' ? undefined : remoteJob.apiTaskId,
        apiBaseUrl: remoteJob.createUrl || model.endpoint || model.baseUrl,
        allowUnauthenticatedDownload: !String(model.apiKey || '').trim(),
      })
    } catch (downloadError: unknown) {
      const message = formatVideoContentDownloadErrorMessage(downloadError)
      throw new VideoContentDownloadError(message, remoteUrl)
    }

    await finishCanvasVideoTask(projectId, nodeId, {
      status: 'success',
      patch: {
        outputPath,
        outputOwnerKind: 'canvas',
        outputOwnerProjectId: projectId,
        prompt: nodeData.prompt,
        progressMessage: undefined,
        remoteJob: undefined,
        pendingDownloadUrl: undefined,
      },
      progressMessage: undefined,
    })
    await finishCanvasNodeRunAttempt(projectId, runAttemptId, { status: 'completed' })
    return true
  } catch (error: unknown) {
    const err = error as Error
    const downloadFailed = isVideoContentDownloadError(error)
    const message = downloadFailed
      ? formatVideoContentDownloadErrorMessage(error)
      : err.message || '视频恢复失败'
    await finishCanvasVideoTask(projectId, nodeId, {
      status: 'error',
      error: message,
      progressMessage: undefined,
      // 下载失败保留 remoteJob，便于「重新下载」用 jobId 拼 /content
      patch: downloadFailed
        ? { pendingDownloadUrl: error.remoteUrl }
        : { pendingDownloadUrl: undefined, remoteJob: undefined },
    })
    await finishCanvasNodeRunAttempt(projectId, runAttemptId, {
      status: 'failed',
      errorMessage: message,
    })
    return false
  }
}
