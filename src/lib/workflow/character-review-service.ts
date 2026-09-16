// Copyright (c) local-creator. All rights reserved.

import type { ModelConfig } from '@/types/settings'
import type { WorkflowAsset } from '@/types/workflow'
import { pickAssetReviewImagePath } from '@/lib/workflow/asset-utils'

/** 角色远程审核通道已移除；遗留字段仅用于只读展示旧项目数据 */
export type ReviewProvider = 'jimeng'

export function resolveReviewProvider(_model?: ModelConfig | null): ReviewProvider | null {
  return null
}

export function getReviewProviderLabel(_provider: ReviewProvider | null): string {
  return ''
}

/** 资产同步审核通道已移除 */
export function resolveAssetReviewModelFromVideoModel(
  _videoModels: ModelConfig[],
  _videoModelId: string | undefined,
  _imageModels: ModelConfig[],
): ModelConfig | null {
  return null
}

/** 生图/上传图：优先生成主图，否则参考图 */
export function pickCharacterReviewImagePath(asset: WorkflowAsset): string | undefined {
  return pickAssetReviewImagePath(asset)
}

export interface CharacterReviewSyncResult {
  provider: ReviewProvider
  reviewImagePath?: string
}

export async function syncCharacterToReview(
  _asset: WorkflowAsset,
  _model: ModelConfig,
  _options?: { projectRoot?: string; apiBaseUrl?: string },
): Promise<CharacterReviewSyncResult> {
  throw new Error('角色审核通道已移除')
}
