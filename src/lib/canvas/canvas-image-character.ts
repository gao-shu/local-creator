// Copyright (c) Haode AI. All rights reserved.

import type { ModelConfig } from '@/types/settings'
import type { CanvasImageNodeData } from '@/types/canvas-nodes'
import type { WorkflowAsset } from '@/types/workflow'
import {
  clearAssetReviewPatch,
  shouldClearReviewForImageChange,
} from '@/lib/workflow/asset-utils'
import {
  resolveAssetReviewModelFromVideoModel,
} from '@/lib/workflow/character-review-service'
import { isWeishiReviewModel } from '@/lib/models/weishi-model-presets'
import { mapCanvasAssetRoleToKind } from '@/lib/canvas/canvas-image-generate-prompt'

export function isCanvasAssetImageNode(data: CanvasImageNodeData): boolean {
  return Boolean(data.assetRoleConverted)
}

export function isCanvasCharacterImageNode(data: CanvasImageNodeData): boolean {
  return data.assetRole === 'character' && Boolean(data.assetRoleConverted)
}

export function canvasImageNodeToReviewAsset(
  nodeId: string,
  data: CanvasImageNodeData,
): WorkflowAsset {
  const outputPath = String(data.outputPath || '').trim()
  const now = Date.now()
  return {
    id: nodeId,
    kind: mapCanvasAssetRoleToKind(data.assetRole),
    name: data.imageName?.trim() || '未命名',
    description: data.prompt?.trim() || '',
    prompt: data.prompt?.trim() || '',
    generatedImagePaths: outputPath ? [outputPath] : [],
    primaryGeneratedImageIndex: 0,
    weishiAssetId: data.weishiAssetId,
    weishiAssetUrl: data.weishiAssetUrl,
    weishiAssetStatus: data.weishiAssetStatus,
    jimengAssetId: data.jimengAssetId,
    jimengAssetStatus: data.jimengAssetStatus,
    reviewImagePath: data.reviewImagePath,
    voiceType: data.voiceType,
    status: outputPath ? 'ready' : 'draft',
    updatedAt: now,
  }
}

export function resolveCanvasVideoReviewModel(
  videoModels: ModelConfig[],
  imageModels: ModelConfig[],
  videoModelId?: string,
): ModelConfig | null {
  return resolveAssetReviewModelFromVideoModel(videoModels, videoModelId, imageModels)
}

export function shouldShowWeishiReviewSync(
  reviewModel: ModelConfig | null | undefined,
): boolean {
  return Boolean(reviewModel && isWeishiReviewModel(reviewModel))
}

export function reviewPatchForCanvasImageNode(
  data: CanvasImageNodeData,
  patch: Partial<CanvasImageNodeData>,
): Partial<CanvasImageNodeData> {
  if (!patch.outputPath || patch.outputPath === data.outputPath) return patch
  const asset = canvasImageNodeToReviewAsset('node', data)
  if (!shouldClearReviewForImageChange(asset, patch.outputPath)) return patch
  return { ...patch, ...clearAssetReviewPatch(), reviewImagePath: undefined }
}
