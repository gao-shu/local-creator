// Copyright (c) Haode AI. All rights reserved.

/**
 * Step 7 验收：抽音落盘约定 + voice-library:add-voice sourceAudioPath 兼容。
 */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { resolveCanvasProjectRoot } from '../src/lib/canvas/canvas-project-paths'
import {
  buildProjectVoiceExtractRelativePath,
  isProjectVoiceExtractRelativePath,
  isVoiceLibraryAddVoiceSourceExtension,
  PROJECT_VOICE_EXTRACT_REFERENCE_FILENAME,
  resolveProjectVoiceExtractAbsolutePath,
  resolveProjectVoiceExtractOutputAbs,
  resolveProjectVoiceExtractOutputDir,
} from '../src/lib/voice/project-voice-extract-paths'

const projectRoot = resolveCanvasProjectRoot(
  { dataRootPath: 'D:/haode-data' },
  'D:/haode-data',
  'cv_test',
)

function testRelativePathConvention() {
  const relative = buildProjectVoiceExtractRelativePath(1700000000000)
  assert.equal(relative, 'voices/extract_1700000000000/reference.mp3')
  assert.equal(isProjectVoiceExtractRelativePath(relative), true)
  assert.equal(isProjectVoiceExtractRelativePath('voices/voice_1/reference.mp3'), false)
  assert.equal(isProjectVoiceExtractRelativePath('voices/shot_a/upload_1.mp3'), false)
  console.log('[test:project-voice-extract-paths] relative path convention: OK')
}

function testAbsolutePathLayout() {
  const dir = resolveProjectVoiceExtractOutputDir(projectRoot, 42)
  const abs = resolveProjectVoiceExtractOutputAbs(projectRoot, 42)
  assert.equal(dir.replace(/\\/g, '/'), 'D:/haode-data/canvas/cv_test/voices/extract_42')
  assert.equal(abs.replace(/\\/g, '/'), `${dir.replace(/\\/g, '/')}/${PROJECT_VOICE_EXTRACT_REFERENCE_FILENAME}`)
  console.log('[test:project-voice-extract-paths] absolute path layout: OK')
}

function testVoiceLibraryAddVoiceCompatibility() {
  const relative = buildProjectVoiceExtractRelativePath(99)
  const abs = resolveProjectVoiceExtractAbsolutePath(projectRoot, relative)
  assert.equal(abs.replace(/\\/g, '/'), 'D:/haode-data/canvas/cv_test/voices/extract_99/reference.mp3')
  assert.equal(isVoiceLibraryAddVoiceSourceExtension(abs), true)
  assert.equal(isVoiceLibraryAddVoiceSourceExtension(join(projectRoot, 'voices/extract_99/reference.wav')), true)
  assert.equal(isVoiceLibraryAddVoiceSourceExtension(join(projectRoot, 'voices/extract_99/reference.flac')), false)
  console.log('[test:project-voice-extract-paths] add-voice sourceAudioPath: OK')
}

function main() {
  testRelativePathConvention()
  testAbsolutePathLayout()
  testVoiceLibraryAddVoiceCompatibility()
  console.log('[test:project-voice-extract-paths] PASSED')
}

main()
