import { useEffect, useRef, useState } from 'react'

import { Camera, ChevronDown, Film, ImageIcon, Loader2, RectangleHorizontal, RectangleVertical, Video, ZoomIn } from 'lucide-react'

import { toast } from 'sonner'

import { ImagePreviewModal } from '@/components/ui/image-preview-modal'

import { VideoPreviewModal } from '@/components/ui/video-preview-modal'

import { captureVideoFrame, captureVideoLastFrame } from '@/lib/video/capture-video-frame'
import { getCachedVideoPreviewSrc, getCachedVideoThumbnail } from '@/lib/video/video-preview-cache'
import { isDefaultEpisodeTitle } from '@/lib/workflow/episode-utils'
import { getShotPreviewVideoPath } from '@/lib/workflow/shot-video-utils'
import { VideoDragChip } from '@/components/workshop/video-drag-chip'
import { StoryboardImageReviewBadge } from '@/components/workshop/storyboard-image-review-badge'

import type { WorkflowEpisode, WorkflowProjectMeta, WorkflowShot } from '@/types/workflow'

import { cn } from '@/lib/utils'
import { splitVideoProgressMessage } from '@/lib/video/video-progress'



type PreviewMode = 'image' | 'video'

export type PreviewAspectMode = 'landscape' | 'portrait'

/** 右侧分镜缩略图条：固定宽度，条目尺寸写死，超出纵向滚动 */
const STORYBOARD_SHOT_RAIL_WIDTH_PX = 108
const STORYBOARD_SHOT_RAIL_THUMB_PX = 88

function StoryboardRailShotItem({
  shot,
  selected,
  imageThumb,
  previewMode,
  projectRoot,
  isGenerating,
  onSelect,
}: {
  shot: WorkflowShot
  selected: boolean
  imageThumb?: string | null
  previewMode: PreviewMode
  projectRoot?: string
  isGenerating: boolean
  onSelect: () => void
}) {
  const [videoThumb, setVideoThumb] = useState('')
  const videoPath = previewMode === 'video' ? getShotPreviewVideoPath(shot) : undefined
  const thumb = previewMode === 'video' && videoThumb ? videoThumb : imageThumb

  useEffect(() => {
    if (previewMode !== 'video' || !videoPath) {
      setVideoThumb('')
      return
    }
    let active = true
    void (async () => {
      const previewSrc = await getCachedVideoPreviewSrc(videoPath, projectRoot)
      if (!previewSrc || !active) {
        if (active) setVideoThumb('')
        return
      }
      const nextThumb = (await getCachedVideoThumbnail(previewSrc)) ?? ''
      if (active) setVideoThumb(nextThumb)
    })()
    return () => {
      active = false
    }
  }, [previewMode, projectRoot, videoPath])

  return (
    <div
      data-shot-id={shot.id}
      className={cn(
        'relative shrink-0 rounded-md border overflow-hidden transition-colors',
        selected
          ? 'border-cyan-500 ring-2 ring-cyan-500/40'
          : 'border-border/40 hover:border-border/70 opacity-80 hover:opacity-100',
      )}
      style={{
        width: STORYBOARD_SHOT_RAIL_THUMB_PX,
        height: STORYBOARD_SHOT_RAIL_THUMB_PX,
      }}
    >
      <button
        type="button"
        title={`#${shot.shotNumber} ${shot.dialogue}`}
        onClick={onSelect}
        className="absolute inset-0 z-0"
      >
        {thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center bg-muted/40 text-muted-foreground">
            <ImageIcon className="h-4 w-4 opacity-40" />
          </div>
        )}
        {isGenerating ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
          </span>
        ) : null}
        <span
          className={cn(
            'absolute bottom-0 inset-x-0 text-center text-xs font-semibold leading-none py-px',
            selected ? 'bg-cyan-600/90 text-white' : 'bg-black/60 text-white/90',
          )}
        >
          #{shot.shotNumber}
        </span>
      </button>

      {previewMode === 'video' && videoPath ? (
        <VideoDragChip
          storedPath={videoPath}
          projectRoot={projectRoot}
          filename={`shot-${shot.shotNumber}.mp4`}
        />
      ) : null}
    </div>
  )
}

interface StoryboardCenterPanelProps {

  meta: WorkflowProjectMeta | null

