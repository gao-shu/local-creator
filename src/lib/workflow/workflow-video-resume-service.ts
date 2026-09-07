// Copyright (c) local-creator contributors. All rights reserved.

import type { AppSettings } from '@/types/settings'
import type { VideoRemoteJobSnapshot } from '@/types/video-remote-job'
import type { WorkflowShot, WorkflowTask } from '@/types/workflow'
import { isWorkflowApiAvailable } from '@/lib/storage/workflow-service'
import { saveGeneratedVideoFromUrl } from '@/lib/storage/fs-service'
import { resolveProjectMediaDir, resolveProjectRoot } from '@/lib/storage/project-paths'
import { toProjectRelativeMediaPath } from '@/lib/storage/media-path-resolver'
import { getMergedVideoModels } from '@/lib/models/merged-model-picker'
import { generateVideoRemoteUrl } from '@/lib/video/video-client'
import { isVideoRemoteJobStale, resolveModelForRemoteJob } from '@/lib/video/video-remote-job'
import type { VideoProgressCallback } from '@/lib/video/video-progress'
import {
  extractVideoIdFromApiContentUrl,
  resolveApiOriginVideoContentUrl,
  resolveVideoDownloadHeaders,
  shouldAllowPrivateVideoContentFetch,
} from '@/lib/video/video-content-download'

export function isWorkflowVideoTaskResumable(task: WorkflowTask, now = Date.now()): boolean {
  if (task.type !== 'video') return false
  if (task.status !== 'pending' && task.status !== 'running') return false
  if (!task.remoteJob?.apiTaskId?.trim()) return false
  if (isVideoRemoteJobStale(task.remoteJob, now)) return false
  return Boolean(task.shotId?.trim())
}

export async function resumeWorkflowVideoFromTask(options: {
  projectId: string
  task: WorkflowTask
  shot: WorkflowShot
  settings: AppSettings
  appDataDir: string
  videoModelId?: string
  onProgress?: VideoProgressCallback
  abortSignal?: AbortSignal
}): Promise<string> {
  const { projectId, task, shot, settings, appDataDir, videoModelId, onProgress, abortSignal } =
    options
  const remoteJob = task.remoteJob
  if (!remoteJob?.apiTaskId?.trim()) {
    throw new Error('缺少远端视频任务 ID，无法恢复')
  }
  if (isVideoRemoteJobStale(remoteJob)) {
    throw new Error('视频生成已超时，请重新生成')
  }

  if (!isWorkflowApiAvailable()) {
    await new Promise((resolve) => setTimeout(resolve, 800))
    return `preview:video:${shot.id}:${Date.now()}`
  }

  const model = resolveModelForRemoteJob(
    getMergedVideoModels(settings),
    remoteJob,
    videoModelId,
  )
  const projectRoot = resolveProjectRoot(settings, appDataDir, projectId)

  const remoteUrl = await generateVideoRemoteUrl({
    model,
    prompt: shot.prompt?.trim() || shot.dialogue?.trim() || 'resume',
    resumeJob: remoteJob,
    onProgress,
    abortSignal,
  })

  const saveDir = resolveProjectMediaDir(settings, appDataDir, projectId, 'video')
  const videoId = remoteJob.apiTaskId || extractVideoIdFromApiContentUrl(remoteUrl)
  const apiBaseForDownload = remoteJob.createUrl || model.endpoint || model.baseUrl
  const downloadUrl = resolveApiOriginVideoContentUrl({
    contentUrl: remoteUrl,
    apiBaseUrl: apiBaseForDownload,
    preferredVideoId: videoId,
  })
  const downloadHeaders = resolveVideoDownloadHeaders({
    url: downloadUrl,
    apiKey: model.apiKey,
    videoId,
  })
  const saved = await saveGeneratedVideoFromUrl(downloadUrl, saveDir, {
    retries: 3,
    abortSignal,
    headers: downloadHeaders,
    allowPrivateNetwork: shouldAllowPrivateVideoContentFetch(downloadUrl, apiBaseForDownload),
  })
  if (!saved.success || !saved.filePath) {
    throw new Error(saved.error || '保存视频失败')
  }

  return toProjectRelativeMediaPath(saved.filePath, projectRoot)
}

export function buildPersistedRemoteJob(
  job: VideoRemoteJobSnapshot,
): VideoRemoteJobSnapshot {
  return { ...job, createdAt: job.createdAt || Date.now() }
}
