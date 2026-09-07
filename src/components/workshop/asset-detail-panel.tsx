import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImageIcon,
  Loader2,
  Package,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { AssetImageGallery } from '@/components/workshop/asset-image-gallery'
import { ASSET_KIND_UI, assetStatusBadge } from '@/components/workshop/asset-kind-labels'
import { CharacterVoiceField } from '@/components/workshop/character-voice-field'
import { WorkshopAiButton } from '@/components/workshop/workshop-ai-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/input'
import { downloadImagePreview } from '@/lib/canvas/canvas-image-actions'
import { readImageAsDataUrl } from '@/lib/storage/fs-service'
import {
  MAX_REFERENCE_IMAGES,
  adjustPrimaryAfterRemove,
  buildImageFieldsFromPaths,
  clearAssetReviewPatch,
  getGeneratedImagePaths,
  getPrimaryGeneratedIndex,
  getReferenceImagePaths,
  getSelectedReferenceImageIndex,
  hasAssetReviewSynced,
  isSameAssetMediaPath,
  shouldClearReviewForImageChange,
} from '@/lib/workflow/asset-utils'
import { getLayoutPresetsForKind, resolveProjectAssetLayoutKey } from '@/lib/workflow/layout-presets'
import { useSettingsStore } from '@/stores/settings-store'
import { ReviewShieldBadge } from '@/components/workshop/review-shield-badge'
import type { AppSettings, ModelConfig } from '@/types/settings'
import type { AssetKind, WorkflowAsset } from '@/types/workflow'
import { saveProjectMediaFromFiles } from '@/lib/workflow/project-media-save'
import {
  getReviewProviderLabel,
  resolveReviewProvider,
} from '@/lib/workflow/character-review-service'
import { getAssetReviewSnapshot } from '@/lib/workflow/asset-review-status'
import { materialLibrarySyncButtonLabel, materialLibrarySyncButtonTip } from '@/lib/materials/material-library-service'
import { cn } from '@/lib/utils'

interface AssetDetailPanelProps {
  kind: AssetKind
  asset: WorkflowAsset | null
  projectId: string
  settings: AppSettings | null
  appDataDir: string
  generating: boolean
  canGoPrev: boolean
  canGoNext: boolean
  projectRoot?: string
  reviewModel?: ModelConfig | null
  syncingReview?: boolean
  syncedToMaterialLibrary?: boolean
  syncingToMaterialLibrary?: boolean
  onPrev: () => void
  onNext: () => void
  onChange: (patch: Partial<WorkflowAsset>) => void
  onGenerate: () => void
  /** 当前资产处于生图中时可终止 */
  onStopGenerate?: () => void
  onSyncReview?: () => void
  onSyncToMaterialLibrary?: () => void
}

function pickImageFiles(files: FileList | File[]): File[] {
  return Array.from(files).filter((f) => f.type.startsWith('image/'))
}

