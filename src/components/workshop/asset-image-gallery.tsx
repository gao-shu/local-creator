import { useEffect, useState, type DragEvent } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react'
import { ReviewShieldBadge } from '@/components/workshop/review-shield-badge'
import { ImagePreviewModal } from '@/components/ui/image-preview-modal'
import { readImageAsDataUrl } from '@/lib/storage/fs-service'
import type { AssetReviewVisualState } from '@/lib/workflow/asset-review-status'
import { cn } from '@/lib/utils'

interface AssetImageGalleryProps {
  title: string
  paths: string[]
  emptyLabel?: string
  emptySubLabel?: string
  variant: 'reference' | 'generated'
  maxCount?: number
  onAdd?: () => void
  onDropFiles?: (files: File[]) => void
  onRemoveAt?: (index: number) => void
  showUploadOnEmpty?: boolean
  primaryIndex?: number
  onSetPrimary?: (index: number) => void
  onActiveIndexChange?: (index: number) => void
  /** 项目根目录，用于读取 Roles/Scenes 等相对路径生图结果 */
  projectRoot?: string
  /** 角色图审核盾牌（同步审核通道后显示） */
  reviewShield?: {
    state: AssetReviewVisualState
    title?: string
    label?: string
  }
  /** 生图进行中：主预览区遮罩 + 转圈 */
  generating?: boolean
}

function pickImageFiles(files: FileList | File[]): File[] {
  return Array.from(files).filter((f) => f.type.startsWith('image/'))
}

