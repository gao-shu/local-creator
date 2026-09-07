import { getGeneratedImagePaths } from '@/lib/workflow/asset-utils'
import { getGeneratedVideoPaths, isStoryboardImageValidated } from '@/lib/workflow/shot-video-utils'
import type { WorkflowShot } from '@/types/workflow'

export function resolveShotValidateDisabledHint(shot: WorkflowShot, validating: boolean): string | null {
  if (isStoryboardImageValidated(shot)) return '分镜图已审核'
  if (validating) return '审核进行中'
  if (shot.status !== 'done') return '多数流程可跳过；需审核微视参考图时请先完成分镜图'
  return null
}

/** 放大窗 / 卡片底部一行状态（视频优先工作流） */
export function resolveShotWorkflowStatusHint(
  shot: WorkflowShot,
  options: { imageBusy?: boolean; videoBusy?: boolean; validating?: boolean },
): string {
  const { imageBusy = false, videoBusy = false, validating = false } = options
  if (videoBusy) return '视频生成中…'
  if (imageBusy || shot.status === 'generating') return '分镜图生成中…'
  if (validating) return '分镜图审核中…'
  const videoCount = getGeneratedVideoPaths(shot).length
  if (videoCount > 0) return `已有 ${videoCount} 个成片视频`
  if (getGeneratedImagePaths(shot).length > 0) return '已有分镜图，可继续生成视频'
  if (shot.prompt.trim()) return '文案已就绪，可直接生成视频'
  return '请先填写分镜提示词'
}