export function AssetDetailPanel({
  kind,
  asset,
  projectId,
  settings,
  appDataDir,
  generating,
  canGoPrev,
  canGoNext,
  projectRoot,
  reviewModel,
  syncingReview = false,
  syncedToMaterialLibrary = false,
  syncingToMaterialLibrary = false,
  onPrev,
  onNext,
  onChange,
  onGenerate,
  onStopGenerate,
  onSyncReview,
  onSyncToMaterialLibrary,
}: AssetDetailPanelProps) {
  const navigate = useNavigate()
  const ui = ASSET_KIND_UI[kind]
  const rememberDefaultAssetLayoutKey = useSettingsStore((s) => s.rememberDefaultAssetLayoutKey)
  const refFileInputRef = useRef<HTMLInputElement>(null)
  const cardFileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [downloadingImage, setDownloadingImage] = useState(false)
  const [generatedPreviewIndex, setGeneratedPreviewIndex] = useState(0)

  const primaryIndex = asset
    ? getPrimaryGeneratedIndex(asset, getGeneratedImagePaths(asset).length)
    : 0

  useEffect(() => {
    if (!asset) return
    setGeneratedPreviewIndex(primaryIndex)
  }, [asset?.id, primaryIndex, asset])

  if (!asset) {
    return (
      <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center text-muted-foreground px-8 bg-card rounded-lg border border-border">
        <ImageIcon className="h-12 w-12 mb-3 opacity-25" />
        <p className="text-sm">请从左侧列表选择{ui.list.replace('列表', '')}</p>
        <p className="text-xs mt-2 opacity-70">或点击列表右上角 + 新增</p>
      </div>
    )
  }

  const layoutOptions = getLayoutPresetsForKind(asset.kind, settings).map((p) => ({
    value: p.key,
    label: p.name,
  }))
  const badge = assetStatusBadge(asset.status)
  const displayName = asset.name.trim() || `新${ui.list.replace('列表', '')}`

  const refPaths = getReferenceImagePaths(asset)
  const genPaths = getGeneratedImagePaths(asset)
  const refSelectedIndex = getSelectedReferenceImageIndex(asset, refPaths.length)

  const reviewProviderLabel = getReviewProviderLabel(resolveReviewProvider(reviewModel))
  const hasReviewImage = genPaths.length > 0 || refPaths.length > 0
  const activeGeneratedPath = genPaths[generatedPreviewIndex]
  const reviewSnapshot =
    kind === 'character' ? getAssetReviewSnapshot(asset) : null
  const galleryReviewSnapshot =
    kind === 'character'
      ? getAssetReviewSnapshot(asset, { imagePath: activeGeneratedPath })
      : null

  const reviewClearPatch = (nextImagePath?: string) =>
    shouldClearReviewForImageChange(asset, nextImagePath) ? clearAssetReviewPatch() : {}

  const patchImages = (
    refs: string[],
    gens: string[],
    extra?: Partial<WorkflowAsset>,
    nextPrimaryIndex?: number,
  ) => {
    const primary =
      nextPrimaryIndex ??
      (gens.length ? getPrimaryGeneratedIndex(asset, gens.length) : undefined) ??
      0
    onChange({ ...buildImageFieldsFromPaths(refs, gens, primary), ...extra })
  }

  const appendReferenceImages = async (files: File[]) => {
    const imageFiles = pickImageFiles(files)
    if (!imageFiles.length) {
      toast.error('请选择图片文件')
      return
    }
    if (!settings?.dataRootPath?.trim()) {
      toast.error('请先在系统设置中配置数据根目录')
      return
    }
    if (!projectId?.trim()) {
      toast.error('项目未加载，无法保存图片')
      return
    }
    const remaining = MAX_REFERENCE_IMAGES - refPaths.length
    if (remaining <= 0) {
      toast.message(`参考图最多 ${MAX_REFERENCE_IMAGES} 张`)
      return
    }
    const batch = imageFiles.slice(0, remaining)
    setUploadingImages(true)
    try {
      const savedPaths = await saveProjectMediaFromFiles(batch, {
        settings,
        appDataDir,
        projectId,
        entityId: asset.id,
        target: kind,
        purpose: 'ref',
      })
      const merged = [...refPaths, ...savedPaths]
      patchImages(merged, genPaths, { status: 'draft' })
      if (imageFiles.length > batch.length) {
        toast.message(`已添加 ${batch.length} 张，参考图最多 ${MAX_REFERENCE_IMAGES} 张`)
      }
    } catch (error: unknown) {
      const err = error as Error
      toast.error(err.message || '保存参考图失败')
    } finally {
      setUploadingImages(false)
    }
  }

  const appendGeneratedImages = async (files: File[]) => {
    const imageFiles = pickImageFiles(files)
    if (!imageFiles.length) {
      toast.error('请选择图片文件')
      return
    }
    if (!settings?.dataRootPath?.trim()) {
      toast.error('请先在系统设置中配置数据根目录')
      return
    }
    if (!projectId?.trim()) {
      toast.error('项目未加载，无法保存图片')
      return
    }
    setUploadingImages(true)
    try {
      const savedPaths = await saveProjectMediaFromFiles(imageFiles, {
        settings,
        appDataDir,
        projectId,
        entityId: asset.id,
        target: kind,
        purpose: 'gen',
      })
      const merged = [...genPaths, ...savedPaths]
      const newPrimaryPath = merged[merged.length - 1]
      patchImages(
        refPaths,
        merged,
        { status: 'done', ...reviewClearPatch(newPrimaryPath) },
        merged.length - 1,
      )
    } catch (error: unknown) {
      const err = error as Error
      toast.error(err.message || '保存生成图失败')
    } finally {
      setUploadingImages(false)
    }
  }

  const handleSelectReference = () => {
    if (uploadingImages) return
    if (refPaths.length >= MAX_REFERENCE_IMAGES) {
      toast.message(`参考图最多 ${MAX_REFERENCE_IMAGES} 张`)
      return
    }
    refFileInputRef.current?.click()
  }

  const handleSelectCard = () => {
    if (uploadingImages) return
    cardFileInputRef.current?.click()
  }

  const handleDownloadGenerated = async () => {
    if (!genPaths.length || downloadingImage) return
    const index = Math.min(generatedPreviewIndex, genPaths.length - 1)
    const path = genPaths[index]
    if (!path) return

    setDownloadingImage(true)
    try {
      const dataUrl = await readImageAsDataUrl(path, projectRoot)
      if (!dataUrl) {
        toast.error('无法读取图片')
        return
      }
      const baseName = (asset.name.trim() || ui.list.replace('列表', '')).replace(/[\\/:*?"<>|]/g, '_')
      const ext = path.match(/\.(\w+)$/i)?.[1]?.toLowerCase() || 'png'
      downloadImagePreview(dataUrl, `${baseName}-${index + 1}.${ext}`)
    } catch (error: unknown) {
      const err = error as Error
      toast.error(err.message || '下载失败')
    } finally {
      setDownloadingImage(false)
    }
  }

  const handleRefFileChange = async (fileList: FileList | null) => {
    await appendReferenceImages(Array.from(fileList ?? []))
    if (refFileInputRef.current) refFileInputRef.current.value = ''
  }

  const handleCardFileChange = async (fileList: FileList | null) => {
    await appendGeneratedImages(Array.from(fileList ?? []))
    if (cardFileInputRef.current) cardFileInputRef.current.value = ''
  }

  const handleRemoveReferenceAt = (index: number) => {
    const nextRefs = refPaths.filter((_, i) => i !== index)
    const nextSelected = adjustPrimaryAfterRemove(refSelectedIndex, index, nextRefs.length)
    patchImages(nextRefs, genPaths, {
      selectedReferenceImageIndex: nextRefs.length ? nextSelected : undefined,
    })
  }

  const handleReferenceSelect = (index: number) => {
    onChange({ selectedReferenceImageIndex: index })
  }

  const handleRemoveGeneratedAt = (index: number) => {
    const removedPath = genPaths[index]
    const nextGens = genPaths.filter((_, i) => i !== index)
    const nextPrimary = adjustPrimaryAfterRemove(primaryIndex, index, nextGens.length)
    const nextPrimaryPath = nextGens[nextPrimary]
    const extra: Partial<WorkflowAsset> = {
      status: nextGens.length ? asset.status : 'draft',
    }
    if (
      hasAssetReviewSynced(asset) &&
      (isSameAssetMediaPath(removedPath, asset.reviewImagePath) ||
        shouldClearReviewForImageChange(asset, nextPrimaryPath))
    ) {
      Object.assign(extra, clearAssetReviewPatch())
    }
    patchImages(refPaths, nextGens, extra, nextPrimary)
  }

  const handleGeneratedPreviewChange = (index: number) => {
    setGeneratedPreviewIndex(index)
    const path = genPaths[index]
    if (shouldClearReviewForImageChange(asset, path)) {
      onChange(clearAssetReviewPatch())
    }
  }

  const handleSetPrimary = (index: number) => {
    const path = genPaths[index]
    const clearPatch = reviewClearPatch(path)
    patchImages(refPaths, genPaths, clearPatch, index)
    setGeneratedPreviewIndex(index)
    if (Object.keys(clearPatch).length) {
      toast.message('主图已更换，微视/即梦审核已清除，请重新同步')
    } else {
      toast.success('已设为主图')
    }
  }

  const handleClearReference = () => {
    patchImages([], genPaths, {
      status: asset.status,
      selectedReferenceImageIndex: undefined,
      ...(hasAssetReviewSynced(asset) && !genPaths.length ? clearAssetReviewPatch() : {}),
    })
  }

  const handleClearGenerated = () => {
    patchImages(refPaths, [], { status: 'draft', ...clearAssetReviewPatch() }, 0)
  }

  return (
    <div className="flex flex-col h-full min-h-0 rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border shrink-0 bg-muted/40">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-base font-semibold truncate">{displayName}</h3>
          <span className={cn('text-[10px] px-2 py-0.5 rounded shrink-0', badge.className)}>
            {badge.label}
          </span>
          {reviewSnapshot?.hasSynced ? (
            <ReviewShieldBadge
              variant="inline"
              state={reviewSnapshot.visualState}
              title={reviewSnapshot.title}
              label={reviewSnapshot.badgeLabel}
            />
          ) : null}
          {syncedToMaterialLibrary ? (
            <span
              title="已写入素材库索引（图片来自本项目，再次点击可更新）"
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded shrink-0 bg-cyan-600/90 text-white"
            >
              <Package className="h-2.5 w-2.5" strokeWidth={2.25} />
              素材库
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={!canGoPrev}
            onClick={onPrev}
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 px-2 py-1"
          >
            <ChevronLeft className="h-4 w-4" />
            上一个
          </button>
          <button
            type="button"
            disabled={!canGoNext}
            onClick={onNext}
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 px-2 py-1"
          >
            下一个
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(480px,50%)] gap-6 h-full">
          <div className="space-y-4 min-w-0">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{ui.name}</Label>
              <Input
                data-testid="workshop-asset-name"
                value={asset.name}
                onChange={(e) => onChange({ name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{ui.description}</Label>
              <Textarea
                data-testid="workshop-asset-description"
                value={asset.description}
                onChange={(e) => onChange({ description: e.target.value, prompt: e.target.value })}
                rows={8}
                className="resize-none text-sm leading-relaxed min-h-[180px]"
                placeholder={
                  kind === 'character'
                    ? '详细描述角色的外貌、服装、特征等…'
                    : kind === 'scene'
                      ? '详细描述场景的环境、光线、氛围等…'
                      : '详细描述物品的外观、材质、用途等…'
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">布局形式</Label>
              <Select
                value={resolveProjectAssetLayoutKey(
                  asset.layoutKey,
                  kind,
                  settings?.defaultAssetLayoutKeys,
                )}
                onChange={(value) => {
                  rememberDefaultAssetLayoutKey(kind, value)
                  onChange({ layoutKey: value })
                }}
                options={layoutOptions}
                footerAction={{
                  label: '去设置自定义布局形式',
                  onSelect: () =>
                    navigate(
                      `/settings/templates?section=layoutTemplates&layoutKind=${kind}`,
                    ),
                }}
              />
              {kind === 'character' ? (
                <p className="text-[11px] text-muted-foreground/80">
                  决定该角色参考图按哪种版式输出
                </p>
              ) : kind === 'scene' ? (
                <p className="text-[11px] text-muted-foreground/80">
                  决定该场景参考图按哪种版式输出
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground/80">
                  决定该物品参考图按哪种版式输出
                </p>
              )}
            </div>

            {kind === 'character' ? (
              <CharacterVoiceField
                projectId={projectId}
                voiceType={asset.voiceType}
                onChange={(value) => onChange({ voiceType: value })}
              />
            ) : null}
          </div>

          <div className="flex flex-col min-w-0 gap-4">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,8fr)] gap-4 items-start">
              <div className="flex flex-col gap-2 min-w-0">
                <AssetImageGallery
                  title="参考图"
                  paths={refPaths}
                  emptyLabel="上传参考图"
                  emptySubLabel={`可多选，最多 ${MAX_REFERENCE_IMAGES} 张；生图使用当前选中张`}
                  variant="reference"
                  maxCount={MAX_REFERENCE_IMAGES}
                  projectRoot={projectRoot}
                  primaryIndex={refPaths.length ? refSelectedIndex : undefined}
                  onActiveIndexChange={refPaths.length ? handleReferenceSelect : undefined}
                  onAdd={handleSelectReference}
                  onDropFiles={(files) => void appendReferenceImages(files)}
                  onRemoveAt={handleRemoveReferenceAt}
                />
                <input
                  ref={refFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleRefFileChange(e.target.files)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-border/60"
                    disabled={refPaths.length === 0}
                    onClick={handleClearReference}
                  >
                    <X className="h-3.5 w-3.5" />
                    清除
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2 min-w-0">
                <AssetImageGallery
                  title={ui.card}
                  paths={genPaths}
                  emptyLabel={`上传或生成${ui.card}`}
                  variant="generated"
                  projectRoot={projectRoot}
                  primaryIndex={primaryIndex}
                  generating={generating || asset.status === 'generating'}
                  reviewShield={
                    galleryReviewSnapshot?.hasSynced
                      ? {
                          state: galleryReviewSnapshot.visualState,
                          title: galleryReviewSnapshot.title,
                          label: galleryReviewSnapshot.badgeLabel,
                        }
                      : undefined
                  }
                  onSetPrimary={genPaths.length ? handleSetPrimary : undefined}
                  onActiveIndexChange={genPaths.length ? handleGeneratedPreviewChange : undefined}
                  onAdd={handleSelectCard}
                  onDropFiles={(files) => void appendGeneratedImages(files)}
                  onRemoveAt={genPaths.length ? handleRemoveGeneratedAt : undefined}
                />
                <input
                  ref={cardFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleCardFileChange(e.target.files)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-border/60"
                    disabled={genPaths.length === 0}
                    onClick={handleClearGenerated}
                  >
                    <X className="h-3.5 w-3.5" />
                    清除
                  </Button>
                  {genPaths.length > 0 ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-border/60"
                        disabled={uploadingImages || generating}
                        onClick={handleSelectCard}
                      >
                        {uploadingImages ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        上传
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-border/60"
                        disabled={downloadingImage || generating}
                        onClick={() => void handleDownloadGenerated()}
                      >
                        {downloadingImage ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        下载
                      </Button>
                    </>
                  ) : null}
                  {asset.status === 'generating' && onStopGenerate ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="gap-1.5"
                      data-testid="workshop-asset-stop-generate"
                      onClick={onStopGenerate}
                    >
                      停止生成
                    </Button>
                  ) : (
                    <WorkshopAiButton
                      type="button"
                      sizePreset="default"
                      loading={generating}
                      onClick={onGenerate}
                    >
                      {genPaths.length > 0 ? '重新生成' : 'AI生成'}
                    </WorkshopAiButton>
                  )}
                  {kind === 'character' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-border/60 ml-auto"
                      disabled={!hasReviewImage || syncingReview || !onSyncReview}
                      onClick={onSyncReview}
                    >
                      {syncingReview ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : null}
                      同步到{reviewProviderLabel}审核
                    </Button>
                  ) : null}
                  {onSyncToMaterialLibrary ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="workshop-asset-sync-material"
                      className={cn(
                        'gap-1.5 border-border/60',
                        kind !== 'character' ? 'ml-auto' : '',
                      )}
                      title={materialLibrarySyncButtonTip({
                        synced: syncedToMaterialLibrary,
                        hasMedia: genPaths.length + refPaths.length > 0,
                      })}
                      disabled={syncingToMaterialLibrary || genPaths.length + refPaths.length === 0}
                      onClick={onSyncToMaterialLibrary}
                    >
                      {syncingToMaterialLibrary ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Package className="h-3.5 w-3.5" />
                      )}
                      {materialLibrarySyncButtonLabel(syncedToMaterialLibrary)}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
