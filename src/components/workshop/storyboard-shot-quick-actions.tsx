import { Loader2, Play } from 'lucide-react'
import { WorkshopAiButton } from '@/components/workshop/workshop-ai-button'
import { Button } from '@/components/ui/button'
import { resolveShotValidateDisabledHint } from '@/lib/workflow/storyboard-shot-status-hint'
import { isStoryboardImageValidated } from '@/lib/workflow/shot-video-utils'
import type { WorkflowShot } from '@/types/workflow'

interface StoryboardShotQuickActionsProps {
  shot: WorkflowShot
  imageBusy: boolean
  validating?: boolean
  videoBusy?: boolean
  onGenerate: () => void
  onStopGenerate: () => void
  onValidate: () => void
  onGenerateVideo: () => void
  onStopGenerateVideo: () => void
  /** card：与左栏卡片 testid 一致；dialog：放大编辑窗专用 testid */
  testIdScope?: 'card' | 'dialog'
  /** 视频优先：主按钮为生成视频，分镜图降为次要操作 */
  videoFirst?: boolean
}

function resolveTestId(scope: 'card' | 'dialog', shotId: string, suffix: string): string {
  if (scope === 'dialog') return `storyboard-shot-script-dialog-${suffix}`
  return `storyboard-shot-${shotId}-${suffix}`
}

/** 分镜快捷操作 — 默认视频优先（改文案 → 生视频为主路径） */
export function StoryboardShotQuickActions({
  shot,
  imageBusy,
  validating = false,
  videoBusy = false,
  onGenerate,
  onStopGenerate,
  onValidate,
  onGenerateVideo,
  onStopGenerateVideo,
  testIdScope = 'card',
  videoFirst = true,
}: StoryboardShotQuickActionsProps) {
  const isImageGenerating = imageBusy || shot.status === 'generating'
  const promptReady = Boolean(shot.prompt.trim())
  const validateHint = resolveShotValidateDisabledHint(shot, validating)
  const validateDisabled = Boolean(validateHint)

  const videoAction = videoBusy ? (
    <Button
      type="button"
      size="sm"
      data-testid={resolveTestId(testIdScope, shot.id, 'stop-video')}
      className="h-8 text-xs px-2.5 bg-red-600 hover:bg-red-500 text-white border-0"
      onClick={onStopGenerateVideo}
    >
      停止生成
    </Button>
  ) : (
    <WorkshopAiButton
      type="button"
      sizePreset="compact"
      icon={Play}
      data-testid={resolveTestId(testIdScope, shot.id, 'generate-video')}
      disabled={!promptReady}
      title={promptReady ? undefined : '请先填写分镜提示词'}
      onClick={onGenerateVideo}
    >
      生成视频
    </WorkshopAiButton>
  )

  const imageAction = isImageGenerating ? (
    <Button
      type="button"
      size="sm"
      data-testid={resolveTestId(testIdScope, shot.id, 'stop-image')}
      className="h-8 text-xs px-2.5 bg-red-600 hover:bg-red-500 text-white border-0"
      onClick={onStopGenerate}
    >
      停止生成
    </Button>
  ) : videoFirst ? (
    <Button
      type="button"
      size="sm"
      variant="outline"
      data-testid={resolveTestId(testIdScope, shot.id, 'generate-image')}
      disabled={!promptReady}
      title={promptReady ? '可选：需要分镜预览图或微视审核时再生成' : '请先填写分镜提示词'}
      className="h-8 text-[11px] px-2"
      onClick={onGenerate}
    >
      生成分镜图
    </Button>
  ) : (
    <WorkshopAiButton
      type="button"
      sizePreset="compact"
      disabled={!promptReady}
      data-testid={resolveTestId(testIdScope, shot.id, 'generate-image')}
      title={promptReady ? undefined : '请先填写分镜提示词'}
      onClick={onGenerate}
    >
      生成分镜图
    </WorkshopAiButton>
  )

  const validateAction = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 text-[11px] px-2"
      data-testid={resolveTestId(testIdScope, shot.id, 'validate')}
      disabled={validateDisabled}
      title={validateHint ?? '审核分镜图并写入微视参考（多数流程可跳过）'}
      onClick={onValidate}
    >
      {validating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
      {isStoryboardImageValidated(shot) ? '已审核' : validating ? '审核中' : '审核'}
    </Button>
  )

  if (!videoFirst) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {imageAction}
        {videoAction}
        {validateAction}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {imageAction}
      {videoAction}
      {validateAction}
    </div>
  )
}
