// Copyright (c) Haode AI. All rights reserved.

/**
 * Step 6 验收：本地视频路径校验 + 与 Step 7 落盘约定联调（不启动 Electron / IPC）。
 */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { normalizeLocalVideoInputPath } from '../src/lib/media/extract-audio-from-video'
import { resolveCanvasProjectRoot } from '../src/lib/canvas/canvas-project-paths'
import {
  buildProjectVoiceExtractRelativePath,
  PROJECT_VOICE_EXTRACT_REFERENCE_FILENAME,
  resolveProjectVoiceExtractOutputDir,
} from '../src/lib/voice/project-voice-extract-paths'
import { toProjectRelativeVoicePath } from '../src/lib/voice/project-voice-library-paths'

const projectRoot = resolveCanvasProjectRoot(
  { dataRootPath: 'D:/haode-data' },
  'D:/haode-data',
  'cv_test',
)

function testBuildExtractVoiceRelativePath() {
  assert.equal(
    buildProjectVoiceExtractRelativePath(1700000000000),
    'voices/extract_1700000000000/reference.mp3',
  )
  console.log('[test:extract-audio-from-video] buildProjectVoiceExtractRelativePath: OK')
}

function testResolveExtractVoiceOutputDir() {
  const dir = resolveProjectVoiceExtractOutputDir(projectRoot, 42)
  assert.equal(dir.replace(/\\/g, '/'), 'D:/haode-data/canvas/cv_test/voices/extract_42')
  console.log('[test:extract-audio-from-video] resolveProjectVoiceExtractOutputDir: OK')
}

function testNormalizeLocalVideoInputPath() {
  assert.equal(normalizeLocalVideoInputPath('assets/videos/a.mp4'), 'assets/videos/a.mp4')
  assert.throws(() => normalizeLocalVideoInputPath('preview:tmp'), /尚未落盘/)
  assert.throws(() => normalizeLocalVideoInputPath('https://cdn.example/a.mp4'), /本地/)
  console.log('[test:extract-audio-from-video] normalizeLocalVideoInputPath: OK')
}

function testToProjectRelativeVoicePath() {
  const abs = join(projectRoot, 'voices', 'extract_99', PROJECT_VOICE_EXTRACT_REFERENCE_FILENAME)
  assert.equal(toProjectRelativeVoicePath(abs, projectRoot), 'voices/extract_99/reference.mp3')
  console.log('[test:extract-audio-from-video] toProjectRelativeVoicePath: OK')
}

function main() {
  testBuildExtractVoiceRelativePath()
  testResolveExtractVoiceOutputDir()
  testNormalizeLocalVideoInputPath()
  testToProjectRelativeVoicePath()
  console.log('[test:extract-audio-from-video] PASSED')
}

main()
