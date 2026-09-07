import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AudioLines, FolderOpen, Play } from 'lucide-react'
import { StoryboardVideoGallery } from '@/components/workshop/storyboard-video-gallery'
import { WorkshopAiButton } from '@/components/workshop/workshop-ai-button'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import {
  DEFAULT_VIDEO_REFERENCE_MODE,
  getVideoReferenceModeHint,
  normalizeVideoAspectValue,
  normalizeVideoDurationValue,
  resolveStoryboardVideoGeneratePrefs,
  resolveVideoAspectOptions,
  resolveVideoDurationOptions,
  normalizeVideoResolutionValue,
  DEFAULT_VIDEO_RESOLUTION,
  type VideoReferenceMode,
} from '@/lib/workflow/storyboard-video-presets'
import {
  clampVideoReferenceMode,
  normalizeVideoCapabilitySelection,
  resolveVideoReferenceModeOptions,
} from '@/lib/models/video-model-capability'
import { VideoGenerationTierSelects } from '@/components/models/video-generation-tier-selects'
import { shouldShowVideoResolutionSelector } from '@/lib/models/video-generation-tier-params'
import { normalizeVideoGenerationTierParams } from '@/lib/models/video-generation-tier-params'
import type { ModelConfig } from '@/types/settings'
import { useSettingsStore } from '@/stores/settings-store'
import { getGeneratedVideoPaths } from '@/lib/workflow/shot-video-utils'
import type { WorkflowShot } from '@/types/workflow'
import { shouldUseE2eMockAi } from '@/lib/e2e/e2e-mock-ai'

const COMPACT_SELECT_CLASS = 'h-8 text-xs'

function InlineSelectRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] text-foreground shrink-0 whitespace-nowrap">{label}:</span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {hint ? <p className="text-[10px] text-muted-foreground leading-snug">{hint}</p> : null}
    </div>
  )
}

export interface StoryboardVideoGenerateParams {
  referenceMode: VideoReferenceMode
  durationSec: number
  resolution: string
  aspectRatio: string
}

interface StoryboardVideoTabProps {
  shot: WorkflowShot | null
  videoModels: ModelConfig[]
  videoModelOptions: Array<{ value: string; label: string }>
  videoModelId: string
  projectRoot?: string
  videoGenerating: boolean
  batchVideoGenerating: boolean
  videoPreparing?: boolean
  videoProgressMessage?: string
  videoProgressPercent?: number
  onVideoModelChange: (id: string) => void
  onGenerateCurrent: (params: StoryboardVideoGenerateParams) => void
  onStopGenerate?: () => void
  onClearVideos: () => void
  onSetPrimaryVideo: (index: number) => void
  onOpenVideoFolder: () => void
  onExtractAudio?: () => void
  extractAudioDisabled?: boolean
  extractAudioTitle?: string
  onBatchGenerateVideos?: () => void
}

