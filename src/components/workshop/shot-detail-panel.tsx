import { useEffect, useState } from 'react'
import { ImageIcon } from 'lucide-react'
import { WorkshopAiButton } from '@/components/workshop/workshop-ai-button'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/input'
import { readImageAsDataUrl } from '@/lib/storage/fs-service'
import {
  DEFAULT_IMAGE_SIZE,
  resolveImageSizeApiValue,
  toImageSizeSelectOptions,
} from '@/lib/workflow/image-size-presets'
import type { WorkflowEpisode, WorkflowShot } from '@/types/workflow'
import { cn } from '@/lib/utils'

type DetailTab = 'template' | 'image' | 'video' | 'tasks'

const TABS: Array<{ key: DetailTab; label: string }> = [
  { key: 'template', label: '分镜' },
  { key: 'image', label: '生图' },
  { key: 'video', label: '生视频' },
  { key: 'tasks', label: '任务' },
]

interface ShotDetailPanelProps {
  episode: WorkflowEpisode | null
  shot: WorkflowShot | null
  storyboardTemplateOptions: Array<{ value: string; label: string }>
  storyboardTemplateKey: string
  imageModelOptions: Array<{ value: string; label: string }>
  imageModelId: string
  generating: boolean
  onStoryboardTemplateChange: (value: string) => void
  onImageModelChange: (value: string) => void
  onShotChange: (patch: Partial<WorkflowShot>) => void
  onGenerateImage: (imageSize: string) => void
}

export function ShotDetailPanel({
  episode,
  shot,
  storyboardTemplateOptions,
  storyboardTemplateKey,
  imageModelOptions,
  imageModelId,
  generating,
  onStoryboardTemplateChange,
  onImageModelChange,
  onShotChange,
  onGenerateImage,
}: ShotDetailPanelProps) {
  const [tab, setTab] = useState<DetailTab>('image')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState(DEFAULT_IMAGE_SIZE)

  useEffect(() => {
    let active = true
    const path = shot?.generatedImagePath
    const load = async () => {
      if (!path) {
        setPreviewUrl(null)
        return
      }
      const url = await readImageAsDataUrl(path)
      if (active) setPreviewUrl(url)
    }
    void load()
    return () => {
      active = false
    }
  }, [shot?.generatedImagePath])

  if (!episode) {
    return (
      <div className="h-full min-h-[320px] flex items-center justify-center text-sm text-muted-foreground rounded-lg border border-border bg-card">
        请选择分集
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-2 border-b border-border shrink-0 overflow-x-auto">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              'px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors',
              tab === item.key
                ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {tab === 'template' && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">分镜模板</Label>
              <Select
                value={storyboardTemplateKey}
                onChange={onStoryboardTemplateChange}
                options={storyboardTemplateOptions}
                placeholder="选择分镜模板"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">本集摘要</Label>
              <p className="text-xs text-muted-foreground leading-relaxed rounded-lg border border-border bg-muted/30 p-3 min-h-[80px]">
                {episode.summary || episode.content.slice(0, 200) || '暂无摘要'}
              </p>
            </div>
            {shot ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">空间锚点</Label>
                <Textarea
                  value={shot.spatialAnchor ?? ''}
                  onChange={(e) => onShotChange({ spatialAnchor: e.target.value })}
                  rows={3}
                  className="resize-none text-xs"
                  placeholder="二次验证后自动填入，也可手动编辑"
                />
              </div>
            ) : null}
          </>
        )}

        {tab === 'image' && (
          <>
            {!shot ? (
              <p className="text-xs text-muted-foreground text-center py-8">请选择一个镜头</p>
            ) : (
              <>
                <div className="relative aspect-video rounded-lg border border-border bg-muted/40 overflow-hidden">
                  {previewUrl ? (
                    <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-10 w-10 opacity-30 mb-2" />
                      <span className="text-xs">暂无生成图</span>
                    </div>
                  )}
                </div>
                {imageModelOptions.length > 0 ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">图片模型</Label>
                    <Select
                      value={imageModelId}
                      onChange={onImageModelChange}
                      options={imageModelOptions}
                    />
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">图片尺寸</Label>
                  <Select
                    value={imageSize}
                    onChange={setImageSize}
                    options={toImageSizeSelectOptions()}
                  />
                </div>
                <WorkshopAiButton
                  type="button"
                  sizePreset="default"
                  className="w-full"
                  disabled={generating || !shot.prompt.trim()}
                  loading={generating}
                  onClick={() => onGenerateImage(resolveImageSizeApiValue(imageSize))}
                >
                  生成当前镜头
                </WorkshopAiButton>
              </>
            )}
          </>
        )}

        {tab === 'video' && (
          <div className="text-center py-12 text-xs text-muted-foreground">
            生视频功能将在后续版本开放（P1）
          </div>
        )}

        {tab === 'tasks' && (
          <div className="text-center py-12 text-xs text-muted-foreground">
            分镜与生图任务请查看右上角任务面板
          </div>
        )}
      </div>
    </div>
  )
}
