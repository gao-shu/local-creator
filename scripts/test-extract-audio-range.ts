// Copyright (c) local-creator contributors. All rights reserved.

/**
 * Step 10 / R0 验收：抽音起止秒校验 + 滑条选区同步。
 */
import assert from 'node:assert/strict'
import {
  formatProbeDurationLabel,
  normalizeExtractAudioRange,
  parseExtractSecInput,
  resolveExtractAudioRequestRange,
} from '../src/lib/media/extract-audio-range'
import {
  buildDefaultExtractRange,
  clampExtractRangeSec,
  inputsToRangeSec,
  rangeSecToInputs,
  resolveSliderBackedExtractRange,
  syncRangeFromSlider,
} from '../src/lib/media/extract-audio-range-slider'
import { VOICE_AUDIO_MIN_SEC } from '../src/lib/voice/voice-audio-utils'

function testNormalizeExtractAudioRange() {
  assert.deepEqual(normalizeExtractAudioRange(0, undefined, 10), {
    ok: true,
    range: { startSec: 0, endSec: null },
  })
  assert.equal(normalizeExtractAudioRange(5, 3, 10).ok, false)
  assert.equal(normalizeExtractAudioRange(11, undefined, 10).ok, false)

  // 展示四舍五入 15.05 → 15.1，终点贴齐片尾不应报超出
  const roundedEnd = normalizeExtractAudioRange(4.6, 15.1, 15.05)
  assert.equal(roundedEnd.ok, true)
  if (roundedEnd.ok) {
    assert.equal(roundedEnd.range.endSec, 15.05)
  }

  // 明显超出仍报错
  assert.equal(normalizeExtractAudioRange(0, 16, 15.05).ok, false)
  console.log('[test:extract-audio-range] normalizeExtractAudioRange: OK')
}

function testParseExtractSecInput() {
  assert.equal(parseExtractSecInput(''), undefined)
  assert.equal(parseExtractSecInput('1.5'), 1.5)
  assert.equal(parseExtractSecInput('bad'), null)
  console.log('[test:extract-audio-range] parseExtractSecInput: OK')
}

function testResolveExtractAudioRequestRange() {
  assert.deepEqual(resolveExtractAudioRequestRange({ mode: 'full', startInput: '0', endInput: '' }), {
    ok: true,
  })
  assert.deepEqual(
    resolveExtractAudioRequestRange({
      mode: 'range',
      startInput: '1',
      endInput: '5',
      durationSec: 10,
    }),
    { ok: true, startSec: 1, endSec: 5 },
  )
  assert.deepEqual(
    resolveExtractAudioRequestRange({
      mode: 'range',
      startInput: '2',
      endInput: '',
      durationSec: 10,
    }),
    { ok: true, startSec: 2, endSec: undefined },
  )
  assert.equal(
    resolveExtractAudioRequestRange({
      mode: 'range',
      startInput: 'x',
      endInput: '5',
      durationSec: 10,
    }).ok,
    false,
  )

  // 回归：滑条终点 toFixed(1) 五入后仍可播放选区
  const playRange = resolveExtractAudioRequestRange({
    mode: 'range',
    startInput: '4.6',
    endInput: '15.1',
    durationSec: 15.05,
  })
  assert.equal(playRange.ok, true)
  if (playRange.ok) {
    assert.equal(playRange.startSec, 4.6)
    assert.equal(playRange.endSec, 15.05)
  }
  console.log('[test:extract-audio-range] resolveExtractAudioRequestRange: OK')
}

function testFormatProbeDurationLabel() {
  assert.equal(formatProbeDurationLabel(12.34), '12.3 秒')
  assert.equal(formatProbeDurationLabel(null), '未知')
  console.log('[test:extract-audio-range] formatProbeDurationLabel: OK')
}

function testBuildDefaultExtractRange() {
  assert.deepEqual(buildDefaultExtractRange(15.4), { startSec: 0, endSec: 15.4 })
  assert.equal(buildDefaultExtractRange(0), null)
  assert.equal(buildDefaultExtractRange(Number.NaN), null)
  console.log('[test:extract-audio-range] buildDefaultExtractRange: OK')
}

