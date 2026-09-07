import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PanelRightClose } from 'lucide-react'
import { StoryboardAffixPresetDialog } from '@/components/workshop/storyboard-affix-preset-dialog'
import { WorkshopAiButton } from '@/components/workshop/workshop-ai-button'
import { StoryboardSettingsTab } from '@/components/workshop/storyboard-settings-tab'
import { WorkflowStyleFollowBar } from '@/components/workshop/workflow-style-follow-bar'
import { StoryboardShotGallery } from '@/components/workshop/storyboard-shot-gallery'
import {
  StoryboardVideoTab,
  type StoryboardVideoGenerateParams,
} from '@/components/workshop/storyboard-video-tab'
import { ProjectTaskList } from '@/components/workshop/project-task-list'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { getStylePresetSelectOptions } from '@/lib/workflow/style-presets'
import { getGeneratedImagePaths } from '@/lib/workflow/asset-utils'
import {
  DEFAULT_STORYBOARD_IMAGE_SIZE,
  INFERENCE_FORMAT_OPTIONS,
  normalizeInferenceFormat,
  resolveStoryboardImageGeneratePrefs,
  STORYBOARD_ASPECT_SIZE_OPTIONS,
  type InferenceFormat,
} from '@/lib/workflow/storyboard-image-presets'
import { normalizeImageSizePreset } from '@/lib/workflow/image-size-presets'
import { ImageGenerationTierField } from '@/components/models/image-generation-tier-field'
import {
  normalizeImageGenerationTierParams,
  resolveStoryboardImageTierPrefs,
  type ImageGenerationTierParams,
} from '@/lib/models/image-generation-tier-params'
import { useSettingsStore } from '@/stores/settings-store'
import type { ModelConfig, PromptAffixPreset } from '@/types/settings'
import type { WorkflowShot, WorkflowTask } from '@/types/workflow'
import { cn } from '@/lib/utils'

type SideTab = 'template' | 'image' | 'video' | 'settings' | 'tasks'

const TABS: Array<{ key: SideTab; label: string; railLabel?: string }> = [
  { key: 'template', label: '分镜' },
  { key: 'image', label: '生图' },
  { key: 'video', label: '生视频', railLabel: '视频' },
  { key: 'settings', label: '设置' },
  { key: 'tasks', label: '任务' },
]

interface StoryboardRightPanelProps {
  shot: WorkflowShot | null
  episodeShotCount: number
  projectStyle: string
  followingProjectStyle: boolean
  projectStyleLabel: string
  onFollowProjectStyleChange: (following: boolean) => void
  storyboardTemplateOptions: Array<{ value: string; label: string }>
  storyboardTemplateKey: string
  llmModelOptions: Array<{ value: string; label: string }>
  llmModelId: string
  imageModelOptions: Array<{ value: string; label: string }>
  imageModelId: string
  videoModelOptions: Array<{ value: string; label: string }>
  videoModels: ModelConfig[]
  videoModelId: string
  projectRoot?: string
  generating: boolean
  videoGenerating: boolean
  batchVideoGenerating: boolean
  videoPreparing?: boolean
  videoProgressMessage?: string
  videoProgressPercent?: number
  collapsed: boolean
  onCollapse: () => void
  onStoryboardTemplateChange: (value: string) => void
  onLlmModelChange: (value: string) => void
  onImageModelChange: (value: string) => void
  onStyleChange: (styleKey: string) => void
  onShotChange: (patch: Partial<WorkflowShot>) => void
  onGenerateImage: (
    imageSizePreset: string,
    options?: { inferenceFormat?: InferenceFormat },
  ) => void
  onStopGenerateImage?: () => void
  onClearGeneratedImages: () => void
  onSetPrimaryImage: (index: number) => void
  onVideoModelChange: (value: string) => void
  onGenerateVideo: (params: StoryboardVideoGenerateParams) => void
  onStopGenerateVideo?: () => void
  onClearVideos: () => void
  onSetPrimaryVideo: (index: number) => void
  onOpenVideoFolder: () => void
  onExtractAudio?: () => void
  extractAudioDisabled?: boolean
  extractAudioTitle?: string
  onBatchGenerateVideos?: () => void
  affixPresets: PromptAffixPreset[]
  selectedAffixPresetId?: number
  promptPrefix: string
  promptSuffix: string
  affixPresetDialogOpen: boolean
  onPromptPrefixChange: (value: string) => void
  onPromptSuffixChange: (value: string) => void
  onSelectAffixPreset: (presetId: number) => void
  onOpenAffixPresetManager: () => void
  onCloseAffixPresetManager: () => void
  onSaveAffixPresets: (presets: PromptAffixPreset[], selectedPresetId: number) => void
  projectTasks: WorkflowTask[]
  projectTasksLoading?: boolean
  onCancelWorkflowTask?: (taskId: string) => void
  cancellingWorkflowTaskId?: string | null
  onDeleteWorkflowTask?: (taskId: string) => void
  deletingWorkflowTaskId?: string | null
}

