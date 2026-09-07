// Copyright (c) Haode AI. All rights reserved.

/**
 * Step 14 验收：工坊 Step4 分镜主视频抽音入口可用性。
 */
import assert from 'node:assert/strict'
import {
  buildWorkflowShotExtractAudioLabel,
  resolveWorkflowShotExtractAudioAvailability,
} from '../src/lib/workflow/workflow-video-extract-audio'
import type { WorkflowShot } from '../src/types/workflow'

function makeShot(partial: Partial<WorkflowShot> = {}): WorkflowShot {
  return {
    id: 'shot_1',
    shotNumber: 3,
    episodeId: 'ep_1',
    status: 'success',
    videoStatus: 'success',
    generatedVideoPaths: ['assets/videos/shot_3.mp4'],
    primaryGeneratedVideoIndex: 0,
    ...partial,
  } as WorkflowShot
}

function testLocalShotAvailable() {
  const result = resolveWorkflowShotExtractAudioAvailability({
    shot: makeShot(),
  })
  assert.equal(result.available, true)
  console.log('[test:workflow-video-extract-audio] local shot: OK')
}

function testNoShotSelected() {
  assert.equal(resolveWorkflowShotExtractAudioAvailability({ shot: null }).available, false)
  console.log('[test:workflow-video-extract-audio] no shot: OK')
}

function testGeneratingDisabled() {
  assert.equal(
    resolveWorkflowShotExtractAudioAvailability({
      shot: makeShot(),
      videoGenerating: true,
    }).available,
    false,
  )
  assert.equal(
    resolveWorkflowShotExtractAudioAvailability({
      shot: makeShot({ videoStatus: 'generating' }),
    }).available,
    false,
  )
  console.log('[test:workflow-video-extract-audio] generating: OK')
}

function testLabel() {
  assert.equal(buildWorkflowShotExtractAudioLabel({ shotNumber: 5 }), '镜号 5')
  console.log('[test:workflow-video-extract-audio] label: OK')
}

function main() {
  testLocalShotAvailable()
  testNoShotSelected()
  testGeneratingDisabled()
  testLabel()
  console.log('[test:workflow-video-extract-audio] PASSED')
}

main()
