import type { ModelConfig } from '@/types/settings'
import type { WorkflowAsset } from '@/types/workflow'
import {
  isJimengAssetReady,
  pollJimengReviewAsset,
  uploadJimengReviewAsset,
} from '@/lib/models/jimeng-asset-service'
import {
  isWeishiAssetReady,
  pollWeishiReviewAsset,
  resolveImageBlobForWeishiUpload,
  uploadWeishiReviewAsset,
} from '@/lib/models/weishi-asset-service'
import { isWeishiReviewModel } from '@/lib/models/weishi-model-presets'
import { resolveWeishiApiKey } from '@/lib/auth/org-weishi-key'
import { canUseBackendFileUpload, isLoginRequired } from '@/lib/auth/login-mode'
import { uploadReferenceImageForGeneration } from '@/lib/workflow/reference-image-upload'
import { pickAssetReviewImagePath } from '@/lib/workflow/asset-utils'

export type ReviewProvider = 'weishi' | 'jimeng'

export function resolveReviewProvider(model?: ModelConfig | null): ReviewProvider {
  return isWeishiReviewModel(model) ? 'weishi' : 'jimeng'
}

export function getReviewProviderLabel(provider: ReviewProvider): string {
  return provider === 'weishi' ? '微视' : '即梦'
}

/** 资产同步审核通道由当前选用的视频大模型决定：微视 API → 微视审核，其它 → 即梦 */
export function resolveAssetReviewModelFromVideoModel(
  videoModels: ModelConfig[],
  videoModelId: string | undefined,
  imageModels: ModelConfig[],
): ModelConfig | null {
  const videoModel =
    (videoModelId ? videoModels.find((m) => m.id === videoModelId) : undefined) ??
    videoModels[0] ??
    null

  if (videoModel && isWeishiReviewModel(videoModel)) return videoModel

  const jimengCarrier = imageModels.find((m) => !isWeishiReviewModel(m))
  if (jimengCarrier) return jimengCarrier

  // 无图片模型时仍返回非微视占位，便于走即梦 apiBaseUrl 通道
  if (videoModel && !isWeishiReviewModel(videoModel)) {
    return videoModel
  }

  return null
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
  jimengAssetId?: string
  jimengAssetStatus?: string
  reviewImagePath?: string
}

export async function syncCharacterToReview(
  asset: WorkflowAsset,
  model: ModelConfig,
  options?: { projectRoot?: string; apiBaseUrl?: string },
): Promise<CharacterReviewSyncResult> {
  const imagePath = pickCharacterReviewImagePath(asset)
  if (!imagePath) throw new Error('请先为角色生成或上传角色图')

  const provider = resolveReviewProvider(model)
  const label = asset.name?.trim() || 'character'

  if (provider === 'weishi') {
    if (!model.endpoint?.trim()) {
      throw new Error('请先在模型配置中填写微视 API 地址')
    }
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

  if (!isLoginRequired()) {
    throw new Error('本地模式不支持即梦审核同步，请使用微视视频模型，或设置 VITE_LOGIN_REQUIRED=true 后重新打包')
  }

  const publicUrl = await uploadReferenceImageForGeneration(imagePath, {
    apiBaseUrl: options?.apiBaseUrl,
    label,
    projectRoot: options?.projectRoot,
  })
  const uploaded = await uploadJimengReviewAsset({
    apiBaseUrl: options?.apiBaseUrl,
    url: publicUrl,
    name: label,
    assetType: 'Image',
  })

  let settled = uploaded
  if (uploaded.recordId && !isJimengAssetReady(uploaded.status)) {
    settled = await pollJimengReviewAsset({
      apiBaseUrl: options?.apiBaseUrl,
      recordId: uploaded.recordId,
    })
  }

  return {
    provider: 'jimeng',
    jimengAssetId: settled.jimengAssetId,
    jimengAssetStatus: settled.status || 'processing',
    reviewImagePath: imagePath,
  }
}
