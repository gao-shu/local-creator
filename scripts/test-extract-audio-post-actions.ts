// Copyright (c) local-creator contributors. All rights reserved.

/**
 * Step 11 验收：抽音成功后的路径解析（不启动 Electron）。
 */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { resolveCanvasProjectRoot } from '../src/lib/canvas/canvas-project-paths'
import {
  resolveExtractResultOutputAbs,
} from '../src/lib/media/extract-audio-post-actions'
import { buildProjectVoiceExtractRelativePath } from '../src/lib/voice/project-voice-extract-paths'

const projectRoot = resolveCanvasProjectRoot(
  { dataRootPath: 'D:/lc-data' },
  'D:/lc-data',
  'cv_test',
)

function testResolveFromOutputAbs() {
  const abs = join(projectRoot, 'voices', 'extract_1', 'reference.mp3')
  assert.equal(
    resolveExtractResultOutputAbs({
      success: true,
      outputAbs: abs,
      relativePath: 'voices/extract_1/reference.mp3',
    }),
    abs,
  )
  console.log('[test:extract-audio-post-actions] resolve from outputAbs: OK')
}

function testResolveFromRelativePath() {
  const relativePath = buildProjectVoiceExtractRelativePath(99)
  const expected = join(projectRoot, 'voices', 'extract_99', 'reference.mp3')
  assert.equal(
    resolveExtractResultOutputAbs({ success: true, relativePath }, projectRoot).replace(/\\/g, '/'),
    expected.replace(/\\/g, '/'),
  )
  console.log('[test:extract-audio-post-actions] resolve from relativePath: OK')
}

function testResolveMissingPath() {
  assert.equal(resolveExtractResultOutputAbs({ success: true }), '')
  console.log('[test:extract-audio-post-actions] resolve missing path: OK')
}

function main() {
  testResolveFromOutputAbs()
  testResolveFromRelativePath()
  testResolveMissingPath()
  console.log('[test:extract-audio-post-actions] PASSED')
}

main()
