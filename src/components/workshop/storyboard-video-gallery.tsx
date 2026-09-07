import { useEffect, useState } from 'react'
import { Film, Star } from 'lucide-react'
import { VideoDragChip } from '@/components/workshop/video-drag-chip'
import {
  getCachedVideoPreviewSrc,
  getCachedVideoThumbnail,
  primeVideoThumbnailCache,
} from '@/lib/video/video-preview-cache'
import { cn } from '@/lib/utils'

interface StoryboardVideoGalleryProps {
  paths: string[]
  primaryIndex?: number
  projectRoot?: string
  shotNumber?: number
  onSelectPrimary: (index: number) => void
  onClear: () => void
}

function VideoGalleryItem({
  path,
  index,
  isPrimary,
  projectRoot,
  shotNumber,
  onSelectPrimary,
}: {
  path: string
  index: number
  isPrimary: boolean
  projectRoot?: string
  shotNumber?: number
  onSelectPrimary: (index: number) => void
}) {
  const [thumb, setThumb] = useState('')
  const filename =
    shotNumber != null ? `shot-${shotNumber}-video-${index + 1}.mp4` : `video-${index + 1}.mp4`

  useEffect(() => {
    let active = true
    void (async () => {
      if (path.startsWith('preview:')) {
        if (active) setThumb('')
        return
      }
      const previewSrc = await getCachedVideoPreviewSrc(path, projectRoot)
      if (!previewSrc) {
        if (active) setThumb('')
        return
      }
      const nextThumb = (await getCachedVideoThumbnail(previewSrc)) ?? ''
      if (nextThumb) primeVideoThumbnailCache(previewSrc, nextThumb)
      if (active) setThumb(nextThumb)
    })()
    return () => {
      active = false
    }
  }, [path, projectRoot])

  return (
    <div
      className={cn(
        'relative shrink-0 w-20 aspect-square rounded-lg border overflow-hidden bg-muted transition-colors',
        isPrimary
          ? 'border-cyan-500 ring-2 ring-cyan-500/40'
          : 'border-border/50 hover:border-border',
      )}
    >
      <button
        type="button"
        onClick={() => onSelectPrimary(index)}
        className="absolute inset-0 z-0"
      >
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <Film className="h-5 w-5 text-muted-foreground/50" />
          </div>
        )}
        {isPrimary ? null : (
          <span className="absolute top-1 left-1 p-0.5 rounded bg-black/50 text-white opacity-0 hover:opacity-100">
            <Star className="h-3 w-3" />
          </span>
        )}
      </button>

      {path.startsWith('preview:') ? null : (
        <VideoDragChip storedPath={path} projectRoot={projectRoot} filename={filename} />
      )}
    </div>
  )
}

export function StoryboardVideoGallery({
  paths,
  primaryIndex = 0,
  projectRoot,
  shotNumber,
  onSelectPrimary,
  onClear,
}: StoryboardVideoGalleryProps) {
  if (paths.length === 0) return null

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-foreground">生成的视频 ({paths.length})</span>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          清空
        </button>
      </div>
      {paths.some((path) => !path.startsWith('preview:')) ? (
        <p className="text-[10px] text-muted-foreground leading-snug">
          点击右上角「拖」按住后拖到剪映；点击「拖」可定位文件
        </p>
      ) : null}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {paths.map((path, index) => (
          <VideoGalleryItem
            key={`${path}-${index}`}
            path={path}
            index={index}
            isPrimary={index === primaryIndex}
            projectRoot={projectRoot}
            shotNumber={shotNumber}
            onSelectPrimary={onSelectPrimary}
          />
        ))}
      </div>
    </div>
  )
}
