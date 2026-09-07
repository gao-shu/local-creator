// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { buildModelSelectOptions } from '@/lib/models/model-select-options'
import { useSettingsStore } from '@/stores/settings-store'
import { DEFAULT_IMAGE_SIZE, normalizeImageSizePreset } from '@/lib/workflow/image-size-presets'
import { CanvasImageParamsPopover } from '@/components/canvas/nodes/canvas-image-params-popover'
import {
  normalizeVideoAspectValue,
  normalizeVideoDurationValue,
  normalizeVideoResolutionValue,
  resolveVideoAspectOptions,
  resolveVideoDurationOptions,
  shouldUseVideoDurationSlider,
} from '@/lib/workflow/storyboard-video-presets'
import {
  clampVideoReferenceMode,
  resolveVideoReferenceModeOptions,
} from '@/lib/models/video-model-capability'
import { buildCanvasVideoModelSwitchPatch } from '@/lib/canvas/canvas-video-params-sync'
import { VideoGenerationTierSelects } from '@/components/models/video-generation-tier-selects'
import { shouldShowVideoResolutionSelector } from '@/lib/models/video-generation-tier-params'
import { resolveSoftwareImageModelId, resolveSoftwareLlmModelId } from '@/lib/models/software-model-prefs'
import {
  normalizeImageGenerationTierParams,
  resolveAssetImageTierPrefs,
} from '@/lib/models/image-generation-tier-params'
import { resolveQuickExtractTemplateKey } from '@/lib/workflow/asset-utils'
import {
  listStoryboardTemplateSelectOptions,
  resolveCanvasStoryboardTemplateKey,
} from '@/lib/workflow/storyboard-prompt'
import {
  getLayoutPresetsForKind,
  normalizeLayoutKey,
  resolveProjectAssetLayoutKey,
} from '@/lib/workflow/layout-presets'
import {
  getStylePresetSelectOptions,
  resolveProjectAssetStyleKey,
} from '@/lib/workflow/style-presets'
import { cn } from '@/lib/utils'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'
import type { CanvasVideoNodeParamsPatch } from '@/lib/canvas/canvas-video-params-sync'

interface CanvasParamsPanelProps {
  open: boolean
  onClose: () => void
}

const COMPACT_SELECT_CLASS = 'h-7 text-[11px] px-2'

function ParamRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className={cn(hint && 'mb-3')}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="w-[68px] shrink-0 text-[11px] text-foreground">{label}</span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {hint ? (
        <>
          <div className="h-2" aria-hidden />
          <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p>
        </>
      ) : null}
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-base font-semibold tracking-wide text-foreground">{children}</p>
  )
}

function ParamSection({ children }: { children: ReactNode }) {
  return <section className="space-y-2">{children}</section>
}

/** 各模型区块之间：两个空行间距 */
function ModelSectionGap() {
  return (
    <>
      <div className="h-4 shrink-0" aria-hidden />
      <div className="h-4 shrink-0" aria-hidden />
    </>
  )
}

