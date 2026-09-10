// Copyright (c) local-creator contributors. All rights reserved.
/**
 * 生视频重开占位文案
 *   npx --yes tsx scripts/test-video-progress-reopen-ui.ts
 */
import assert from 'node:assert/strict'
import {
  isMisleadingVideoPrepProgressMessage,
  normalizeVideoProgressPercent,
  resolveRunningVideoProgressMessageForUi,
  VIDEO_PROGRESS_REOPEN_PLACEHOLDER,
} from '../src/lib/video/video-progress'

assert.equal(isMisleadingVideoPrepProgressMessage('上传参考素材…'), true)
assert.equal(isMisleadingVideoPrepProgressMessage('创建视频任务…'), true)
assert.equal(isMisleadingVideoPrepProgressMessage(''), true)
assert.equal(isMisleadingVideoPrepProgressMessage('排队中 20%'), false)
assert.equal(isMisleadingVideoPrepProgressMessage('生成中 45%'), false)

// 进行中保留真实阶段文案，避免假「生成中 0%」
assert.equal(resolveRunningVideoProgressMessageForUi('上传参考素材…'), '上传参考素材…')
assert.equal(resolveRunningVideoProgressMessageForUi('创建视频任务…'), '创建视频任务…')
assert.equal(resolveRunningVideoProgressMessageForUi('排队中 20%'), '排队中 20%')
assert.equal(
  resolveRunningVideoProgressMessageForUi(undefined),
  VIDEO_PROGRESS_REOPEN_PLACEHOLDER.message,
)
assert.equal(VIDEO_PROGRESS_REOPEN_PLACEHOLDER.message.includes('0%'), false)

assert.equal(normalizeVideoProgressPercent(42), 42)
assert.equal(normalizeVideoProgressPercent(0.42), 42)
assert.equal(normalizeVideoProgressPercent(1), 1)
assert.equal(normalizeVideoProgressPercent(0), 0)

console.log('✓ video progress reopen UI helpers')
