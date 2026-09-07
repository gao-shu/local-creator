import { useEffect, useState } from 'react'
import { ShieldCheck, Star } from 'lucide-react'
import { resolveImagePreviewSrc } from '@/lib/storage/fs-service'
import { isShotImagePathValidated } from '@/lib/workflow/shot-video-utils'
import type { WorkflowShot } from '@/types/workflow'
import { cn } from '@/lib/utils'

interface StoryboardShotGalleryProps {
  paths: string[]
  primaryIndex?: number
  projectRoot?: string
  shot?: WorkflowShot | null
  onSelectPrimary: (index: number) => void
  onClear: () => void
}

export function StoryboardShotGallery({
  paths,
  primaryIndex = 0,
  projectRoot,
  shot,
  onSelectPrimary,
  onClear,
}: StoryboardShotGalleryProps) {
  const [urls, setUrls] = useState<string[]>([])

  useEffect(() => {
    let active = true
    void Promise.all(paths.map((p) => resolveImagePreviewSrc(p, projectRoot))).then((loaded) => {
      if (active) setUrls(loaded.map((u) => u ?? ''))
    })
    return () => {
      active = false
    }
  }, [paths, projectRoot])

  if (paths.length === 0) return null

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-foreground">生成的图片 ({paths.length})</span>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          清空
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {paths.map((path, index) => {
          const url = urls[index]
          const isPrimary = index === primaryIndex
          const generationFailed = shot?.status === 'failed'
          const validated = shot ? isShotImagePathValidated(shot, path) : false
          const reviewTitle = generationFailed
            ? '生成失败'
            : validated
              ? '分镜图审核通过'
              : '分镜图待审核'
          return (
            <button
              key={`${path}-${index}`}
              type="button"
              onClick={() => onSelectPrimary(index)}
              className={cn(
                'relative shrink-0 w-20 h-20 rounded-lg border overflow-hidden bg-muted transition-colors',
                isPrimary
                  ? 'border-cyan-500 ring-2 ring-cyan-500/40'
                  : generationFailed
                    ? 'border-red-500/35 hover:border-red-500/55'
                    : validated
                      ? 'border-emerald-500/45 hover:border-emerald-500/70'
                      : 'border-amber-500/40 hover:border-amber-500/65',
              )}
            >
              {url ? (
                <img src={url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-muted" />
              )}
              <span
                title={reviewTitle}
                className={cn(
                  'absolute top-1 left-1 z-[5] inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-background shadow-sm',
                  generationFailed
                    ? 'bg-red-500 text-white'
                    : validated
                      ? 'bg-emerald-500 text-white'
                      : 'bg-amber-500 text-white',
                )}
              >
                <ShieldCheck className="h-2.5 w-2.5 shrink-0" strokeWidth={2.5} />
              </span>
              {!isPrimary ? (
                <span className="absolute top-1 right-1 p-0.5 rounded bg-black/50 text-white opacity-0 hover:opacity-100">
                  <Star className="h-3 w-3" />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
