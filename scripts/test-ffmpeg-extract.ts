// Copyright (c) local-creator contributors. All rights reserved.

/**
 * Step 4 验收：整段 + 截取写 mp3；无音轨视频应失败。
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { probeVideoAudioAtPath } from '../electron/main/ffmpeg-probe'
import {
  buildFfmpegExtractArgs,
  extractAudioAtPath,
  normalizeExtractRange,
} from '../electron/main/ffmpeg-extract'
import {
  formatFfmpegRunFailure,
  isFfmpegRunSuccess,
  runFfmpeg,
} from '../electron/main/ffmpeg-runtime'

const projectRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const bundleDir = join(projectRoot, 'vendor', 'ffmpeg', 'win')
const ffmpegExe = join(bundleDir, 'ffmpeg.exe')
const ffprobeExe = join(bundleDir, 'ffprobe.exe')
const fixtureDir = join(projectRoot, '.tmp-ffmpeg-extract')

function assertNear(actual: number | null, expected: number, toleranceSec = 0.45) {
  assert.ok(actual != null, `expected duration ~${expected}s, got null`)
  assert.ok(
    Math.abs(actual - expected) <= toleranceSec,
    `expected duration ~${expected}s, got ${actual}`,
  )
}

async function generateWithAudioFixture(outputPath: string) {
  const result = await runFfmpeg(
    [
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
    ],
    { executablePath: ffmpegExe },
  )
  if (!isFfmpegRunSuccess(result)) {
    throw new Error(formatFfmpegRunFailure(result))
  }
}

async function generateNoAudioFixture(outputPath: string) {
  const result = await runFfmpeg(
    [
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
    ],
    { executablePath: ffmpegExe },
  )
  if (!isFfmpegRunSuccess(result)) {
    throw new Error(formatFfmpegRunFailure(result))
  }
}

function testNormalizeExtractRange() {
  assert.deepEqual(normalizeExtractRange(undefined, undefined, 10), {
    ok: true,
    range: { startSec: 0, endSec: null },
  })
  assert.equal(normalizeExtractRange(1, 0.5, 10).ok, false)
  assert.equal(normalizeExtractRange(11, undefined, 10).ok, false)
  assert.equal(normalizeExtractRange(0, 12, 10).ok, false)

  const args = buildFfmpegExtractArgs('/in.mp4', '/out.mp3', { startSec: 0.5, endSec: 1.5 })
  assert.ok(args.includes('-ss'))
  assert.ok(args.includes('0.5'))
  assert.ok(args.includes('-to'))
  assert.ok(args.includes('1.5'))
  assert.ok(args.includes('libmp3lame'))
  console.log('[test:ffmpeg-extract] normalizeExtractRange / buildFfmpegExtractArgs: OK')
}

async function main() {
  testNormalizeExtractRange()

  if (process.platform !== 'win32') {
    console.log('[test:ffmpeg-extract] 跳过夹具提取：当前仅验收 Windows vendor 路径')
    return
  }

  if (!existsSync(ffmpegExe) || !existsSync(ffprobeExe)) {
    console.log('[test:ffmpeg-extract] ffmpeg/ffprobe MISSING — run npm run fetch:ffmpeg-win')
    process.exitCode = 1
    return
  }

  rmSync(fixtureDir, { recursive: true, force: true })
  mkdirSync(fixtureDir, { recursive: true })

  const withAudioPath = join(fixtureDir, 'with_audio.mp4')
  const noAudioPath = join(fixtureDir, 'no_audio.mp4')
  const fullMp3 = join(fixtureDir, 'full.mp3')
  const trimMp3 = join(fixtureDir, 'trim.mp3')

  console.log('[test:ffmpeg-extract] generating fixtures…')
  await generateWithAudioFixture(withAudioPath)
  await generateNoAudioFixture(noAudioPath)

  const ffmpegOptions = { executablePath: ffmpegExe }
  const ffprobeOptions = { executablePath: ffprobeExe }

  const noAudioResult = await extractAudioAtPath(
    { inputAbs: noAudioPath, outputAbs: join(fixtureDir, 'should_fail.mp3') },
    ffmpegOptions,
  )
  assert.equal(noAudioResult.success, false)
  assert.match(String(noAudioResult.error || ''), /无音轨/)
  console.log('[test:ffmpeg-extract] no_audio rejected: OK')

  const fullResult = await extractAudioAtPath(
    { inputAbs: withAudioPath, outputAbs: fullMp3 },
    ffmpegOptions,
  )
  assert.equal(fullResult.success, true, fullResult.error)
  assert.ok(existsSync(fullMp3))
  assert.ok(statSync(fullMp3).size > 0)
  const fullProbe = await probeVideoAudioAtPath(fullMp3, ffprobeOptions)
  assertNear(fullProbe.durationSec, 2)
  console.log(`[test:ffmpeg-extract] full mp3: OK durationSec=${fullProbe.durationSec}`)

  const trimResult = await extractAudioAtPath(
    {
      inputAbs: withAudioPath,
      outputAbs: trimMp3,
      startSec: 0.5,
      endSec: 1.5,
    },
    ffmpegOptions,
  )
  assert.equal(trimResult.success, true, trimResult.error)
  assert.ok(existsSync(trimMp3))
  const trimProbe = await probeVideoAudioAtPath(trimMp3, ffprobeOptions)
  assertNear(trimProbe.durationSec, 1)
  console.log(`[test:ffmpeg-extract] trim mp3: OK durationSec=${trimProbe.durationSec}`)

  console.log('[test:ffmpeg-extract] PASSED')
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[test:ffmpeg-extract]', message)
  process.exitCode = 1
})