  episode: WorkflowEpisode | null

  shot: WorkflowShot | null

  shots: WorkflowShot[]

  selectedShotId: string | null

  previewMap: Record<string, string>

  previewUrl: string | null

  videoPreviewUrl: string | null

  previewMode: PreviewMode

  aspectMode: PreviewAspectMode

  generating: boolean

  videoGenerating: boolean

  videoProgressMessage?: string

  videoProgressPercent?: number

  projectRoot?: string

  onPreviewModeChange: (mode: PreviewMode) => void

  onAspectModeChange: (mode: PreviewAspectMode) => void

  onSelectShot: (shotId: string) => void

  onScreenshotToReference?: (targetShotId: string, dataUrl: string) => Promise<void>

}



export function StoryboardCenterPanel({

  meta,

  episode,

  shot,

  shots,

  selectedShotId,

  previewMap,

  previewUrl,

  videoPreviewUrl,

  previewMode,

  aspectMode,

  generating,

  videoGenerating,

  videoProgressMessage,

  videoProgressPercent,

  projectRoot,

  onPreviewModeChange,

  onAspectModeChange,

  onSelectShot,

  onScreenshotToReference,

}: StoryboardCenterPanelProps) {

  const railRef = useRef<HTMLDivElement>(null)

  const videoRef = useRef<HTMLVideoElement>(null)

  const screenshotMenuRef = useRef<HTMLDivElement>(null)

  const [imagePreviewOpen, setImagePreviewOpen] = useState(false)

  const [videoPreviewOpen, setVideoPreviewOpen] = useState(false)

  const [screenshotMenuOpen, setScreenshotMenuOpen] = useState(false)

  const [screenshotBusy, setScreenshotBusy] = useState<'current' | 'next' | 'tail' | false>(false)

  const [videoReady, setVideoReady] = useState(false)
  const [videoPoster, setVideoPoster] = useState('')

  const title = meta?.title ?? '未命名项目'

  const episodeLabel = episode ? `第${episode.episodeIndex}集` : '未选分集'

  const episodeTitleExtra =
    episode?.title && !isDefaultEpisodeTitle(episode.title, episode.episodeIndex)
      ? episode.title
      : null

  const shotLabel = shot ? `镜头 ${shot.shotNumber}` : '当前分镜'

  const imageBusy = previewMode === 'image' && generating

  /** 生视频中始终展示进度层，避免仅「显示视频」模式下才出现加载动画 */
  const videoBusy = videoGenerating

  const videoSrc =

    videoPreviewUrl && !videoPreviewUrl.startsWith('preview:') ? videoPreviewUrl : ''

  const hasVideo = Boolean(videoSrc)

  const hasImage = Boolean(previewUrl)

  /** 有实际画面时用黑底画框；空态用白底占位，适配浅色主题 */
  const previewFrameUsesDarkCanvas =
    (previewMode === 'image' && hasImage) || (previewMode === 'video' && hasVideo)



  const selectedShotIndex = shots.findIndex((s) => s.id === selectedShotId)

  const hasNextShot = selectedShotIndex >= 0 && selectedShotIndex < shots.length - 1



  useEffect(() => {
    setScreenshotMenuOpen(false)
    if (!videoSrc) {
      setVideoReady(false)
      setVideoPoster('')
      return
    }
    setVideoReady(false)
    let cancelled = false
    void getCachedVideoThumbnail(videoSrc).then((thumb) => {
      if (!cancelled) setVideoPoster(thumb ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [videoSrc])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !videoSrc) return
    el.src = videoSrc
    el.load()
    const markReady = () => setVideoReady(true)
    const markError = () => setVideoReady(false)
    el.addEventListener('loadeddata', markReady)
    el.addEventListener('canplay', markReady)
    el.addEventListener('error', markError)
    return () => {
      el.removeEventListener('loadeddata', markReady)
      el.removeEventListener('canplay', markReady)
      el.removeEventListener('error', markError)
    }
  }, [videoSrc])



  useEffect(() => {

    if (previewMode === 'video') return

    videoRef.current?.pause()

  }, [previewMode])



  useEffect(() => {

    if (!selectedShotId || !railRef.current) return

    const el = railRef.current.querySelector(`[data-shot-id="${selectedShotId}"]`)

    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })

  }, [selectedShotId])



  useEffect(() => {

    if (!screenshotMenuOpen) return

    const close = (e: MouseEvent) => {

      if (!screenshotMenuRef.current?.contains(e.target as Node)) {

        setScreenshotMenuOpen(false)

      }

    }

    document.addEventListener('mousedown', close)

    return () => document.removeEventListener('mousedown', close)

  }, [screenshotMenuOpen])



  const handleScreenshot = async (target: 'current' | 'next') => {

    if (!onScreenshotToReference || !videoRef.current || screenshotBusy) return

    const targetIndex = target === 'current' ? selectedShotIndex : selectedShotIndex + 1

    const targetShot = shots[targetIndex]

    if (!targetShot) return



    setScreenshotBusy(target)

    setScreenshotMenuOpen(false)

    try {

      const dataUrl = await captureVideoFrame(videoRef.current)

      if (!dataUrl) {

        toast.warning('截图失败，请确认视频已加载')

        return

      }

      await onScreenshotToReference(targetShot.id, dataUrl)

    } finally {

      setScreenshotBusy(false)

    }

  }



  const handleTailFrameToNext = async () => {

    if (!onScreenshotToReference || !videoRef.current || screenshotBusy || !hasNextShot) return

    const nextShot = shots[selectedShotIndex + 1]

    if (!nextShot) return



    setScreenshotBusy('tail')

    try {

      const dataUrl = await captureVideoLastFrame(videoRef.current)

      if (!dataUrl) {

        toast.warning('尾帧截取失败，请确认视频已加载完成')

        return

      }

      await onScreenshotToReference(nextShot.id, dataUrl)

    } finally {

      setScreenshotBusy(false)

    }

  }



  const showVideoToolbar =

    previewMode === 'video' && hasVideo && Boolean(onScreenshotToReference)



  const renderMediaLayer = () => {
    const rawBusyMessage =
      videoBusy && videoProgressMessage
        ? videoProgressMessage
        : imageBusy
          ? '分镜图生成中…'
          : videoBusy
            ? '视频生成中…'
            : ''
    const { shotLabel, statusText } = splitVideoProgressMessage(rawBusyMessage)

    const busyOverlay =
      imageBusy || videoBusy ? (
        <div
          className={cn(
            'absolute inset-0 z-[3] flex flex-col items-center justify-center gap-2.5 px-6',
            previewFrameUsesDarkCanvas
              ? 'bg-black/50 text-white'
              : 'bg-background/80 backdrop-blur-[2px] text-muted-foreground',
          )}
        >
          <Loader2 className="h-10 w-10 animate-spin text-cyan-500 shrink-0" />
          <div className="flex max-w-[240px] flex-col items-center gap-1 text-center">
            {shotLabel ? (
              <span
                className={cn(
                  'text-[11px] leading-none',
                  previewFrameUsesDarkCanvas ? 'text-white/55' : 'text-muted-foreground',
                )}
              >
                {shotLabel}
              </span>
            ) : null}
            <span
              className={cn(
                'text-xs leading-snug',
                previewFrameUsesDarkCanvas ? 'text-white/90' : 'text-foreground',
              )}
            >
              {statusText}
            </span>
          </div>
          {videoBusy && videoProgressPercent != null ? (
            <div className="w-full max-w-[220px] space-y-1">
              <div
                className={cn(
                  'h-1.5 overflow-hidden rounded-full',
                  previewFrameUsesDarkCanvas ? 'bg-white/15' : 'bg-muted',
                )}
              >
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, videoProgressPercent))}%` }}
                />
              </div>
              <p
                className={cn(
                  'text-[10px] text-center tabular-nums',
                  previewFrameUsesDarkCanvas ? 'text-white/70' : 'text-muted-foreground',
                )}
              >
                {Math.round(videoProgressPercent)}%
              </p>
            </div>
          ) : null}
        </div>
      ) : null

    if (hasImage) {
      return (
        <>
          <button
            type="button"
            title="点击全屏预览"
            onClick={() => previewMode === 'image' && setImagePreviewOpen(true)}
            className={cn(
              'group/preview absolute inset-0',
              previewMode === 'image' ? 'z-[1] cursor-zoom-in' : 'z-0 invisible pointer-events-none',
            )}
          >
            <img src={previewUrl!} alt="" className="absolute inset-0 h-full w-full object-contain" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover/preview:bg-black/25 group-hover/preview:opacity-100">
              <ZoomIn className="h-8 w-8 text-white/90" />
            </div>
          </button>
          {busyOverlay}
        </>
      )
    }

    if (imageBusy || videoBusy) {
      return busyOverlay
    }



    if (previewMode === 'image') {

      return (

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">

          <ImageIcon className="h-12 w-12 opacity-30" />

          <span className="text-xs">{shot ? '暂无分镜图' : '暂无分镜'}</span>

        </div>

      )

    }



    return null

  }



  const renderVideoLayer = () => {

    if (hasVideo) {

      return (

        <>

          {!videoReady && videoPoster ? (
            <img
              src={videoPoster}
              alt=""
              className={cn(
                'absolute inset-0 z-[2] h-full w-full object-contain bg-black pointer-events-none',
                previewMode === 'video' ? '' : 'invisible',
              )}
            />
          ) : null}

          <video
            ref={videoRef}
            poster={videoPoster || undefined}
            controls={previewMode === 'video' && videoReady}
            preload="auto"
            playsInline
            className={cn(
              'absolute inset-0 h-full w-full object-contain bg-black',
              previewMode === 'video' ? 'z-[1]' : 'z-0 invisible pointer-events-none',
              !videoReady ? 'opacity-0' : 'opacity-100',
            )}
          />

          {previewMode === 'video' ? (

            <button

              type="button"

              title="全屏预览"

              onClick={() => setVideoPreviewOpen(true)}

              className="absolute right-2 top-2 z-[2] rounded-full border border-white/15 bg-black/50 p-2 text-white/90 transition-colors hover:bg-black/70"

            >

              <ZoomIn className="h-4 w-4" />

            </button>

          ) : null}

        </>

      )

    }



    if (previewMode !== 'video') return null

    if (videoGenerating) return null

    if (videoPreviewUrl?.startsWith('preview:')) {

      return (

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">

          <Video className="h-12 w-12 opacity-30" />

          <span className="text-xs">预览模式 · 视频已生成</span>

        </div>

      )

    }



    return (

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">

        <Video className="h-12 w-12 opacity-30" />

        <span className="text-xs">暂无视频</span>

      </div>

    )

  }



  return (

    <div className="flex flex-col flex-1 min-w-0 min-h-0 rounded-lg border border-border bg-card overflow-hidden">

      <div className="px-4 py-2.5 border-b border-border shrink-0 flex items-center justify-between gap-3">

        <div className="flex items-center gap-2.5 min-w-0 flex-1">

          <div className="flex items-center gap-2 min-w-0 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 shadow-sm shadow-cyan-500/5">

            <span className="text-sm font-semibold text-foreground truncate max-w-[120px]">

              {title}

            </span>

            <span className="h-3.5 w-px shrink-0 bg-border/60" aria-hidden />

            <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-300 shrink-0">

              {episodeLabel}

            </span>

            {episodeTitleExtra ? (

              <span className="text-sm font-medium text-foreground/90 truncate">

                《{episodeTitleExtra}》

              </span>

            ) : null}

          </div>

          <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">

            {shotLabel}

          </span>

        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center rounded-lg border border-border/50 bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => onPreviewModeChange('image')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                previewMode === 'image'
                  ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              显示分镜图
            </button>
            <button
              type="button"
              onClick={() => onPreviewModeChange('video')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                previewMode === 'video'
                  ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              显示视频
            </button>
          </div>

          <div className="flex items-center gap-0.5 rounded-md border border-border/50 bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => onAspectModeChange('landscape')}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition-colors',
                aspectMode === 'landscape'
                  ? 'bg-cyan-600 text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              )}
            >
              横屏
              <RectangleHorizontal className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onAspectModeChange('portrait')}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition-colors',
                aspectMode === 'portrait'
                  ? 'bg-cyan-600 text-white'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
              )}
            >
              竖屏
              <RectangleVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

      </div>



      <div className="flex-1 min-h-0 flex flex-col min-w-0">

        <div className="flex-1 min-h-0 flex min-w-0 overflow-hidden">

          <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-background overflow-hidden">
            <div className="flex-1 min-h-0 relative flex flex-col p-3 overflow-hidden">
            {(previewMode === 'image' && shot) || showVideoToolbar ? (
              <div className="shrink-0 mb-2 flex flex-wrap items-center gap-3">
                {previewMode === 'image' && shot ? <StoryboardImageReviewBadge shot={shot} /> : null}
                {showVideoToolbar ? (
                  <>
                    <div ref={screenshotMenuRef} className="relative">
                      <button
                        type="button"
                        disabled={Boolean(screenshotBusy)}
                        onClick={() => setScreenshotMenuOpen((open) => !open)}
                        className="inline-flex items-center gap-1.5 px-0 py-0 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
                      >
                        <Camera className="h-3.5 w-3.5 text-cyan-500" />
                        {screenshotBusy && screenshotBusy !== 'tail' ? '截图中...' : '截图'}
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </button>
                      {screenshotMenuOpen ? (
                        <div className="absolute left-0 top-full z-20 mt-1 min-w-[196px] overflow-hidden rounded-md border border-border/60 bg-popover shadow-lg">
                          <button
                            type="button"
                            disabled={Boolean(screenshotBusy) || selectedShotIndex < 0}
                            onClick={() => void handleScreenshot('current')}
                            className="block w-full px-3 py-2 text-left text-[11px] text-foreground hover:bg-muted/60 disabled:opacity-50"
                          >
                            添加到当前分镜参考图
                          </button>
                          {hasNextShot ? (
                            <button
                              type="button"
                              disabled={Boolean(screenshotBusy)}
                              onClick={() => void handleScreenshot('next')}
                              className="block w-full px-3 py-2 text-left text-[11px] text-foreground hover:bg-muted/60 disabled:opacity-50"
                            >
                              添加到下一分镜参考图
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(screenshotBusy) || !hasNextShot}
                      title={
                        hasNextShot
                          ? '截取当前视频最后一帧，添加到下一分镜参考图'
                          : '已是最后一个分镜'
                      }
                      onClick={() => void handleTailFrameToNext()}
                      className="inline-flex items-center gap-1.5 px-0 py-0 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    >
                      <Film className="h-3.5 w-3.5 text-emerald-500" />
                      {screenshotBusy === 'tail' ? '截取中...' : '尾帧下一分镜参考图'}
                    </button>
                    {!videoReady ? (
                      <span className="text-[10px] text-muted-foreground">视频缓冲中…</span>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden">

            <div

              className={cn(
                'relative overflow-hidden rounded-lg shadow-sm',
                previewFrameUsesDarkCanvas
                  ? 'bg-black border border-border/40'
                  : 'bg-background border border-dashed border-border/60',
                aspectMode === 'landscape'
                  ? 'w-full max-h-full aspect-video'
                  : 'h-full max-w-full aspect-[9/16]',
              )}

            >

              {renderMediaLayer()}

              {renderVideoLayer()}

            </div>

            </div>

          </div>

          </div>



          {shots.length > 0 ? (
            <div
              ref={railRef}
              className="shrink-0 min-h-0 h-full overflow-y-auto overflow-x-hidden border-l border-border/40 bg-background py-2 px-2 flex flex-col items-center gap-2"
              style={{ width: STORYBOARD_SHOT_RAIL_WIDTH_PX }}
            >
              {shots.map((s) => (
                <StoryboardRailShotItem
                  key={s.id}
                  shot={s}
                  selected={s.id === selectedShotId}
                  imageThumb={previewMap[s.id]}
                  previewMode={previewMode}
                  projectRoot={projectRoot}
                  isGenerating={s.status === 'generating' || s.videoStatus === 'generating'}
                  onSelect={() => onSelectShot(s.id)}
                />
              ))}
            </div>

          ) : null}

        </div>

      </div>



      {imagePreviewOpen && previewUrl ? (

        <ImagePreviewModal

          imageUrl={previewUrl}

          alt={`${title} · ${shotLabel}`}

          onClose={() => setImagePreviewOpen(false)}

        />

      ) : null}

      {videoPreviewOpen && videoSrc ? (

        <VideoPreviewModal videoUrl={videoSrc} onClose={() => setVideoPreviewOpen(false)} />

      ) : null}

    </div>

  )

}


