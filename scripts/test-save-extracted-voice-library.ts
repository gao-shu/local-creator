// Copyright (c) Haode AI. All rights reserved.

/**
 * Step 8 验收：抽音产物 → voice-library:add-voice 衔接（不启动 Electron）。
 */
import assert from 'node:assert/strict'
import {
  assertExtractedAudioVoiceLibraryReady,
  buildDefaultExtractVoiceLibraryName,
} from '../src/lib/media/save-extracted-audio-to-voice-library'
import { validateVoiceAudioDuration, VOICE_AUDIO_MAX_SEC, VOICE_AUDIO_MIN_SEC } from '../src/lib/voice/voice-audio-utils'

function testDefaultVoiceName() {
  assert.equal(buildDefaultExtractVoiceLibraryName('镜头 03'), '镜头 03 · 参考音')
  assert.equal(buildDefaultExtractVoiceLibraryName(), '参考音')
  assert.equal(
    buildDefaultExtractVoiceLibraryName(
      '视频 镜 1 · 阿尔多 (低声自语, 沙哑) : “四十年了……”',
    ),
    '阿尔多 · 参考音',
  )
  console.log('[test:save-extracted-voice-library] buildDefaultExtractVoiceLibraryName: OK')
}

function testSourcePathValidation() {
  assert.doesNotThrow(() =>
    assertExtractedAudioVoiceLibraryReady('D:/proj/voices/extract_1/reference.mp3'),
  )
  assert.throws(
    () => assertExtractedAudioVoiceLibraryReady('D:/proj/voices/extract_1/reference.flac'),
    /mp3/,
  )
  assert.throws(() => assertExtractedAudioVoiceLibraryReady(''), /缺少/)
  console.log('[test:save-extracted-voice-library] assertExtractedAudioVoiceLibraryReady: OK')
}

function testDurationPolicyMatchesVoiceLibrary() {
  assert.equal(validateVoiceAudioDuration(VOICE_AUDIO_MIN_SEC), null)
  assert.equal(validateVoiceAudioDuration(VOICE_AUDIO_MAX_SEC), null)
  assert.match(String(validateVoiceAudioDuration(0.5) || ''), /时长需在/)
  assert.match(String(validateVoiceAudioDuration(30) || ''), /时长需在/)
  console.log('[test:save-extracted-voice-library] duration policy: OK')
}

function main() {
  testDefaultVoiceName()
  testSourcePathValidation()
  testDurationPolicyMatchesVoiceLibrary()
  console.log('[test:save-extracted-voice-library] PASSED')
}

main()
