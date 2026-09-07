// Copyright (c) local-creator contributors. All rights reserved.

import {
  isWeishiAssetReady,
  pollWeishiReviewAsset,
  resolveImageBlobForWeishiUpload,
  uploadWeishiReviewAsset,
} from '@/lib/models/weishi-asset-service'
import { isWeishiApiModel } from '@/lib/models/weishi-model-presets'
import { resolveWeishiApiKey } from '@/lib/auth/org-weishi-key'
import {
  getPrimaryGeneratedImagePath,
  isSameAssetMediaPath,
  normalizeAssetMediaPath,
} from '@/lib/workflow/asset-utils'
import { resolveWeishiShotMediaUrl } from '@/lib/models/weishi-shot-media-cache'
import { buildShotImageValidationPatch } from '@/lib/workflow/shot-video-utils'
import type { ModelConfig } from '@/types/settings'
import type { WeishiShotMediaEntry, WorkflowShot } from '@/types/workflow'

function parseWeishiAssetId(url: string): string {
  const trimmed = String(url || '').trim()
  if (!/^asset:\/\//i.test(trimmed)) return trimmed
  return trimmed.replace(/^asset:\/\//i, '')
}

function normalizeWeishiAssetUrl(assetId: string, assetUrl: string): string {
  const url = String(assetUrl || '').trim()
  if (/^asset:\/\//i.test(url)) return url
  const id = String(assetId || '').trim()
  return id ? `asset://${id.replace(/^asset:\/\//i, '')}` : url
}

function buildWeishiShotMediaUpsertPatch(
  shot: WorkflowShot,
  localPath: string,
  assetId: string,
  assetUrl: string,
  endpoint?: string,
): Partial<WorkflowShot> {
  const normalized = normalizeAssetMediaPath(localPath)
  if (!normalized || !assetId) return {}

  const weishiAssetUrl = normalizeWeishiAssetUrl(assetId, assetUrl)
  const weishiAssetId = parseWeishiAssetId(weishiAssetUrl)
  const next = [...(shot.weishiUploadedMedia ?? [])]
  const idx = next.findIndex((entry) => isSameAssetMediaPath(entry.localPath, normalized))
  const row: WeishiShotMediaEntry = {
    localPath: normalized,
    weishiAssetId,
    weishiAssetUrl,
    endpoint: String(endpoint || '').trim() || undefined,
  }

  if (idx >= 0) {
    next[idx] = row
  } else {
    next.push(row)
  }

  return {
    weishiUploadedMedia: next,
    updatedAt: Date.now(),
  }
}

/** 分镜图审核：微视 API 开白并写入 weishiUploadedMedia，供后续生视频复用 */
export async function syncShotStoryboardToWeishiReview(
  shot: WorkflowShot,
  model: ModelConfig,
  options?: { projectRoot?: string; apiBaseUrl?: string },
): Promise<Partial<WorkflowShot>> {
  if (!isWeishiApiModel(model)) {
    throw new Error('非微视API视频模型暂不支持审核')
  }
  if (!model.endpoint?.trim()) {
    throw new Error('请先在模型配置中填写微视 API 地址')
  }

  const apiKey = await resolveWeishiApiKey({
    model,
    apiBase: options?.apiBaseUrl,
  })

  const imagePath = getPrimaryGeneratedImagePath(
    shot as Parameters<typeof getPrimaryGeneratedImagePath>[0],
  )
  if (!imagePath) {
    throw new Error('请先生成分镜图后再审核')
  }

  const validationPatch = buildShotImageValidationPatch(shot, imagePath)
  if (!validationPatch.validatedImagePath) {
    throw new Error('请先生成分镜图后再审核')
  }

  const cachedAssetUrl = resolveWeishiShotMediaUrl(shot, imagePath, model.endpoint)
  if (cachedAssetUrl) {
    return {
      ...validationPatch,
      ...buildWeishiShotMediaUpsertPatch(
        shot,
        imagePath,
        parseWeishiAssetId(cachedAssetUrl),
        cachedAssetUrl,
        model.endpoint,
      ),
    }
  }

  const label = `shot-${shot.shotNumber}`
  const { blob, filename } = await resolveImageBlobForWeishiUpload(imagePath, {
    projectRoot: options?.projectRoot,
    label,
  })

  let uploaded = await uploadWeishiReviewAsset({
    endpoint: model.endpoint,
    apiKey,
    blob,
    filename,
    assetType: 'image',
  })

  if (!isWeishiAssetReady(uploaded.status)) {
    uploaded = await pollWeishiReviewAsset({
      endpoint: model.endpoint,
      apiKey,
      assetId: uploaded.assetId,
      maxAttempts: 20,
      intervalMs: 3000,
    })
  }

  if (!isWeishiAssetReady(uploaded.status)) {
    throw new Error('微视开白处理中，请稍后再试')
  }

  const mediaPatch = buildWeishiShotMediaUpsertPatch(
    shot,
    imagePath,
    uploaded.assetId,
    uploaded.assetUrl,
    model.endpoint,
  )

  return {
    ...validationPatch,
    ...mediaPatch,
  }
}
