// Copyright (c) local-creator contributors. All rights reserved.

/**
 * Step 9 验收：画布视频节点「提取音频」入口可用性判定。
 */
import assert from 'node:assert/strict'
import {
  buildCanvasAudioNodeDataFromExtract,
  resolveCanvasExtractAudioMediaOwner,
  resolveCanvasVideoExtractAudioAvailability,
  resolveCanvasVideoExtractAudioAvailabilityFromNode,
} from '../src/lib/canvas/canvas-video-extract-audio'

function testLocalOutputAvailable() {
  const result = resolveCanvasVideoExtractAudioAvailability({
    outputPath: 'assets/videos/shot_1.mp4',
    running: false,
    uploading: false,
    mediaMissing: false,
  })
  assert.equal(result.available, true)
  console.log('[test:canvas-video-extract-audio] local output: OK')
}

function testRemoteAndPreviewDisabled() {
  assert.equal(
    resolveCanvasVideoExtractAudioAvailability({ outputPath: 'https://cdn/a.mp4' }).available,
    false,
  )
  assert.equal(
    resolveCanvasVideoExtractAudioAvailability({ outputPath: 'preview:tmp' }).available,
    false,
  )
  assert.match(
    resolveCanvasVideoExtractAudioAvailability({ outputPath: 'https://cdn/a.mp4' }).disabledReason || '',
    /落盘/,
  )
  console.log('[test:canvas-video-extract-audio] remote/preview disabled: OK')
}

function testRunningAndMissing() {
  assert.equal(
    resolveCanvasVideoExtractAudioAvailability({
      outputPath: 'assets/videos/a.mp4',
      running: true,
    }).available,
    false,
  )
  assert.equal(
    resolveCanvasVideoExtractAudioAvailability({
      outputPath: 'assets/videos/a.mp4',
      mediaMissing: true,
    }).available,
    false,
  )
  console.log('[test:canvas-video-extract-audio] running/missing: OK')
}

function testFromNodeData() {
  const result = resolveCanvasVideoExtractAudioAvailabilityFromNode({
    data: { outputPath: 'assets/videos/a.mp4', status: 'success' },
    running: false,
  })
  assert.equal(result.available, true)
  console.log('[test:canvas-video-extract-audio] from node data: OK')
}

function testBuildAudioNodeFromExtractOwner() {
  const owner = resolveCanvasExtractAudioMediaOwner('canvas_proj_1')
  assert.deepEqual(owner, {
    mediaOwnerKind: 'canvas',
    mediaOwnerProjectId: 'canvas_proj_1',
  })

  const data = buildCanvasAudioNodeDataFromExtract(
    {
      success: true,
      relativePath: 'voices/extract_123/reference.mp3',
      outputAbs: 'E:/data/canvas_proj_1/voices/extract_123/reference.mp3',
    },
    { mode: 'range', startSec: 5, endSec: 13, videoDurationSec: 20 },
    {
      videoNodeId: 'video_1',
      videoLabel: '镜头 A',
      canvasProjectId: 'canvas_proj_1',
    },
  )
  assert.ok(data)
  assert.equal(data?.mediaOwnerKind, 'canvas')
  assert.equal(data?.mediaOwnerProjectId, 'canvas_proj_1')
  assert.equal(data?.audioRelativePath, 'voices/extract_123/reference.mp3')
  console.log('[test:canvas-video-extract-audio] build audio node owner: OK')
}

function main() {
  testLocalOutputAvailable()
  testRemoteAndPreviewDisabled()
  testRunningAndMissing()
  testFromNodeData()
  testBuildAudioNodeFromExtractOwner()
  console.log('[test:canvas-video-extract-audio] PASSED')
}

main()