export function StoryboardRightPanel({
  shot,
  episodeShotCount,
  projectStyle,
  followingProjectStyle,
  projectStyleLabel,
  onFollowProjectStyleChange,
  storyboardTemplateOptions,
  storyboardTemplateKey,
  llmModelOptions,
  llmModelId,
  imageModelOptions,
  imageModelId,
  videoModelOptions,
  videoModels,
  videoModelId,
  projectRoot,
  generating,
  videoGenerating,
  batchVideoGenerating,
  videoPreparing,
  videoProgressMessage,
  videoProgressPercent,
  collapsed,
  onCollapse,
  onStoryboardTemplateChange,
  onLlmModelChange,
  onImageModelChange,
  onStyleChange,
  onGenerateImage,
  onStopGenerateImage,
  onClearGeneratedImages,
  onSetPrimaryImage,
  onVideoModelChange,
  onGenerateVideo,
  onStopGenerateVideo,
  onClearVideos,
  onSetPrimaryVideo,
  onOpenVideoFolder,
  onExtractAudio,
  extractAudioDisabled,
  extractAudioTitle,
  onBatchGenerateVideos,
  affixPresets,
  selectedAffixPresetId,
  promptPrefix,
  promptSuffix,
  affixPresetDialogOpen,
  onPromptPrefixChange,
  onPromptSuffixChange,
  onSelectAffixPreset,
  onOpenAffixPresetManager,
  onCloseAffixPresetManager,
  onSaveAffixPresets,
  projectTasks,
  projectTasksLoading = false,
  onCancelWorkflowTask,
  cancellingWorkflowTaskId = null,
  onDeleteWorkflowTask,
  deletingWorkflowTaskId = null,
}: StoryboardRightPanelProps) {
  const navigate = useNavigate()
  const settings = useSettingsStore((s) => s.settings)
  const getMergedModels = useSettingsStore((s) => s.getMergedModels)
  const rememberStoryboardImageSize = useSettingsStore((s) => s.rememberLastUsedStoryboardImageSize)
  const rememberImageGenerateParams = useSettingsStore(
    (s) => s.rememberLastUsedStoryboardImageGenerateParams,
  )
  const [tab, setTab] = useState<SideTab>('video')
  const [imageSize, setImageSize] = useState(DEFAULT_STORYBOARD_IMAGE_SIZE)
  const [inferenceFormat, setInferenceFormat] = useState<InferenceFormat>('single')

  const activeImageModel = useMemo(
    () => getMergedModels('image').find((model) => model.id === imageModelId) ?? null,
    [getMergedModels, imageModelId, settings?.imageModels, settings?.lastUsedStoryboardImageModelId],
  )

  const imageTierParams = useMemo(
    () =>
      normalizeImageGenerationTierParams(
        activeImageModel,
        null,
        resolveStoryboardImageTierPrefs(settings),
      ),
    [
      activeImageModel,
      settings?.lastUsedStoryboardImageQuality,
      settings?.lastUsedStoryboardImageResolution,
    ],
  )

  const handleImageTierParamsChange = (next: ImageGenerationTierParams) => {
    rememberImageGenerateParams({
      resolution: next.resolution ?? undefined,
      quality: next.quality ?? undefined,
    })
  }

  const imageCostPreview = ''
  const imageCostLoading = false

  useEffect(() => {
    if (!activeImageModel) return
    const normalized = normalizeImageGenerationTierParams(
      activeImageModel,
      null,
      resolveStoryboardImageTierPrefs(settings),
    )
    const current = resolveStoryboardImageTierPrefs(settings)
    if (
      normalized.resolution === (current.resolution ?? null) &&
      normalized.quality === (current.quality ?? null)
    ) {
      return
    }
    rememberImageGenerateParams({
      resolution: normalized.resolution ?? undefined,
      quality: normalized.quality ?? undefined,
    })
  }, [activeImageModel?.id])

  useEffect(() => {
    if (!settings) return
    setImageSize(
      normalizeImageSizePreset(
        settings.lastUsedStoryboardImageSize,
        DEFAULT_STORYBOARD_IMAGE_SIZE,
      ),
    )
    const prefs = resolveStoryboardImageGeneratePrefs(settings)
    setInferenceFormat(prefs.inferenceFormat)
  }, [
    settings,
    settings?.lastUsedStoryboardImageSize,
    settings?.lastUsedStoryboardImageInferenceFormat,
  ])

  /** 切换镜头或进入分镜页时默认展示「生视频」Tab */
  useEffect(() => {
    setTab('video')
  }, [shot?.id])

  useEffect(() => {
    if (batchVideoGenerating || videoGenerating || videoPreparing) {
      setTab('video')
    }
  }, [batchVideoGenerating, videoGenerating, videoPreparing])

  const handleImageSizeChange = (value: string) => {
    setImageSize(value)
    rememberStoryboardImageSize(value)
  }

  const handleInferenceFormatChange = (value: string) => {
    const format = normalizeInferenceFormat(value)
    setInferenceFormat(format)
    rememberImageGenerateParams({ inferenceFormat: format })
  }

  const generatedPaths = shot ? getGeneratedImagePaths(shot) : []
  const primaryIndex = shot?.primaryGeneratedImageIndex ?? 0
  const busy = generating

  if (collapsed) {
    return (
      <div className="w-14 shrink-0 flex flex-col h-full min-h-0 py-2.5 gap-2 rounded-lg border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={onCollapse}
          className="mx-2 flex items-center justify-center min-h-9 rounded-lg border border-cyan-500/40 bg-muted/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/55 transition-colors shrink-0"
          title="展开面板"
          aria-label="展开面板"
        >
          <PanelRightClose className="h-4 w-4 rotate-180" />
        </button>
        <div className="flex flex-col gap-1.5 px-2 flex-1 min-h-0 overflow-y-auto">
          {TABS.map((item) => {
            const railLabel = item.railLabel ?? item.label
            const active = tab === item.key
            return (
              <button
                key={item.key}
                type="button"
                data-testid={`storyboard-right-tab-${item.key}`}
                onClick={() => {
                  setTab(item.key)
                  onCollapse()
                }}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 min-h-[54px] w-full rounded-lg border text-[11px] transition-colors',
                  active
                    ? 'border-cyan-500/45 bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 shadow-sm'
                    : 'border-border/60 bg-muted/15 text-muted-foreground hover:text-foreground hover:bg-muted/35 hover:border-border',
                )}
              >
                {railLabel.split('').map((char, index) => (
                  <span key={`${item.key}-${index}`} className="leading-none">
                    {char}
                  </span>
                ))}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 w-[min(100%,320px)] shrink-0 rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-2 border-b border-border shrink-0 overflow-x-auto">
        <button
          type="button"
          onClick={onCollapse}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 shrink-0 transition-colors"
          title="收起面板"
          aria-label="收起面板"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            data-testid={`storyboard-right-tab-${item.key}`}
            onClick={() => setTab(item.key)}
            className={cn(
              'px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors',
              tab === item.key
                ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {tab === 'template' && (
          <>
            <div className="space-y-1">
              <Label className="text-[11px] text-foreground">分镜模板</Label>
              <Select
                value={storyboardTemplateKey}
                onChange={onStoryboardTemplateChange}
                options={storyboardTemplateOptions}
                placeholder="选择分镜模板"
                footerAction={{
                  label: '去配置',
                  onSelect: () => navigate('/settings/templates?section=storyboardTemplates'),
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-foreground">文本模型</Label>
              {llmModelOptions.length > 0 ? (
                <Select
                  value={llmModelId}
                  onChange={onLlmModelChange}
                  options={llmModelOptions}
                  placeholder="请选择 LLM 模型"
                />
              ) : (
                <p className="text-[10px] text-muted-foreground py-2">请先在系统设置中配置 LLM 模型</p>
              )}
            </div>
          </>
        )}

        {tab === 'image' && (
          <>
            {!shot ? (
              <p className="text-xs text-muted-foreground text-center py-8">请选择一个镜头</p>
            ) : (
              <>
                {imageModelOptions.length > 0 ? (
                  <div className="space-y-1">
                    <Label className="text-[11px] text-foreground">图片模型</Label>
                    <Select
                      value={imageModelId}
                      onChange={onImageModelChange}
                      options={imageModelOptions}
                      placeholder="选择图片模型"
                    />
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground py-2">请先在系统设置中配置图片模型</p>
                )}

                <ImageGenerationTierField
                  model={activeImageModel}
                  value={imageTierParams}
                  onChange={handleImageTierParamsChange}
                  labelClassName="text-[11px] text-foreground"
                />

                {null}

                <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 space-y-2">
                  <WorkflowStyleFollowBar
                    label="分镜风格"
                    following={followingProjectStyle}
                    projectStyleLabel={projectStyleLabel}
                    styleKey={projectStyle}
                    styleOptions={getStylePresetSelectOptions(settings)}
                    onFollowChange={onFollowProjectStyleChange}
                    onStyleChange={onStyleChange}
                  />
                  <div className="space-y-1">
                    <Label className="text-[11px] text-foreground">图片尺寸</Label>
                    <Select
                      value={imageSize}
                      onChange={handleImageSizeChange}
                      options={STORYBOARD_ASPECT_SIZE_OPTIONS.map((o) => ({
                        value: o.value,
                        label: o.label,
                      }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-foreground">推理格式</Label>
                    <Select
                      value={inferenceFormat}
                      onChange={handleInferenceFormatChange}
                      options={INFERENCE_FORMAT_OPTIONS.map((o) => ({
                        value: o.value,
                        label: o.label,
                      }))}
                    />
                  </div>
                  {generating ? (
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full h-9 disabled:opacity-60"
                      onClick={() => onStopGenerateImage?.()}
                    >
                      停止生成
                    </Button>
                  ) : (
                    <WorkshopAiButton
                      type="button"
                      sizePreset="default"
                      className="w-full h-9 disabled:opacity-60"
                      disabled={busy || !shot.prompt.trim() || imageModelOptions.length === 0}
                      onClick={() =>
                        onGenerateImage(imageSize, {
                          inferenceFormat,
                        })
                      }
                    >
                      生成当前分镜图
                    </WorkshopAiButton>
                  )}
                </div>

                <StoryboardShotGallery
                  paths={generatedPaths}
                  primaryIndex={primaryIndex}
                  projectRoot={projectRoot}
                  shot={shot}
                  onSelectPrimary={onSetPrimaryImage}
                  onClear={onClearGeneratedImages}
                />
              </>
            )}
          </>
        )}

        {tab === 'settings' && (
          <StoryboardSettingsTab
            affixPresets={affixPresets}
            selectedAffixPresetId={selectedAffixPresetId}
            promptPrefix={promptPrefix}
            promptSuffix={promptSuffix}
            onPromptPrefixChange={onPromptPrefixChange}
            onPromptSuffixChange={onPromptSuffixChange}
            onSelectAffixPreset={onSelectAffixPreset}
            onOpenPresetManager={onOpenAffixPresetManager}
          />
        )}

        {tab === 'video' && (
          <StoryboardVideoTab
            shot={shot}
            videoModels={videoModels}
            videoModelOptions={videoModelOptions}
            videoModelId={videoModelId}
            projectRoot={projectRoot}
            videoGenerating={videoGenerating}
            batchVideoGenerating={batchVideoGenerating}
            videoPreparing={videoPreparing}
            videoProgressMessage={videoProgressMessage}
            videoProgressPercent={videoProgressPercent}
            onVideoModelChange={onVideoModelChange}
            onGenerateCurrent={onGenerateVideo}
            onStopGenerate={onStopGenerateVideo}
            onClearVideos={onClearVideos}
            onSetPrimaryVideo={onSetPrimaryVideo}
            onOpenVideoFolder={onOpenVideoFolder}
            onExtractAudio={onExtractAudio}
            extractAudioDisabled={extractAudioDisabled}
            extractAudioTitle={extractAudioTitle}
            onBatchGenerateVideos={onBatchGenerateVideos}
          />
        )}

        {tab === 'tasks' && (
          <ProjectTaskList
            tasks={projectTasks}
            loading={projectTasksLoading}
            emptyHint="暂无任务。推理分镜、提取资产等操作会在此显示进度。"
            className="h-full"
            onCancelTask={onCancelWorkflowTask}
            cancellingTaskId={cancellingWorkflowTaskId}
            onDeleteTask={onDeleteWorkflowTask}
            deletingTaskId={deletingWorkflowTaskId}
          />
        )}
      </div>

      <StoryboardAffixPresetDialog
        open={affixPresetDialogOpen}
        presets={affixPresets}
        selectedPresetId={selectedAffixPresetId ?? affixPresets[0]?.id ?? 1}
        onClose={onCloseAffixPresetManager}
        onSave={onSaveAffixPresets}
      />
    </div>
  )
}
