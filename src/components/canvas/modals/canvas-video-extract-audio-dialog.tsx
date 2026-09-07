// Copyright (c) local-creator contributors. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AudioLines, Loader2, Pause, Play, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCanvasVideoPreview } from '@/hooks/use-canvas-media-preview'
import {
  formatLocalMediaTimeLabel,
  useLocalMediaPlayer,
} from '@/hooks/use-local-media-player'
import { formatVoiceLibrarySavedToast } from '@/constants/voice-library-copy'
import {
  extractAudioFromVideo,
  probeVideoAudioFromProject,
  type ExtractAudioFromProjectResult,
  type ExtractAudioProjectKind,
} from '@/lib/media/extract-audio-from-video'
import { resolveExtractAudioRequestRange } from '@/lib/media/extract-audio-range'
import {
  buildDefaultExtractRange,
  rangeSecToInputs,
  resolveSliderBackedExtractRange,
  syncRangeFromSlider,
} from '@/lib/media/extract-audio-range-slider'
import { CanvasExtractAudioRangeBar } from '@/components/canvas/modals/canvas-extract-audio-range-bar'
import {
  buildDefaultExtractVoiceLibraryName,
  formatExtractVoiceSourceLabel,
  saveExtractResultToVoiceLibrary,
} from '@/lib/media/save-extracted-audio-to-voice-library'
import { resolveExtractResultOutputAbs } from '@/lib/media/extract-audio-post-actions'
import { resolveExtractAudioProjectContext } from '@/lib/media/resolve-extract-audio-project-context'
import type { CanvasVideoExtractAudioExtractedMeta } from '@/lib/canvas/canvas-video-extract-audio'
import { VOICE_AUDIO_MAX_SEC, VOICE_AUDIO_MIN_SEC } from '@/lib/voice/voice-audio-utils'
import type { ProbeVideoAudioResult } from '@/types/media'
import type { VoiceLibraryEntry } from '@/types/voice-library'
import { cn } from '@/lib/utils'

export interface CanvasVideoExtractAudioDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  videoPath: string
  videoLabel?: string
  projectKind?: ExtractAudioProjectKind
  onExtracted?: (
    result: ExtractAudioFromProjectResult,
    meta: CanvasVideoExtractAudioExtractedMeta,
  ) => void
  onSavedToVoiceLibrary?: (voice: VoiceLibraryEntry) => void
}

