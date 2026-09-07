// Copyright (c) local-creator contributors. All rights reserved.

import {
  resolveVideoExtractAudioAvailability,
  type VideoExtractAudioAvailability,
} from '@/lib/media/video-extract-audio-availability'
import { getShotPreviewVideoPath } from '@/lib/workflow/shot-video-utils'
import type { WorkflowShot } from '@/types/workflow'

export type WorkflowVideoExtractAudioAvailability = VideoExtractAudioAvailability

export function buildWorkflowShotExtractAudioLabel(shot: Pick<WorkflowShot, 'shotNumber'>): string {
  return `镜号 ${shot.shotNumber}`
}

/** 工坊 Step4 当前分镜主视频是否可抽音 */
export function resolveWorkflowShotExtractAudioAvailability(options: {
  shot: WorkflowShot | null | undefined
  videoGenerating?: boolean
  videoPreparing?: boolean
  mediaMissing?: boolean
}): WorkflowVideoExtractAudioAvailability {
  const shot = options.shot
  if (!shot) {
    return { available: false, disabledReason: '请选择一个镜头' }
  }

  const running =
    Boolean(options.videoGenerating) ||
    Boolean(options.videoPreparing) ||
    shot.videoStatus === 'generating'

  return resolveVideoExtractAudioAvailability({
    outputPath: getShotPreviewVideoPath(shot),
    running,
    mediaMissing: options.mediaMissing,
  })
}