export function AssetImageGallery({
  title,
  paths,
  emptyLabel = '暂无图片',
  emptySubLabel,
  variant,
  maxCount,
  onAdd,
  onDropFiles,
  onRemoveAt,
  showUploadOnEmpty = true,
  primaryIndex,
  onSetPrimary,
  onActiveIndexChange,
  projectRoot,
  reviewShield,
  generating = false,
}: AssetImageGalleryProps) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      const urls = await Promise.all(
        paths.map(async (path) => (path ? await readImageAsDataUrl(path, projectRoot) : null)),
      )
      if (!active) return
      setPreviewUrls(urls.map((url) => url ?? ''))
      setActiveIndex((prev) => {
        if (!paths.length) return 0
        return Math.min(prev, paths.length - 1)
      })
    }

    void load()
    return () => {
      active = false
    }
  }, [paths, projectRoot])

  useEffect(() => {
    if (paths.length && primaryIndex != null) {
      setActiveIndex(Math.min(primaryIndex, paths.length - 1))
    }
  }, [paths.length, primaryIndex])

  const activeUrl = previewUrls[activeIndex] || null

  useEffect(() => {
    setLightboxOpen(false)
  }, [activeUrl, paths])

  const isPrimary = variant === 'generated' && primaryIndex === activeIndex
  const canAdd = onAdd && (!maxCount || paths.length < maxCount)
  const canDrop = Boolean(onDropFiles) && (!maxCount || paths.length < maxCount)
  const isGeneratedGallery = variant === 'generated'
  const isReferenceGallery = variant === 'reference'
  const showStackedLayout = paths.length > 0 && isReferenceGallery
  const showSideLayout = paths.length > 0 && isGeneratedGallery
  const thumbListClass = isGeneratedGallery
    ? 'grid grid-cols-2 gap-1.5 shrink-0 w-[9rem] content-start'
    : 'grid grid-cols-3 gap-1.5 w-full content-start'

  const selectIndex = (index: number, setPrimary = false) => {
    setActiveIndex(index)
    onActiveIndexChange?.(index)
    if (setPrimary && onSetPrimary) onSetPrimary(index)
  }

  const goPrevImage = () => {
    if (activeIndex <= 0) return
    selectIndex(activeIndex - 1)
  }

  const goNextImage = () => {
    if (activeIndex >= paths.length - 1) return
    selectIndex(activeIndex + 1)
  }

  const handleDragEnter = (e: DragEvent) => {
    if (!canDrop) return
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const handleDragOver = (e: DragEvent) => {
    if (!canDrop) return
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (!onDropFiles || !canDrop) return
    const files = pickImageFiles(e.dataTransfer.files)
    if (files.length) onDropFiles(files)
  }

  const thumbList = (
    <div className={thumbListClass}>
      {paths.map((path, index) => {
        const url = previewUrls[index]
        const selected = index === activeIndex
        const isItemPrimary = variant === 'generated' && primaryIndex === index
        return (
          <button
            key={`${path}-${index}`}
            type="button"
            onClick={() => {
              if (variant === 'generated' && onSetPrimary && !isItemPrimary) {
                selectIndex(index, true)
                return
              }
              selectIndex(index)
            }}
            className={cn(
              'relative aspect-square w-full rounded-lg border overflow-hidden bg-muted transition-colors',
              selected
                ? 'border-cyan-500 ring-1 ring-cyan-500/50'
                : isItemPrimary
                  ? 'border-amber-500/70 hover:border-amber-500'
                  : 'border-border/40 hover:border-border/70',
            )}
          >
            {url ? (
              <img src={url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <ImageIcon className="h-4 w-4 opacity-30" />
              </div>
            )}
            {variant === 'generated' && !isItemPrimary && onSetPrimary ? (
              <span className="absolute inset-x-0 bottom-0 px-0.5 py-1 text-[9px] leading-tight text-center text-white bg-gradient-to-t from-black/80 via-black/55 to-transparent">
                点击设为主图
              </span>
            ) : null}
            {variant === 'reference' && selected ? (
              <span className="absolute inset-x-0 bottom-0 px-0.5 py-1 text-[10px] leading-tight text-center font-medium text-cyan-400 bg-gradient-to-t from-black/80 via-black/55 to-transparent">
                已选
              </span>
            ) : null}
            {onRemoveAt && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveAt(index)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation()
                    onRemoveAt(index)
                  }
                }}
                className="absolute top-0.5 right-0.5 p-0.5 rounded bg-foreground/70 text-background hover:bg-foreground/85"
              >
                <X className="h-2.5 w-2.5" />
              </span>
            )}
          </button>
        )
      })}
      {canAdd && (
        <button
          type="button"
          onClick={onAdd}
          className={cn(
            'aspect-square w-full rounded-lg border border-dashed bg-muted/50 hover:border-cyan-500/40 hover:bg-cyan-500/10 flex items-center justify-center text-muted-foreground transition-colors',
            isGeneratedGallery
              ? 'border-border'
              : 'border-cyan-500/40 text-cyan-600 dark:text-cyan-400 flex-col gap-1',
          )}
        >
          {isGeneratedGallery ? (
            <Plus className="h-4 w-4" />
          ) : (
            <>
              <Upload className="h-4 w-4" />
              <span className="text-[10px] font-medium">添加</span>
            </>
          )}
        </button>
      )}
    </div>
  )

  const emptyContent = (
    <button
      type="button"
      onClick={canAdd ? onAdd : undefined}
      disabled={!canAdd && !canDrop}
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground transition-colors disabled:cursor-default"
    >
      {showUploadOnEmpty && (onAdd || onDropFiles) ? (
        <>
          {variant === 'generated' ? (
            <Sparkles className="h-7 w-7 text-cyan-600 dark:text-cyan-400/80" />
          ) : (
            <Upload className="h-7 w-7" />
          )}
          <span className="text-sm">{emptyLabel}</span>
          {emptySubLabel && (
            <span className="text-[11px] opacity-60 px-3 text-center">{emptySubLabel}</span>
          )}
          {canDrop && (
            <span className="text-[10px] opacity-50">支持拖拽图片到此处</span>
          )}
        </>
      ) : (
        <>
          <ImageIcon className="h-10 w-10 opacity-30" />
          <span className="text-xs">{emptyLabel}</span>
        </>
      )}
    </button>
  )

  const mainPreview = (
    <div
      className={cn(
        'relative rounded-lg border bg-muted/40 overflow-hidden transition-colors',
        isGeneratedGallery && paths.length
          ? 'w-full aspect-[3/4] min-h-0'
          : isReferenceGallery && paths.length
            ? 'w-full aspect-square min-h-0'
            : 'flex-1 min-w-0 min-h-[200px]',
        dragOver
          ? 'border-cyan-500/60 border-dashed bg-cyan-500/10'
          : paths.length
            ? 'border-border'
            : 'border-dashed border-border',
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {activeUrl ? (
        <>
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute inset-0 z-0 block w-full h-full cursor-zoom-in group/preview"
            aria-label={`点击放大${title}`}
            title="点击放大"
          >
            <img
              src={activeUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-contain pointer-events-none transition-opacity group-hover/preview:opacity-95"
            />
          </button>
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="absolute top-2 right-2 z-[2] inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/75 text-muted-foreground hover:text-foreground hover:bg-background/90 border border-border/50"
            aria-label="放大预览"
            title="放大预览"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          {reviewShield?.state && reviewShield.state !== 'none' ? (
            <ReviewShieldBadge
              variant="ribbon"
              state={reviewShield.state}
              title={reviewShield.title}
              label={reviewShield.label}
            />
          ) : null}
        </>
      ) : (
        emptyContent
      )}

      {dragOver && canDrop && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-cyan-500/15 pointer-events-none">
          <span className="text-sm text-cyan-700 dark:text-cyan-300">松开以添加图片</span>
        </div>
      )}

      {generating ? (
        <div
          className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-2 bg-background/55 backdrop-blur-[1px] pointer-events-none"
          data-testid="asset-image-gallery-generating"
        >
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          <span className="text-xs font-medium text-cyan-600 dark:text-cyan-400">生成中…</span>
        </div>
      ) : null}
    </div>
  )

  const mainPreviewMeta =
    variant === 'generated' && paths.length > 0 && activeUrl ? (
      <div className="flex items-center gap-3 min-h-[18px]">
        {isPrimary ? (
          <span className="text-xs font-semibold text-cyan-500">主图</span>
        ) : onSetPrimary ? (
          <button
            type="button"
            onClick={() => onSetPrimary(activeIndex)}
            className="text-xs text-muted-foreground hover:text-cyan-500 transition-colors"
          >
            点击设为主图
          </button>
        ) : null}
        <span className="text-[10px] text-muted-foreground/70 ml-auto">AI生成</span>
      </div>
    ) : null

  return (
    <div
      className="space-y-2 min-w-0"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{title}</span>
        {variant === 'generated' && paths.length > 1 ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={activeIndex <= 0}
              onClick={goPrevImage}
              className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30 px-1.5 py-0.5"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              上一个
            </button>
            <button
              type="button"
              disabled={activeIndex >= paths.length - 1}
              onClick={goNextImage}
              className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30 px-1.5 py-0.5"
            >
              下一个
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : paths.length > 0 ? (
          <span className="text-[10px] text-muted-foreground/70">
            {activeIndex + 1}/{paths.length}
            {maxCount ? ` · 最多 ${maxCount} 张` : ''}
          </span>
        ) : null}
      </div>

      {showSideLayout ? (
        <div className="flex gap-2 items-start w-full min-w-0">
          <div
            className={cn(
              'flex flex-col flex-1 min-w-0 gap-1.5',
              isGeneratedGallery && 'min-w-[8.5rem]',
            )}
          >
            {mainPreview}
            {mainPreviewMeta}
          </div>
          {thumbList}
        </div>
      ) : showStackedLayout ? (
        <div className="flex flex-col gap-2 w-full min-w-0">
          {mainPreview}
          {thumbList}
        </div>
      ) : (
        <div className="min-h-[200px]">{mainPreview}</div>
      )}

      {lightboxOpen && activeUrl ? (
        <ImagePreviewModal imageUrl={activeUrl} alt={title} onClose={() => setLightboxOpen(false)} />
      ) : null}
    </div>
  )
}