/** 画布 / 工坊：探测音轨、拖选截取并提取 mp3 */
export function CanvasVideoExtractAudioDialog({
  open,
  onClose,
  projectId,
  videoPath,
  videoLabel,
  projectKind = 'canvas',
  onExtracted,
  onSavedToVoiceLibrary,
}: CanvasVideoExtractAudioDialogProps) {
  const [visible, setVisible] = useState(false)
  const [probing, setProbing] = useState(false)
  const [probeResult, setProbeResult] = useState<ProbeVideoAudioResult | null>(null)
  const [startInput, setStartInput] = useState('0')
  const [endInput, setEndInput] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [extractResult, setExtractResult] = useState<ExtractAudioFromProjectResult | null>(null)
  const [projectTitle, setProjectTitle] = useState<string | undefined>()
  const [projectRoot, setProjectRoot] = useState<string | undefined>()
  const [voiceLibraryName, setVoiceLibraryName] = useState('')
  const [savingToLibrary, setSavingToLibrary] = useState(false)
  const [saveLibraryError, setSaveLibraryError] = useState<string | null>(null)
  const [savedVoice, setSavedVoice] = useState<VoiceLibraryEntry | null>(null)
  const [previewVideoEl, setPreviewVideoEl] = useState<HTMLVideoElement | null>(null)

  const trimmedVideoPath = String(videoPath || '').trim()
  const { src: previewSrc } = useCanvasVideoPreview(
    trimmedVideoPath,
    projectId,
    projectKind === 'workflow' ? 'workflow' : 'canvas',
  )
  const previewActive =
    open &&
    !probing &&
    Boolean(probeResult?.hasAudio) &&
    !probeResult?.error &&
    Boolean(previewSrc) &&
    !extractResult?.success

  const previewPlayer = useLocalMediaPlayer({
    src: previewActive ? previewSrc : undefined,
    kind: 'video',
    mediaElement: previewVideoEl,
  })
  const {
    ready: previewReady,
    playing: previewPlaying,
    currentTime: previewCurrentTime,
    duration: previewDuration,
    error: previewError,
    play: playPreview,
    pause: pausePreview,
  } = previewPlayer

  const extractedOutputAbs = useMemo(() => {
    if (!extractResult?.success) return ''
    return resolveExtractResultOutputAbs(extractResult, projectRoot)
  }, [extractResult, projectRoot])

  const resultPlayerActive = open && Boolean(extractResult?.success) && Boolean(extractedOutputAbs)

  const resultPlayer = useLocalMediaPlayer({
    src: resultPlayerActive ? extractedOutputAbs : undefined,
    kind: 'audio',
  })
  const {
    ready: resultReady,
    playing: resultPlaying,
    currentTime: resultCurrentTime,
    duration: resultDuration,
    error: resultPlayerError,
    play: playResult,
    pause: pauseResult,
  } = resultPlayer

  const videoDurationSec = probeResult?.durationSec ?? null

  const rangePreview = useMemo(() => {
    if (videoDurationSec == null || !Number.isFinite(videoDurationSec) || videoDurationSec <= 0) {
      return resolveExtractAudioRequestRange({
        mode: 'range',
        startInput,
        endInput,
        durationSec: videoDurationSec,
      })
    }
    const synced = resolveSliderBackedExtractRange({
      startInput,
      endInput,
      durationSec: videoDurationSec,
    })
    if (!synced.ok) return synced
    // 贴齐片尾时交给播放器播到自然结束，避免 seek 越过媒体 duration
    const nearEnd = synced.endSec >= videoDurationSec - 0.05
    return {
      ok: true as const,
      startSec: synced.startSec,
      endSec: nearEnd ? undefined : synced.endSec,
    }
  }, [endInput, startInput, videoDurationSec])

  const sliderRangeSec = useMemo(() => {
    if (videoDurationSec == null || !Number.isFinite(videoDurationSec) || videoDurationSec <= 0) {
      return { startSec: 0, endSec: 0 }
    }
    const synced = resolveSliderBackedExtractRange({
      startInput,
      endInput,
      durationSec: videoDurationSec,
    })
    if (synced.ok) {
      return { startSec: synced.startSec, endSec: synced.endSec }
    }
    return buildDefaultExtractRange(videoDurationSec) ?? { startSec: 0, endSec: videoDurationSec }
  }, [endInput, startInput, videoDurationSec])

  useEffect(() => {
    if (!open) {
      pausePreview()
      pauseResult()
    }
  }, [open, pausePreview, pauseResult])

  useEffect(() => {
    pausePreview()
  }, [endInput, pausePreview, startInput])

  useEffect(() => {
    if (!open || videoDurationSec == null || !Number.isFinite(videoDurationSec) || videoDurationSec <= 0) {
      return
    }
    const defaults = buildDefaultExtractRange(videoDurationSec)
    if (!defaults) return
    const inputs = rangeSecToInputs(defaults, videoDurationSec)
    setStartInput(inputs.startInput)
    setEndInput(inputs.endInput)
  }, [open, videoDurationSec])

  useEffect(() => {
    if (!open) {
      setVisible(false)
      return
    }
    const frameId = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frameId)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !extracting && !savingToLibrary) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [extracting, onClose, open, savingToLibrary])

  useEffect(() => {
    if (!open) return
    setStartInput('0')
    setEndInput('')
    setExtractError(null)
    setExtractResult(null)
    setProbeResult(null)
    setProjectTitle(undefined)
    setProjectRoot(undefined)
    setVoiceLibraryName('')
    setSavingToLibrary(false)
    setSaveLibraryError(null)
    setSavedVoice(null)

    const trimmedPath = String(videoPath || '').trim()
    const trimmedProjectId = String(projectId || '').trim()
    if (!trimmedPath || !trimmedProjectId) {
      setProbeResult({
        hasAudio: false,
        durationSec: null,
        error: '视频或项目未就绪',
      })
      return
    }

    let cancelled = false
    setProbing(true)
    void resolveExtractAudioProjectContext(trimmedProjectId, projectKind)
      .then((context) => {
        if (cancelled) return
        if (context.projectRoot) setProjectRoot(context.projectRoot)
        if (context.projectTitle) setProjectTitle(context.projectTitle)
      })
      .catch(() => {
        // 项目上下文解析失败不影响抽音
      })
    void probeVideoAudioFromProject({
      projectId: trimmedProjectId,
      videoPath: trimmedPath,
      projectKind,
    })
      .then((result) => {
        if (!cancelled) setProbeResult(result)
      })
      .finally(() => {
        if (!cancelled) setProbing(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, projectId, projectKind, videoPath])

  const canExtract =
    !probing &&
    !extracting &&
    Boolean(probeResult?.hasAudio) &&
    !probeResult?.error

  const handleRangeBarChange = useCallback(
    (startSec: number, endSec: number) => {
      if (videoDurationSec == null) return
      pausePreview()
      const synced = syncRangeFromSlider(startSec, endSec, videoDurationSec)
      if (!synced.ok) return
      setStartInput(synced.startInput)
      setEndInput(synced.endInput)
    },
    [pausePreview, videoDurationSec],
  )

  const handlePreviewSelection = useCallback(() => {
    if (!previewReady || extracting) return
    if (!rangePreview.ok) {
      toast.error(rangePreview.error)
      return
    }
    playPreview({
      startSec: rangePreview.startSec ?? 0,
      endSec: rangePreview.endSec ?? null,
    })
  }, [extracting, playPreview, previewReady, rangePreview])

  // 纠正 toFixed 五入导致的非法 endInput（界面已显示可贴片尾，input 却略大于真实时长）
  useEffect(() => {
    if (!open) return
    if (videoDurationSec == null || !Number.isFinite(videoDurationSec) || videoDurationSec <= 0) {
      return
    }
    const synced = resolveSliderBackedExtractRange({
      startInput,
      endInput,
      durationSec: videoDurationSec,
    })
    if (!synced.ok) return
    if (synced.startInput === startInput && synced.endInput === endInput) return
    const strict = resolveExtractAudioRequestRange({
      mode: 'range',
      startInput,
      endInput,
      durationSec: videoDurationSec,
    })
    if (strict.ok) return
    setStartInput(synced.startInput)
    setEndInput(synced.endInput)
  }, [endInput, open, startInput, videoDurationSec])

  const handleExtract = useCallback(async () => {
    if (!canExtract) return

    let range: { ok: true; startSec?: number; endSec?: number } | { ok: false; error: string }
    if (videoDurationSec == null || !Number.isFinite(videoDurationSec)) {
      range = resolveExtractAudioRequestRange({
        mode: 'range',
        startInput,
        endInput,
        durationSec: probeResult?.durationSec,
      })
    } else {
      const synced = resolveSliderBackedExtractRange({
        startInput,
        endInput,
        durationSec: videoDurationSec,
      })
      if (!synced.ok) {
        range = synced
      } else {
        const nearStart = synced.startSec <= 0.05
        const nearEnd = synced.endSec >= videoDurationSec - 0.05
        range = {
          ok: true,
          startSec: nearStart ? undefined : synced.startSec,
          endSec: nearEnd ? undefined : synced.endSec,
        }
      }
    }
    if (!range.ok) {
      setExtractError(range.error)
      toast.error(range.error)
      return
    }

    const extractMode =
      range.startSec == null && range.endSec == null ? 'full' : 'range'

    setExtracting(true)
    setExtractError(null)
    pausePreview()
    pauseResult()
    try {
      const result = await extractAudioFromVideo({
        projectId,
        videoPath,
        projectKind,
        startSec: range.startSec,
        endSec: range.endSec,
      })

      if (!result.success) {
        const message = result.error || '音频提取失败'
        setExtractError(message)
        toast.error(message)
        return
      }

      setExtractResult(result)
      setVoiceLibraryName(buildDefaultExtractVoiceLibraryName(videoLabel))
      setSaveLibraryError(null)
      setSavedVoice(null)
      onExtracted?.(result, {
        mode: extractMode,
        startSec: range.startSec,
        endSec: range.endSec,
        videoDurationSec: probeResult?.durationSec,
      })
      toast.success('提取成功，可保存为音色')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '音频提取失败'
      setExtractError(message)
      toast.error(message)
    } finally {
      setExtracting(false)
    }
  }, [
    canExtract,
    endInput,
    onExtracted,
    pausePreview,
    pauseResult,
    probeResult?.durationSec,
    projectId,
    projectKind,
    startInput,
    videoDurationSec,
    videoLabel,
    videoPath,
  ])

  const handleSaveToVoiceLibrary = useCallback(async () => {
    if (!extractResult?.success || savingToLibrary || savedVoice) return
    setSavingToLibrary(true)
    setSaveLibraryError(null)
    try {
      const result = await saveExtractResultToVoiceLibrary(extractResult, {
        name: voiceLibraryName,
        projectId,
        projectKind,
        projectTitle,
        projectRoot,
      })
      if (!result.success || !result.voice) {
        const message = result.error || '保存到音色库失败'
        setSaveLibraryError(message)
        toast.error(message)
        return
      }
      setSavedVoice(result.voice)
      onSavedToVoiceLibrary?.(result.voice)
      toast.success(formatVoiceLibrarySavedToast(result.voice.name))
      onClose()
    } finally {
      setSavingToLibrary(false)
    }
  }, [
    extractResult,
    onClose,
    onSavedToVoiceLibrary,
    projectId,
    projectRoot,
    projectTitle,
    savedVoice,
    savingToLibrary,
    voiceLibraryName,
  ])

  const savePhase = Boolean(extractResult?.success && !savedVoice)
  const sourceLabel = useMemo(
    () => formatExtractVoiceSourceLabel(videoLabel),
    [videoLabel],
  )
  const voiceDurationOutOfRange = useMemo(() => {
    if (!savePhase) return false
    const duration = resultDuration
    if (duration == null || !Number.isFinite(duration)) return false
    return duration < VOICE_AUDIO_MIN_SEC || duration > VOICE_AUDIO_MAX_SEC
  }, [resultDuration, savePhase])

  const busy = extracting || savingToLibrary

  if (!open) return null

  return createPortal(
    <>
      <button
        type="button"
        aria-label="关闭"
        className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-[1px]"
        onClick={() => {
          if (!busy) onClose()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="canvas-video-extract-audio-title"
        data-testid="canvas-video-extract-audio-dialog"
        className={cn(
          'fixed left-1/2 top-1/2 z-[121] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2',
          'rounded-2xl border border-border/40 bg-[#1a1b1f] p-4 shadow-2xl transition-all duration-200',
          visible ? 'scale-100 opacity-100' : 'scale-[0.98] opacity-0',
        )}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <AudioLines className="h-4 w-4 shrink-0 text-sky-400" />
              <h2
                id="canvas-video-extract-audio-title"
                className="text-[15px] font-medium text-foreground"
              >
                {savePhase ? '保存为音色' : '提取音频'}
              </h2>
            </div>
            {savePhase ? (
              sourceLabel ? (
                <p className="mt-1 truncate text-[12px] text-muted-foreground">
                  来自：{sourceLabel}
                </p>
              ) : null
            ) : videoLabel ? (
              <p className="mt-1 truncate text-[12px] text-muted-foreground">{videoLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="关闭"
            disabled={busy}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-40"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {probing ? (
            <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-black/20 px-3 py-2.5 text-[13px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              正在探测音轨…
            </div>
          ) : null}
          {!probing && probeResult?.error ? (
            <p className="text-[13px] text-destructive">{probeResult.error}</p>
          ) : null}
          {!probing && probeResult && !probeResult.error && !probeResult.hasAudio ? (
            <p className="text-[13px] text-amber-400/90">该视频没有可提取的音轨</p>
          ) : null}

          {previewActive ? (
            <div
              className="space-y-2 rounded-xl border border-border/30 bg-black/20 p-2.5"
              data-testid="canvas-video-extract-audio-preview"
            >
              <div className="flex justify-end">
                <span className="tabular-nums text-[11px] text-muted-foreground">
                  {formatLocalMediaTimeLabel(previewCurrentTime)}
                  {' / '}
                  {formatLocalMediaTimeLabel(previewDuration ?? videoDurationSec)}
                </span>
              </div>
              <video
                ref={setPreviewVideoEl}
                className="nodrag nopan block h-28 w-full rounded-lg bg-black object-contain"
                playsInline
                preload="metadata"
                controls
                onPointerDown={(event) => event.stopPropagation()}
              />
              {videoDurationSec != null && videoDurationSec > 0 ? (
                <CanvasExtractAudioRangeBar
                  durationSec={videoDurationSec}
                  startSec={sliderRangeSec.startSec}
                  endSec={sliderRangeSec.endSec}
                  currentTimeSec={previewCurrentTime}
                  disabled={extracting || Boolean(extractResult)}
                  onChange={handleRangeBarChange}
                />
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!previewReady || extracting || !rangePreview.ok}
                  onClick={handlePreviewSelection}
                  data-testid="canvas-video-extract-audio-preview-selection"
                >
                  <Play className="h-3.5 w-3.5" />
                  播放选区
                </Button>
                {previewPlaying ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={extracting}
                    onClick={pausePreview}
                    data-testid="canvas-video-extract-audio-preview-pause"
                  >
                    <Pause className="h-3.5 w-3.5" />
                    暂停
                  </Button>
                ) : null}
              </div>
              {rangePreview.ok === false && (startInput.trim() || endInput.trim()) ? (
                <p className="text-[11px] text-amber-400/90">{rangePreview.error}</p>
              ) : null}
              {previewError ? (
                <p className="text-[12px] text-destructive">{previewError}</p>
              ) : null}
            </div>
          ) : null}

          {extractError ? (
            <p className="text-[12px] text-destructive" data-testid="canvas-video-extract-audio-error">
              {extractError}
            </p>
          ) : null}

          {savePhase ? (
            <div className="space-y-3" data-testid="canvas-video-extract-audio-success">
              <div
                className="flex flex-wrap items-center gap-2"
                data-testid="canvas-video-extract-audio-result-preview"
              >
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!resultReady || savingToLibrary}
                  onClick={() => (resultPlaying ? pauseResult() : playResult())}
                  data-testid="canvas-video-extract-audio-result-play"
                >
                  {resultPlaying ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {resultPlaying ? '暂停' : '试听'}
                </Button>
                <span className="tabular-nums text-[11px] text-muted-foreground">
                  {formatLocalMediaTimeLabel(resultCurrentTime)}
                  {' / '}
                  {formatLocalMediaTimeLabel(resultDuration)}
                </span>
                {resultPlayerError ? (
                  <p className="w-full text-[12px] text-destructive">{resultPlayerError}</p>
                ) : null}
              </div>

              <label className="block space-y-1.5">
                <span className="text-[12px] text-muted-foreground">音色名称</span>
                <Input
                  value={voiceLibraryName}
                  disabled={savingToLibrary}
                  onChange={(event) => setVoiceLibraryName(event.target.value)}
                  placeholder="如：男主 · 参考音"
                  className="h-9 border-border/40 bg-black/20"
                  data-testid="canvas-video-extract-audio-voice-name"
                />
              </label>
              {voiceDurationOutOfRange ? (
                <p className="text-[12px] text-amber-400/90">
                  时长需在 {VOICE_AUDIO_MIN_SEC}–{VOICE_AUDIO_MAX_SEC} 秒（当前{' '}
                  {resultDuration != null ? resultDuration.toFixed(1) : '?'} 秒）
                </p>
              ) : null}
              {saveLibraryError ? (
                <p className="text-[12px] text-destructive">{saveLibraryError}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          {savePhase ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={onClose}
              >
                暂不保存
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!voiceLibraryName.trim() || savingToLibrary || voiceDurationOutOfRange}
                onClick={() => void handleSaveToVoiceLibrary()}
                data-testid="canvas-video-extract-audio-save-voice"
              >
                {savingToLibrary ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    保存中…
                  </>
                ) : (
                  '保存'
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onClose}
              >
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canExtract}
                onClick={() => void handleExtract()}
                data-testid="canvas-video-extract-audio-submit"
              >
                {extracting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    提取中…
                  </>
                ) : (
                  '开始提取'
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
