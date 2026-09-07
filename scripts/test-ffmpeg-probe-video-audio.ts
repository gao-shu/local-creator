// Copyright (c) Haode AI. All rights reserved.

/**
 * Step 3 验收：probeVideoAudioAtPath — 有音轨 / 无音轨各 1 段（ffmpeg 生成夹具）。
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseFfprobeVideoAudioPayload,
  probeVideoAudioAtPath,
} from '../electron/main/ffmpeg-probe'
import {
  formatFfmpegRunFailure,
  isFfmpegRunSuccess,
  runFfmpeg,
} from '../electron/main/ffmpeg-runtime'

const projectRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const bundleDir = join(projectRoot, 'vendor', 'ffmpeg', 'win')
const ffmpegExe = join(bundleDir, 'ffmpeg.exe')
const fixtureDir = join(projectRoot, '.tmp-ffmpeg-probe')

function assertNear(actual: number | null, expected: number, toleranceSec = 0.35) {
  assert.ok(actual != null, `expected duration ~${expected}s, got null`)
  assert.ok(
    Math.abs(actual - expected) <= toleranceSec,
    `expected duration ~${expected}s, got ${actual}`,
  )
}

async function generateFixture(outputPath: string, withAudio: boolean) {
  const args = withAudio
    ? [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc=duration=2:size=320x240:rate=1',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=2',
        '-t',
        '2',
        '-c:v',
        'libx264',
        '-c:a',
        'aac',
        '-shortest',
        outputPath,
      ]
    : [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc=duration=2:size=320x240:rate=1',
        '-t',
        '2',
        '-an',
        '-c:v',
        'libx264',
        outputPath,
      ]

  const result = await runFfmpeg(args, { executablePath: ffmpegExe })
  if (!isFfmpegRunSuccess(result)) {
    throw new Error(formatFfmpegRunFailure(result))
  }
}

function testParsePayload() {
  const noAudio = parseFfprobeVideoAudioPayload(
    JSON.stringify({
      streams: [{ codec_type: 'video' }],
      format: { duration: '2.5' },
    }),
  )
  assert.equal(noAudio.hasAudio, false)
  assert.equal(noAudio.durationSec, 2.5)

  const withAudio = parseFfprobeVideoAudioPayload(
    JSON.stringify({
      streams: [{ codec_type: 'video' }, { codec_type: 'audio' }],
      format: { duration: '10' },
    }),
  )
  assert.equal(withAudio.hasAudio, true)
  assert.equal(withAudio.durationSec, 10)
  console.log('[test:ffmpeg-probe] parseFfprobeVideoAudioPayload: OK')
}

async function main() {
  testParsePayload()

  if (process.platform !== 'win32') {
    console.log('[test:ffmpeg-probe] 跳过夹具探测：当前仅验收 Windows vendor 路径')
    return
  }

  if (!existsSync(ffmpegExe)) {
    console.log('[test:ffmpeg-probe] ffmpeg.exe MISSING — run npm run fetch:ffmpeg-win')
    process.exitCode = 1
    return
  }

  rmSync(fixtureDir, { recursive: true, force: true })
  mkdirSync(fixtureDir, { recursive: true })

  const noAudioPath = join(fixtureDir, 'no_audio.mp4')
  const withAudioPath = join(fixtureDir, 'with_audio.mp4')

  console.log('[test:ffmpeg-probe] generating fixtures…')
  await generateFixture(noAudioPath, false)
  await generateFixture(withAudioPath, true)

  const ffprobeOptions = { executablePath: join(bundleDir, 'ffprobe.exe') }

  const noAudioProbe = await probeVideoAudioAtPath(noAudioPath, ffprobeOptions)
  if (noAudioProbe.error) {
    throw new Error(`no_audio probe failed: ${noAudioProbe.error}`)
  }
  assert.equal(noAudioProbe.hasAudio, false, 'no_audio.mp4 should have hasAudio=false')
  assertNear(noAudioProbe.durationSec, 2)
  console.log(
    `[test:ffmpeg-probe] no_audio: hasAudio=false durationSec=${noAudioProbe.durationSec}`,
  )

  const withAudioProbe = await probeVideoAudioAtPath(withAudioPath, ffprobeOptions)
  if (withAudioProbe.error) {
    throw new Error(`with_audio probe failed: ${withAudioProbe.error}`)
  }
  assert.equal(withAudioProbe.hasAudio, true, 'with_audio.mp4 should have hasAudio=true')
  assertNear(withAudioProbe.durationSec, 2)
  console.log(
    `[test:ffmpeg-probe] with_audio: hasAudio=true durationSec=${withAudioProbe.durationSec}`,
  )

  console.log('[test:ffmpeg-probe] PASSED')
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[test:ffmpeg-probe]', message)
  process.exitCode = 1
})
