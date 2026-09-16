// Copyright (c) local-creator contributors. All rights reserved.

import {
  collectAssetPreviewPaths,
  isAssetReviewValidForImage,
  isSameAssetMediaPath,
  pickAssetReviewImagePath,
} from '@/lib/workflow/asset-utils'
import type { ReviewProvider } from '@/lib/workflow/character-review-service'
import type { WorkflowAsset } from '@/types/workflow'

export type AssetReviewVisualState = 'none' | 'processing' | 'approved' | 'failed'

export interface AssetReviewSnapshot {
  provider: ReviewProvider | null
  providerLabel: string
  assetId: string
  status: string
  visualState: AssetReviewVisualState
  isApproved: boolean
  hasSynced: boolean
  title: string
  badgeLabel: string
}

const EMPTY_SNAPSHOT: AssetReviewSnapshot = {
  provider: null,
  providerLabel: '',
  assetId: '',
  status: '',
  visualState: 'none',
  isApproved: false,
  hasSynced: false,
  title: '',
  badgeLabel: '',
}

function normalizeReviewStatus(raw?: string): string {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (s === 'ready') return 'active'
  return s
}

function isJimengAssetReady(status: string): boolean {
  return status === 'active' || status === 'approved' || status === 'success'
}

function isJimengAssetFailed(status: string): boolean {
  return status === 'failed' || status === 'error' || status === 'rejected'
}

/** 从资产遗留字段推断远程审核通道（字段名兼容旧数据，UI 不展示原厂商品牌） */
export function resolveAssetReviewProvider(asset: WorkflowAsset): ReviewProvider | null {
  if (asset.jimengAssetId?.trim() || asset.jimengAssetStatus?.trim()) return 'jimeng'
  return null
}

export function getAssetReviewSnapshot(
  asset: WorkflowAsset,
  options?: { imagePath?: string },
): AssetReviewSnapshot {
  const imagePath = options?.imagePath ?? pickAssetReviewImagePath(asset)
  if (!isAssetReviewValidForImage(asset, imagePath)) return EMPTY_SNAPSHOT

  const provider = resolveAssetReviewProvider(asset)
  if (!provider) return EMPTY_SNAPSHOT

  const providerLabel = '外部审核'
  const assetId = asset.jimengAssetId?.trim() || ''
  const status = normalizeReviewStatus(asset.jimengAssetStatus)

  const isApproved = Boolean(assetId) && isJimengAssetReady(status)
  const failed = isJimengAssetFailed(status)
  const hasSynced = Boolean(assetId)

  let visualState: AssetReviewVisualState = 'none'
  if (isApproved) visualState = 'approved'
  else if (failed) visualState = 'failed'
  else if (hasSynced) visualState = 'processing'

  let title = ''
  let badgeLabel = ''
  if (isApproved) {
    title = `${providerLabel}审核通过`
    badgeLabel = `${providerLabel}已审`
  } else if (failed) {
    title = `${providerLabel}审核失败`
    badgeLabel = `${providerLabel}未过审`
  } else if (hasSynced) {
    title = `${providerLabel}审核中`
    badgeLabel = `${providerLabel}审核中`
  }

  return {
    provider,
    providerLabel,
    assetId,
    status,
    visualState,
    isApproved,
    hasSynced,
    title,
    badgeLabel,
  }
}

/** 按本地图片路径匹配角色资产 */
export function findCharacterAssetForMediaPath(
  imagePath: string,
  characters: WorkflowAsset[],
): WorkflowAsset | null {
  const target = String(imagePath || '').trim()
  if (!target) return null
  for (const asset of characters) {
    for (const path of collectAssetPreviewPaths(asset)) {
      if (isSameAssetMediaPath(path, target)) return asset
    }
  }
  return null
}

/** 角色参考图/生成图已审核通过时返回快照（用于分镜缩略图角标） */
export function getApprovedCharacterImageReviewSnapshot(
  imagePath: string,
  characters: WorkflowAsset[],
): AssetReviewSnapshot | null {
  const asset = findCharacterAssetForMediaPath(imagePath, characters)
  if (!asset) return null
  const snapshot = getAssetReviewSnapshot(asset, { imagePath })
  return snapshot.isApproved ? snapshot : null
}
