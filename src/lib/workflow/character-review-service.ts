// Copyright (c) local-creator. All rights reserved.

import type { ModelConfig } from '@/types/settings'
import type { WorkflowAsset } from '@/types/workflow'
import {
  isWeishiAssetReady,
  pollWeishiReviewAsset,
  resolveImageBlobForWeishiUpload,
  uploadWeishiReviewAsset,
} from '@/lib/models/weishi-asset-service'
import { isWeishiReviewModel } from '@/lib/models/weishi-model-presets'
import { resolveWeishiApiKey } from '@/lib/auth/org-weishi-key'
import { pickAssetReviewImagePath } from '@/lib/workflow/asset-utils'

export type ReviewProvider = 'weishi'

export function resolveReviewProvider(model?: ModelConfig | null): ReviewProvider {
  if (isWeishiReviewModel(model)) return 'weishi'
  throw new Error('仅支持微视审核（公司即梦审核已移除）')
}

export function getReviewProviderLabel(_provider: ReviewProvider): string {
  return '微视'
}

/** 资产同步审核通道：仅微视 API */
export function resolveAssetReviewModelFromVideoModel(
  videoModels: ModelConfig[],
  videoModelId: string | undefined,
  _imageModels: ModelConfig[],
): ModelConfig | null {
  const videoModel =
    (videoModelId ? videoModels.find((m) => m.id === videoModelId) : undefined) ??
    videoModels[0] ??
    null

  if (videoModel && isWeishiReviewModel(videoModel)) return videoModel
  return videoModels.find((m) => isWeishiReviewModel(m)) ?? null
}

/** 生图/上传图：优先生成主图，否则参考图 */
export function pickCharacterReviewImagePath(asset: WorkflowAsset): string | undefined {
  return pickAssetReviewImagePath(asset)
}

export interface CharacterReviewSyncResult {
  provider: ReviewProvider
  weishiAssetId?: string
  weishiAssetUrl?: string
  weishiAssetStatus?: string
  reviewImagePath?: string
}

export async function syncCharacterToReview(
  asset: WorkflowAsset,
  model: ModelConfig,
  options?: { projectRoot?: string; apiBaseUrl?: string },
): Promise<CharacterReviewSyncResult> {
  const imagePath = pickCharacterReviewImagePath(asset)
  if (!imagePath) throw new Error('请先为角色生成或上传角色图')

  if (!isWeishiReviewModel(model)) {
    throw new Error('仅支持微视审核（公司即梦审核已移除）')
  }

  if (!model.endpoint?.trim()) {
    throw new Error('请先在模型配置中填写微视 API 地址')
  }

  const label = asset.name?.trim() || 'character'
  const apiKey = await resolveWeishiApiKey({
    model,
    apiBase: options?.apiBaseUrl,
  })

  const { blob, filename } = await resolveImageBlobForWeishiUpload(imagePath, {
    projectRoot: options?.projectRoot,
    label,
  })
  const uploaded = await uploadWeishiReviewAsset({
    endpoint: model.endpoint || '',
    apiKey,
    blob,
    filename,
    assetType: 'image',
  })

  let settled = uploaded
  if (!isWeishiAssetReady(uploaded.status)) {
    settled = await pollWeishiReviewAsset({
      endpoint: model.endpoint || '',
      apiKey,
      assetId: uploaded.assetId,
    })
  }

  return {
    provider: 'weishi',
    weishiAssetId: settled.assetId,
    weishiAssetUrl: settled.assetUrl,
    weishiAssetStatus: settled.status || 'processing',
    reviewImagePath: imagePath,
  }
}
