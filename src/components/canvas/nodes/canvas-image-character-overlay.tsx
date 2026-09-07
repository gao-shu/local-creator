// Copyright (c) local-creator contributors. All rights reserved.

import { useCallback, useMemo, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useSettingsStore } from '@/stores/settings-store'
import { resolveCanvasProjectRoot } from '@/lib/canvas/canvas-project-paths'
import {
  canvasImageNodeToReviewAsset,
  resolveCanvasVideoReviewModel,
} from '@/lib/canvas/canvas-image-character'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'
import {
  resolveReviewProvider,
  syncCharacterToReview,
} from '@/lib/workflow/character-review-service'
import {
  getAssetReviewSnapshot,
  type AssetReviewVisualState,
} from '@/lib/workflow/asset-review-status'
import type { CanvasImageNodeData } from '@/types/canvas-nodes'
import { cn } from '@/lib/utils'

/** 与创作工坊 ReviewShieldBadge 状态色一致；未同步保持中性底色 */
const REVIEW_SHIELD_BUTTON_CLASS: Record<
  Exclude<AssetReviewVisualState, 'none'>,
  string
> = {
  approved: 'border-emerald-400/50 bg-emerald-500 text-white shadow-emerald-500/30 hover:bg-emerald-500',
  processing:
    'border-amber-400/50 bg-amber-500 text-white shadow-amber-500/30 hover:bg-amber-500 animate-pulse',
  failed: 'border-red-400/50 bg-red-500 text-white shadow-red-500/30 hover:bg-red-500',
}

interface CanvasImageCharacterOverlayProps {
  nodeId: string
  projectId: string
  data: CanvasImageNodeData
  hasImage: boolean
  onPatch: (patch: Partial<CanvasImageNodeData>) => void
}

function OverlayIconButton({
  title,
  disabled,
  loading,
  onClick,
  children,
  className,
}: {
  title: string
  disabled?: boolean
  loading?: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled || loading}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'nodrag nopan flex h-8 w-8 items-center justify-center rounded-lg border shadow-md backdrop-blur-sm transition-colors',
        'border-background/80 bg-black/55 text-white/90 hover:bg-black/70',
        'disabled:pointer-events-none disabled:opacity-45',
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  )
}

/** 资产图片预览区：微视/即梦审核盾牌 */
export function CanvasImageCharacterOverlay({
  nodeId,
  projectId,
  data,
  hasImage,
  onPatch,
}: CanvasImageCharacterOverlayProps) {
  const settings = useSettingsStore((state) => state.settings)
  const appDataDir = useSettingsStore((state) => state.appDataDir)
  const getMergedModels = useSettingsStore((state) => state.getMergedModels)
  const { canvasVideoParams } = useCanvasEditor()

  const [syncingReview, setSyncingReview] = useState(false)

  const videoModels = getMergedModels('video')
  const imageModels = getMergedModels('image')
  const reviewModel = useMemo(
    () =>
      resolveCanvasVideoReviewModel(
        videoModels,
        imageModels,
        canvasVideoParams.videoModelId || settings?.lastUsedStoryboardVideoModelId,
      ),
    [
      videoModels,
      imageModels,
      canvasVideoParams.videoModelId,
      settings?.lastUsedStoryboardVideoModelId,
    ],
  )
  const reviewProvider = reviewModel ? resolveReviewProvider(reviewModel) : null
  const reviewTooltip = reviewProvider === 'weishi' ? '到微视审核' : ''

  const reviewAsset = useMemo(
    () => canvasImageNodeToReviewAsset(nodeId, data),
    [nodeId, data],
  )
  const reviewSnapshot = useMemo(
    () => getAssetReviewSnapshot(reviewAsset, { imagePath: data.outputPath }),
    [reviewAsset, data.outputPath],
  )

  const handleSyncReview = useCallback(async () => {
    if (!reviewModel) {
      toast.error('请先在 Step4 生视频页选择视频大模型，或在设置中配置微视 API')
      return
    }
    if (!data.outputPath) {
      toast.error('请先生成或上传资产图')
      return
    }
    setSyncingReview(true)
    try {
      const projectRoot = resolveCanvasProjectRoot(settings, appDataDir, projectId)
      const result = await syncCharacterToReview(reviewAsset, reviewModel, {
        projectRoot,
        apiBaseUrl: settings?.apiBaseUrl,
      })
      onPatch({
        weishiAssetId: result.weishiAssetId,
        weishiAssetUrl: result.weishiAssetUrl,
        weishiAssetStatus: result.weishiAssetStatus,
        jimengAssetId: undefined,
        jimengAssetStatus: undefined,
        reviewImagePath: result.reviewImagePath,
      })
      const label = '微视'
      const nextSnapshot = getAssetReviewSnapshot({
        ...reviewAsset,
        weishiAssetId: result.weishiAssetId,
        weishiAssetStatus: result.weishiAssetStatus,
        jimengAssetId: undefined,
        jimengAssetStatus: undefined,
        reviewImagePath: result.reviewImagePath,
      })
      if (nextSnapshot.isApproved) {
        toast.success(`「${reviewAsset.name}」${label}审核已通过`)
      } else {
        toast.success(`已提交${label}审核：${reviewAsset.name}`)
      }
    } catch (error: unknown) {
      toast.error((error as Error).message || '同步审核失败')
    } finally {
      setSyncingReview(false)
    }
  }, [
    appDataDir,
    data.outputPath,
    onPatch,
    projectId,
    reviewAsset,
    reviewModel,
    settings,
  ])

  if (!hasImage) return null
  if (!reviewProvider) return null

  const shieldVisual = reviewSnapshot.visualState
  const shieldTitleText = reviewSnapshot.title || reviewTooltip

  return (
    <div className="absolute left-2 top-2 z-[12]">
      <OverlayIconButton
        title={shieldTitleText}
        disabled={!data.outputPath}
        loading={syncingReview}
        onClick={() => void handleSyncReview()}
        className={cn(
          'h-7 w-7',
          shieldVisual !== 'none' ? REVIEW_SHIELD_BUTTON_CLASS[shieldVisual] : undefined,
        )}
      >
        <ShieldCheck className="h-4 w-4" strokeWidth={2.5} />
      </OverlayIconButton>
    </div>
  )
}