function testClampAndSyncRangeFromSlider() {
  assert.equal(clampExtractRangeSec(12, 0, 10), 10)
  assert.equal(clampExtractRangeSec(-1, 0, 10), 0)

  const synced = syncRangeFromSlider(5, 13, 15)
  assert.equal(synced.ok, true)
  if (synced.ok) {
    assert.deepEqual(synced.range, { startSec: 5, endSec: 13 })
    assert.deepEqual(rangeSecToInputs(synced.range), {
      startInput: '5.0',
      endInput: '13.0',
    })
    assert.equal(synced.startInput, '5.0')
    assert.equal(synced.endInput, '13.0')
  }

  // 拖动后 input 同步（含越界钳制）
  const clampedSync = syncRangeFromSlider(-2, 99, 15)
  assert.equal(clampedSync.ok, true)
  if (clampedSync.ok) {
    assert.deepEqual(clampedSync.range, { startSec: 0, endSec: 15 })
    assert.equal(clampedSync.startInput, '0.0')
    assert.equal(clampedSync.endInput, '15.0')
  }

  // 时长 15.05 贴齐片尾：写回 input 不得变成解析后 > duration 的 "15.1"
  const nearEnd = syncRangeFromSlider(4.6, 15.05, 15.05)
  assert.equal(nearEnd.ok, true)
  if (nearEnd.ok) {
    assert.ok(Number(nearEnd.endInput) <= 15.05 + 1e-9)
    assert.equal(
      resolveExtractAudioRequestRange({
        mode: 'range',
        startInput: nearEnd.startInput,
        endInput: nearEnd.endInput,
        durationSec: 15.05,
      }).ok,
      true,
    )
  }

  // 区间 < MIN_SEC → 钳制扩展到最小跨度
  const short = syncRangeFromSlider(5, 5.5, 15)
  assert.equal(short.ok, true)
  if (short.ok) {
    assert.ok(short.range.endSec - short.range.startSec >= VOICE_AUDIO_MIN_SEC - 1e-9)
    assert.equal(short.range.startSec, 5)
    assert.ok(Math.abs(short.range.endSec - (5 + VOICE_AUDIO_MIN_SEC)) < 1e-9)
  }

  // start ≥ end → 交换后仍可规范化
  const swapped = syncRangeFromSlider(10, 4, 15)
  assert.equal(swapped.ok, true)
  if (swapped.ok) {
    assert.ok(swapped.range.endSec > swapped.range.startSec)
    assert.equal(swapped.range.startSec, 4)
  }

  console.log('[test:extract-audio-range] syncRangeFromSlider: OK')
}

function testInputsToRangeSec() {
  assert.deepEqual(inputsToRangeSec('5', '13', 15), {
    ok: true,
    range: { startSec: 5, endSec: 13 },
  })

  // 区间 < MIN_SEC → error（精确输入不静默钳制）
  const tooShort = inputsToRangeSec('5', '5.5', 15)
  assert.equal(tooShort.ok, false)

  // start ≥ end → error
  assert.equal(inputsToRangeSec('8', '3', 15).ok, false)

  // 空 end → error（滑条模式要求明确终点）
  assert.equal(inputsToRangeSec('2', '', 15).ok, false)

  console.log('[test:extract-audio-range] inputsToRangeSec: OK')
}

function testResolveSliderBackedExtractRange() {
  // 复现截图：展示 15.1，真实时长 15.05，终点 input 为 15.1
  const backed = resolveSliderBackedExtractRange({
    startInput: '4.0',
    endInput: '15.1',
    durationSec: 15.05,
  })
  assert.equal(backed.ok, true)
  if (backed.ok) {
    assert.equal(backed.startSec, 4)
    assert.ok(backed.endSec <= 15.05 + 1e-9)
  }
  console.log('[test:extract-audio-range] resolveSliderBackedExtractRange: OK')
}

function main() {
  testNormalizeExtractAudioRange()
  testParseExtractSecInput()
  testResolveExtractAudioRequestRange()
  testFormatProbeDurationLabel()
  testBuildDefaultExtractRange()
  testClampAndSyncRangeFromSlider()
  testInputsToRangeSec()
  testResolveSliderBackedExtractRange()
  console.log('[test:extract-audio-range] PASSED')
}

main()