export function StoryboardVideoTab({
  shot,
  videoModels,
  videoModelOptions,
  videoModelId,
  projectRoot,
  videoGenerating,
  batchVideoGenerating,
  videoPreparing = false,
  videoProgressMessage,
  videoProgressPercent,
  onVideoModelChange,
  onGenerateCurrent,
  onStopGenerate,
  onClearVideos,
  onSetPrimaryVideo,
  onOpenVideoFolder,
  onExtractAudio,
  extractAudioDisabled = true,
  extractAudioTitle = '提取音频',
  onBatchGenerateVideos,
}: StoryboardVideoTabProps) {
  const settings = useSettingsStore((s) => s.settings)
  const rememberVideoGenerateParams = useSettingsStore(
    (s) => s.rememberLastUsedStoryboardVideoGenerateParams,
  )
  const [referenceMode, setReferenceMode] = useState<VideoReferenceMode>(DEFAULT_VIDEO_REFERENCE_MODE)
  const [duration, setDuration] = useState('5')
  const [resolution, setResolution] = useState(DEFAULT_VIDEO_RESOLUTION)
  const [aspectRatio, setAspectRatio] = useState('16:9')

  const videoPaths = shot ? getGeneratedVideoPaths(shot) : []
  const primaryVideoIndex = shot?.primaryGeneratedVideoIndex ?? 0
  const selectedVideoModel = useMemo(
    () => (videoModels ?? []).find((model) => model.id === videoModelId) ?? null,
    [videoModels, videoModelId],
  )
  const durationOptions = useMemo(
    () => resolveVideoDurationOptions(selectedVideoModel),
    [selectedVideoModel],
  )
  const aspectOptions = useMemo(
    () => resolveVideoAspectOptions(selectedVideoModel),
    [selectedVideoModel],
  )
  const referenceModeOptions = useMemo(
    () => resolveVideoReferenceModeOptions(selectedVideoModel),
    [selectedVideoModel],
  )
  const showResolutionSelector = shouldShowVideoResolutionSelector(selectedVideoModel)
  const videoTierParams = useMemo(
    () => normalizeVideoGenerationTierParams(selectedVideoModel, { resolution }),
    [resolution, selectedVideoModel],
  )
  const durationSec = Number(duration) || Number(durationOptions[0]?.value) || 5
  const videoCostPreview = ''
  const videoCostLoading = false

  useEffect(() => {
    if (!settings) return
    const prefs = resolveStoryboardVideoGeneratePrefs(settings, selectedVideoModel)
    setReferenceMode(clampVideoReferenceMode(prefs.referenceMode, selectedVideoModel))
    setDuration(prefs.duration)
    setAspectRatio(prefs.aspectRatio)
    setResolution(prefs.resolution)
  }, [
    settings,
    settings?.lastUsedStoryboardVideoReferenceMode,
    settings?.lastUsedStoryboardVideoDuration,
    settings?.lastUsedStoryboardVideoAspectRatio,
    settings?.lastUsedStoryboardVideoResolution,
  ])

  useEffect(() => {
    const next = normalizeVideoCapabilitySelection(selectedVideoModel, {
      referenceMode,
      durationSec: duration,
      aspectRatio,
      resolution,
    })
    const modeChanged = next.referenceMode !== referenceMode
    const durationChanged = String(next.durationSec) !== duration
    const aspectChanged = next.aspectRatio !== aspectRatio
    const resolutionChanged = next.resolution !== resolution
    if (!modeChanged && !durationChanged && !aspectChanged && !resolutionChanged) return

    if (modeChanged) setReferenceMode(next.referenceMode)
    if (durationChanged) setDuration(String(next.durationSec))
    if (aspectChanged) setAspectRatio(next.aspectRatio)
    if (resolutionChanged) setResolution(next.resolution)

    rememberVideoGenerateParams({
      ...(modeChanged ? { referenceMode: next.referenceMode } : {}),
      ...(durationChanged ? { duration: String(next.durationSec) } : {}),
      ...(aspectChanged ? { aspectRatio: next.aspectRatio } : {}),
      ...(resolutionChanged ? { resolution: next.resolution } : {}),
    })
    // 仅随模型能力变化重算；刻意不把当前四维值放入 deps，避免输入环
    // eslint-disable-next-line react-hooks/exhaustive-deps -- G3: clamp on model switch only
  }, [
    rememberVideoGenerateParams,
    selectedVideoModel?.id,
    selectedVideoModel?.apiFormat,
    selectedVideoModel?.referenceModes,
    selectedVideoModel?.defaultReferenceMode,
    selectedVideoModel?.ratios,
    selectedVideoModel?.defaultRatio,
    selectedVideoModel?.durations,
    selectedVideoModel?.defaultDurationSec,
    selectedVideoModel?.resolutions,
    selectedVideoModel?.videoPricing?.pricingMode,
    selectedVideoModel?.videoPricing?.defaultResolution,
    selectedVideoModel?.videoPricing?.resolutions,
  ])

  const handleReferenceModeChange = (value: string) => {
    const mode = clampVideoReferenceMode(value, selectedVideoModel)
    setReferenceMode(mode)
    rememberVideoGenerateParams({ referenceMode: mode })
  }

  const handleDurationChange = (value: string) => {
    const normalized = normalizeVideoDurationValue(value, selectedVideoModel)
    setDuration(normalized)
    rememberVideoGenerateParams({ duration: normalized })
  }

  const handleAspectRatioChange = (value: string) => {
    const normalized = normalizeVideoAspectValue(value, selectedVideoModel)
    setAspectRatio(normalized)
    rememberVideoGenerateParams({ aspectRatio: normalized })
  }

  const handleResolutionChange = (value: string) => {
    const normalized = normalizeVideoResolutionValue(value, selectedVideoModel)
    setResolution(normalized)
    rememberVideoGenerateParams({ resolution: normalized })
  }

  const referenceHint = getVideoReferenceModeHint(referenceMode)

  const hasVideoModels = videoModelOptions.length > 0
  const videoBusy = videoGenerating || videoPreparing
  const videoBusyLabel =
    videoProgressMessage?.replace(/^镜号\s*\d+[：:]\s*/, '') ||
    (videoPreparing
      ? '准备参考素材…'
      : videoGenerating
        ? batchVideoGenerating
          ? '批量生视频中…'
          : '视频生成中…'
        : '视频生成中…')

  const buildGenerateParams = (): StoryboardVideoGenerateParams => ({
    referenceMode,
    durationSec,
    resolution: normalizeVideoResolutionValue(resolution, selectedVideoModel),
    aspectRatio,
  })

  const batchVideoUiEnabled = shouldUseE2eMockAi()
  const batchVideoDisabled =
    !hasVideoModels ||
    batchVideoGenerating ||
    videoBusy ||
    !onBatchGenerateVideos

  const batchVideoButton = batchVideoUiEnabled ? (
    <WorkshopAiButton
      type="button"
      sizePreset="default"
      icon={Play}
      data-testid="workshop-step4-batch-generate-video"
      className="w-full h-9 disabled:opacity-60"
      disabled={batchVideoDisabled}
      onClick={onBatchGenerateVideos}
    >
      批量生成视频
    </WorkshopAiButton>
  ) : null

  const modelSection = (
    <InlineSelectRow label="视频模型">
      <Select
        value={videoModelId}
        onChange={onVideoModelChange}
        options={videoModelOptions}
        placeholder={hasVideoModels ? '选择视频模型' : '请先在系统设置中配置视频模型'}
        disabled={!hasVideoModels}
        className={COMPACT_SELECT_CLASS}
        compactMenu
      />
    </InlineSelectRow>
  )

  if (!shot) {
    return (
      <div className="space-y-3">
        {modelSection}
        <p className="text-xs text-muted-foreground text-center py-8">请选择一个镜头</p>
        {batchVideoButton}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {modelSection}

      <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 space-y-2">
        <InlineSelectRow label="参考模式" hint={referenceHint}>
          <Select
            value={referenceMode}
            onChange={handleReferenceModeChange}
            options={referenceModeOptions.map((o) => ({ value: o.value, label: o.label }))}
            className={COMPACT_SELECT_CLASS}
            compactMenu
          />
        </InlineSelectRow>
        <InlineSelectRow label="时长">
          <Select
            value={duration}
            onChange={handleDurationChange}
            options={durationOptions}
            className={COMPACT_SELECT_CLASS}
            compactMenu
          />
        </InlineSelectRow>
        <InlineSelectRow label="画面比例">
          <Select
            value={aspectRatio}
            onChange={handleAspectRatioChange}
            options={aspectOptions}
            className={COMPACT_SELECT_CLASS}
            compactMenu
          />
        </InlineSelectRow>
        {showResolutionSelector ? (
          <InlineSelectRow label="分辨率">
            <VideoGenerationTierSelects
              model={selectedVideoModel}
              value={{ resolution }}
              onChange={(next) => {
                if (next.resolution) handleResolutionChange(next.resolution)
              }}
              compactSelectClass={COMPACT_SELECT_CLASS}
              className="w-full"
            />
          </InlineSelectRow>
        ) : null}

        {null}

        {videoBusy ? (
          <Button
            type="button"
            variant="destructive"
            className="w-full h-9 mt-1"
            onClick={() => onStopGenerate?.()}
          >
            停止生成
          </Button>
        ) : (
          <WorkshopAiButton
            type="button"
            sizePreset="default"
            icon={Play}
            className="w-full h-9 disabled:opacity-60 mt-1"
            disabled={!hasVideoModels || !shot.prompt.trim()}
            onClick={() => onGenerateCurrent(buildGenerateParams())}
          >
            生成当前分镜视频
          </WorkshopAiButton>
        )}
        {videoBusy && videoProgressPercent != null ? (
          <div className="space-y-1 -mt-0.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, videoProgressPercent))}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-right tabular-nums">
              {Math.round(videoProgressPercent)}%
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-1.5"
          onClick={onOpenVideoFolder}
        >
          <FolderOpen className="h-4 w-4" />
          打开文件夹
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-1.5"
          title={extractAudioTitle}
          disabled={extractAudioDisabled || videoBusy}
          onClick={() => onExtractAudio?.()}
          data-testid="workshop-step4-extract-audio"
        >
          <AudioLines className="h-4 w-4" />
          提取音频
        </Button>
      </div>

      {batchVideoButton}

      <StoryboardVideoGallery
        paths={videoPaths}
        primaryIndex={primaryVideoIndex}
        projectRoot={projectRoot}
        shotNumber={shot.shotNumber}
        onSelectPrimary={onSetPrimaryVideo}
        onClear={onClearVideos}
      />
    </div>
  )
}