export function CanvasParamsPanel({ open, onClose }: CanvasParamsPanelProps) {
  const navigate = useNavigate()
  const { canvasVideoParams, updateCanvasVideoParams } = useCanvasEditor()
  const settings = useSettingsStore((state) => state.settings)
  const getMergedModels = useSettingsStore((state) => state.getMergedModels)
  const rememberLastUsedAssetImageModelId = useSettingsStore(
    (state) => state.rememberLastUsedAssetImageModelId,
  )
  const rememberLastUsedAssetImageTierParams = useSettingsStore(
    (state) => state.rememberLastUsedAssetImageTierParams,
  )
  const rememberLastUsedAssetImageSize = useSettingsStore(
    (state) => state.rememberLastUsedAssetImageSize,
  )
  const rememberLastUsedLlmModelId = useSettingsStore((state) => state.rememberLastUsedLlmModelId)
  const rememberLastUsedAssetStyleKey = useSettingsStore((state) => state.rememberLastUsedAssetStyleKey)
  const rememberLastUsedCanvasStoryboardTemplateKey = useSettingsStore(
    (state) => state.rememberLastUsedCanvasStoryboardTemplateKey,
  )
  const rememberLastUsedExtractTemplateKey = useSettingsStore(
    (state) => state.rememberLastUsedExtractTemplateKey,
  )
  const rememberLastUsedCanvasLayoutKey = useSettingsStore(
    (state) => state.rememberLastUsedCanvasLayoutKey,
  )

  const imageModels = getMergedModels('image')
  const videoModels = getMergedModels('video')
  const llmModels = getMergedModels('llm')

  const imageModelOptions = useMemo(
    () => buildModelSelectOptions(imageModels, 'image', { modelPickerOnly: true }),
    [imageModels],
  )
  const videoModelOptions = useMemo(
    () => buildModelSelectOptions(videoModels, 'video', { modelPickerOnly: true }),
    [videoModels],
  )
  const llmModelOptions = useMemo(
    () => buildModelSelectOptions(llmModels, 'llm'),
    [llmModels],
  )
  const styleOptions = useMemo(
    () => getStylePresetSelectOptions(settings),
    [settings],
  )
  const characterLayoutOptions = useMemo(
    () =>
      getLayoutPresetsForKind('character', settings).map((item) => ({
        value: item.key,
        label: item.name,
      })),
    [settings],
  )
  const sceneLayoutOptions = useMemo(
    () =>
      getLayoutPresetsForKind('scene', settings).map((item) => ({
        value: item.key,
        label: item.name,
      })),
    [settings],
  )
  const propLayoutOptions = useMemo(
    () =>
      getLayoutPresetsForKind('prop', settings).map((item) => ({
        value: item.key,
        label: item.name,
      })),
    [settings],
  )
  const storyboardTemplateOptions = useMemo(
    () => (settings ? listStoryboardTemplateSelectOptions(settings) : []),
    [settings],
  )
  const extractTemplateOptions = useMemo(
    () =>
      (settings?.extractTemplates ?? []).map((item) => ({
        value: item.key,
        label: item.name,
      })),
    [settings?.extractTemplates],
  )

  const imageModelId = resolveSoftwareImageModelId(settings, imageModels)
  const activeImageModel = imageModels.find((model) => model.id === imageModelId) ?? null
  const imageTierParams = useMemo(
    () =>
      normalizeImageGenerationTierParams(
        activeImageModel,
        null,
        resolveAssetImageTierPrefs(settings),
      ),
    [
      activeImageModel,
      settings?.lastUsedAssetImageQuality,
      settings?.lastUsedAssetImageResolution,
    ],
  )

  const imageSize = normalizeImageSizePreset(
    settings?.lastUsedAssetImageSize,
    DEFAULT_IMAGE_SIZE,
  )

  const llmModelId = resolveSoftwareLlmModelId(settings, llmModels)

  const storyboardTemplateKey = useMemo(() => {
    if (!settings) return storyboardTemplateOptions[0]?.value || ''
    return resolveCanvasStoryboardTemplateKey(settings)
  }, [settings, storyboardTemplateOptions])

  /** 旧 settings 存了空壳 key 时写回可用模板（与 canvas-editor-page 一致） */
  useEffect(() => {
    if (!settings) return
    const resolved = resolveCanvasStoryboardTemplateKey(settings)
    const stored = settings.lastUsedCanvasStoryboardTemplateKey?.trim()
    if (stored !== resolved) {
      rememberLastUsedCanvasStoryboardTemplateKey(resolved)
    }
  }, [rememberLastUsedCanvasStoryboardTemplateKey, settings])

  const extractTemplateKey = settings
    ? resolveQuickExtractTemplateKey(settings)
    : extractTemplateOptions[0]?.value || ''

  const styleKey = resolveProjectAssetStyleKey(
    null,
    'character',
    settings?.lastUsedAssetStyleKeys,
    settings,
  )

  const characterLayoutKey =
    normalizeLayoutKey(settings?.lastUsedCanvasLayoutKeys?.character, 'character') ||
    resolveProjectAssetLayoutKey(undefined, 'character', settings?.defaultAssetLayoutKeys)
  const sceneLayoutKey =
    normalizeLayoutKey(settings?.lastUsedCanvasLayoutKeys?.scene, 'scene') ||
    resolveProjectAssetLayoutKey(undefined, 'scene', settings?.defaultAssetLayoutKeys)
  const propLayoutKey =
    normalizeLayoutKey(settings?.lastUsedCanvasLayoutKeys?.prop, 'prop') ||
    resolveProjectAssetLayoutKey(undefined, 'prop', settings?.defaultAssetLayoutKeys)

  const videoModelId =
    canvasVideoParams.videoModelId && videoModels.some((m) => m.id === canvasVideoParams.videoModelId)
      ? canvasVideoParams.videoModelId
      : videoModels[0]?.id ?? ''

  const activeVideoModel = videoModels.find((model) => model.id === videoModelId) ?? null
  const durationOptions = resolveVideoDurationOptions(activeVideoModel)
  const useDurationSlider = shouldUseVideoDurationSlider(activeVideoModel)
  const durationMin = useDurationSlider ? Number(durationOptions[0]?.value) || 1 : undefined
  const durationMax = useDurationSlider
    ? Number(durationOptions[durationOptions.length - 1]?.value) || 30
    : undefined
  const durationSec = Number(
    normalizeVideoDurationValue(
      canvasVideoParams.durationSec != null ? String(canvasVideoParams.durationSec) : '',
      activeVideoModel,
    ),
  ) || 5
  const aspectOptions = resolveVideoAspectOptions(activeVideoModel)
  const referenceModeOptions = useMemo(
    () => resolveVideoReferenceModeOptions(activeVideoModel),
    [activeVideoModel],
  )
  const referenceModeValue = clampVideoReferenceMode(
    canvasVideoParams.referenceMode,
    activeVideoModel,
  )
  const showVideoResolutionSelector = shouldShowVideoResolutionSelector(activeVideoModel)
  const syncVideoParams = (patch?: Partial<CanvasVideoNodeParamsPatch>) => {
    updateCanvasVideoParams(patch)
  }

  useEffect(() => {
    if (referenceModeValue === canvasVideoParams.referenceMode) return
    syncVideoParams({ referenceMode: referenceModeValue })
  }, [activeVideoModel, canvasVideoParams.referenceMode, referenceModeValue])

  if (!open) return null

  return (
    <aside
      data-testid="canvas-params-panel"
      className={cn(
        'flex w-[320px] shrink-0 flex-col overflow-hidden',
        'border-l border-border/25 bg-card/40 backdrop-blur-md',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-cyan-500" />
          <h3 className="text-sm font-semibold tracking-tight">参数设置</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          aria-label="关闭参数设置"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ParamSection>
          <SectionTitle>文本设置</SectionTitle>
          <ParamRow label="文本模型">
            {llmModelOptions.length ? (
              <Select
                className={COMPACT_SELECT_CLASS}
                options={llmModelOptions}
                value={llmModelId}
                onChange={(value) => rememberLastUsedLlmModelId(value)}
              />
            ) : (
              <p className="py-1 text-[10px] text-muted-foreground">请先配置文本模型</p>
            )}
          </ParamRow>
          <ParamRow label="分镜模板">
            {storyboardTemplateOptions.length ? (
              <Select
                className={COMPACT_SELECT_CLASS}
                options={storyboardTemplateOptions}
                value={storyboardTemplateKey}
                onChange={(value) => rememberLastUsedCanvasStoryboardTemplateKey(value)}
              />
            ) : (
              <p className="py-1 text-[10px] text-muted-foreground">请先配置分镜模板</p>
            )}
          </ParamRow>
          <ParamRow label="提取模板">
            {extractTemplateOptions.length ? (
              <Select
                className={COMPACT_SELECT_CLASS}
                options={extractTemplateOptions}
                value={extractTemplateKey}
                onChange={(value) => rememberLastUsedExtractTemplateKey(value)}
              />
            ) : (
              <p className="py-1 text-[10px] text-muted-foreground">请先配置提取模板</p>
            )}
          </ParamRow>
        </ParamSection>

        <ModelSectionGap />

        <ParamSection>
          <SectionTitle>图片设置</SectionTitle>
          <ParamRow label="图片模型">
            {imageModelOptions.length ? (
              <Select
                className={COMPACT_SELECT_CLASS}
                options={imageModelOptions}
                value={imageModelId}
                hideSuffixInTrigger
                hideSuffixInMenu
                onChange={(value) => rememberLastUsedAssetImageModelId(value)}
              />
            ) : (
              <p className="py-1 text-[10px] text-muted-foreground">请先配置图片模型</p>
            )}
          </ParamRow>
          <ParamRow label="图片尺寸">
            <CanvasImageParamsPopover
              imageSize={imageSize}
              onImageSizeChange={rememberLastUsedAssetImageSize}
              model={activeImageModel}
              tierParams={imageTierParams}
              onTierParamsChange={(next) =>
                rememberLastUsedAssetImageTierParams({
                  resolution: next.resolution,
                  quality: next.quality,
                })
              }
              className="w-full"
              triggerClassName="w-full max-w-none"
            />
          </ParamRow>
          <ParamRow label="画风">
            <Select
              className={COMPACT_SELECT_CLASS}
              options={styleOptions}
              value={styleKey}
              onChange={(value) => {
                rememberLastUsedAssetStyleKey('character', value)
                rememberLastUsedAssetStyleKey('scene', value)
                rememberLastUsedAssetStyleKey('prop', value)
              }}
            />
          </ParamRow>
          <ParamRow label="角色布局">
            <Select
              className={COMPACT_SELECT_CLASS}
              options={characterLayoutOptions}
              value={characterLayoutKey}
              onChange={(value) => rememberLastUsedCanvasLayoutKey('character', value)}
              footerAction={{
                label: '去设置自定义布局形式',
                onSelect: () =>
                  navigate('/settings/templates?section=layoutTemplates&layoutKind=character'),
              }}
            />
          </ParamRow>
          <ParamRow label="场景布局">
            <Select
              className={COMPACT_SELECT_CLASS}
              options={sceneLayoutOptions}
              value={sceneLayoutKey}
              onChange={(value) => rememberLastUsedCanvasLayoutKey('scene', value)}
              footerAction={{
                label: '去设置自定义布局形式',
                onSelect: () =>
                  navigate('/settings/templates?section=layoutTemplates&layoutKind=scene'),
              }}
            />
          </ParamRow>
          <ParamRow label="道具布局">
            <Select
              className={COMPACT_SELECT_CLASS}
              options={propLayoutOptions}
              value={propLayoutKey}
              onChange={(value) => rememberLastUsedCanvasLayoutKey('prop', value)}
              footerAction={{
                label: '去设置自定义布局形式',
                onSelect: () =>
                  navigate('/settings/templates?section=layoutTemplates&layoutKind=prop'),
              }}
            />
          </ParamRow>
        </ParamSection>

        <ModelSectionGap />

        <ParamSection>
          <SectionTitle>视频设置</SectionTitle>
          <ParamRow label="视频模型">
            {videoModelOptions.length ? (
              <Select
                className={COMPACT_SELECT_CLASS}
                options={videoModelOptions}
                value={videoModelId}
                hideSuffixInTrigger
                hideSuffixInMenu
                onChange={(value) => {
                  syncVideoParams(
                    buildCanvasVideoModelSwitchPatch(value, videoModels, canvasVideoParams),
                  )
                }}
              />
            ) : (
              <p className="py-1 text-[10px] text-muted-foreground">请先配置视频模型</p>
            )}
          </ParamRow>
          <ParamRow label="参考模式">
            <Select
              className={COMPACT_SELECT_CLASS}
              options={referenceModeOptions}
              value={referenceModeValue}
              onChange={(value) => {
                syncVideoParams({
                  referenceMode: clampVideoReferenceMode(value, activeVideoModel),
                })
              }}
            />
          </ParamRow>
          <ParamRow label="视频时长">
            {useDurationSlider && durationMin != null && durationMax != null ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] tabular-nums text-foreground/85">{durationSec} s</span>
                </div>
                <input
                  type="range"
                  min={durationMin}
                  max={durationMax}
                  step={1}
                  value={durationSec}
                  onChange={(event) => {
                    syncVideoParams({
                      durationSec:
                        Number(
                          normalizeVideoDurationValue(event.target.value, activeVideoModel),
                        ) || 5,
                    })
                  }}
                  className="h-1.5 w-full cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
                  <span>{durationMin}s</span>
                  <span>{durationMax}s</span>
                </div>
              </div>
            ) : (
              <Select
                className={COMPACT_SELECT_CLASS}
                options={durationOptions}
                value={String(durationSec)}
                onChange={(value) => {
                  syncVideoParams({
                    durationSec: Number(normalizeVideoDurationValue(value, activeVideoModel)) || 5,
                  })
                }}
              />
            )}
          </ParamRow>
          <ParamRow label="画面比例">
            <Select
              className={COMPACT_SELECT_CLASS}
              options={aspectOptions}
              value={normalizeVideoAspectValue(canvasVideoParams.aspectRatio, activeVideoModel)}
              onChange={(value) => {
                syncVideoParams({
                  aspectRatio: normalizeVideoAspectValue(value, activeVideoModel),
                })
              }}
            />
          </ParamRow>
          {showVideoResolutionSelector ? (
            <ParamRow label="分辨率">
              <VideoGenerationTierSelects
                className="w-full"
                compactSelectClass={COMPACT_SELECT_CLASS}
                model={activeVideoModel}
                value={{
                  resolution: normalizeVideoResolutionValue(
                    canvasVideoParams.resolution,
                    activeVideoModel,
                  ),
                }}
                onChange={(next) => {
                  syncVideoParams({
                    resolution: normalizeVideoResolutionValue(
                      next.resolution,
                      activeVideoModel,
                    ),
                  })
                }}
              />
            </ParamRow>
          ) : null}
        </ParamSection>
      </div>

      <div className="border-t border-border/20 px-4 py-3">
        <button
          type="button"
          className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => navigate('/settings/models')}
        >
          前往系统设置管理模型
        </button>
      </div>
    </aside>
  )
}
