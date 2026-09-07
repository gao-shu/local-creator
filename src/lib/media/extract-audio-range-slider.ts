// Copyright (c) Haode AI. All rights reserved.

import {
  normalizeExtractAudioRange,
  parseExtractSecInput,
} from '@/lib/media/extract-audio-range'
import { VOICE_AUDIO_MIN_SEC } from '@/lib/voice/voice-audio-utils'

/** 滑条模式下起止秒均有明确数值（不再用空 end 表示「到片尾」） */
export interface ExtractAudioSliderRange {
  startSec: number
  endSec: number
}

export interface ExtractAudioSliderInputs {
  startInput: string
  endInput: string
}

const RANGE_INPUT_DECIMALS = 1

function resolveMinSpanSec(durationSec: number, minSpanSec?: number): number {
  const requested = minSpanSec ?? VOICE_AUDIO_MIN_SEC
  if (!Number.isFinite(requested) || requested <= 0) return 0
  if (!Number.isFinite(durationSec) || durationSec <= 0) return requested
  return Math.min(requested, durationSec)
}

/** 将数值钳制到 [min, max] */
export function clampExtractRangeSec(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (!Number.isFinite(min) || !Number.isFinite(max)) return value
  if (max < min) return min
  return Math.min(max, Math.max(min, value))
}

/** probe 完成后的默认选区：整段 [0, duration] */
export function buildDefaultExtractRange(
  durationSec: number,
): ExtractAudioSliderRange | null {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return null
  return { startSec: 0, endSec: durationSec }
}

/**
 * 格式化为 1 位小数字符串，且解析后不超过 duration（避免 15.05 → "15.1" 再校验失败）。
 */
export function formatExtractRangeSecInput(sec: number, durationSec?: number): string {
  let value = sec
  if (durationSec != null && Number.isFinite(durationSec)) {
    value = Math.min(value, durationSec)
  }
  if (!Number.isFinite(value) || value < 0) value = 0

  let text = value.toFixed(RANGE_INPUT_DECIMALS)
  if (durationSec != null && Number.isFinite(durationSec) && Number(text) > durationSec) {
    text = (Math.floor(durationSec * 10 + 1e-9) / 10).toFixed(RANGE_INPUT_DECIMALS)
  }
  return text
}

/** 滑条秒数 → 精确输入框字符串（保留 1 位小数） */
export function rangeSecToInputs(
  range: ExtractAudioSliderRange,
  durationSec?: number,
): ExtractAudioSliderInputs {
  return {
    startInput: formatExtractRangeSecInput(range.startSec, durationSec),
    endInput: formatExtractRangeSecInput(range.endSec, durationSec),
  }
}

/**
 * 拖动后规范化选区：钳制到时长、保证左 ≤ 右，并尽量满足最小跨度。
 * 视频短于最小跨度时，退化为整段。
 */
export function clampExtractSliderRange(
  startSec: number,
  endSec: number,
  durationSec: number,
  options?: { minSpanSec?: number },
): { ok: true; range: ExtractAudioSliderRange } | { ok: false; error: string } {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return { ok: false, error: '视频时长无效' }
  }

  const minSpan = resolveMinSpanSec(durationSec, options?.minSpanSec)
  let start = clampExtractRangeSec(startSec, 0, durationSec)
  let end = clampExtractRangeSec(endSec, 0, durationSec)

  if (end < start) {
    const mid = start
    start = end
    end = mid
  }

  if (end - start < minSpan) {
    // 优先向右扩展；贴右则向左扩展
    if (start + minSpan <= durationSec) {
      end = start + minSpan
    } else if (end - minSpan >= 0) {
      start = end - minSpan
    } else {
      start = 0
      end = durationSec
    }
  }

  start = clampExtractRangeSec(start, 0, durationSec)
  end = clampExtractRangeSec(end, start, durationSec)

  if (end <= start) {
    return { ok: false, error: '结束时间须大于起始时间' }
  }

  return { ok: true, range: { startSec: start, endSec: end } }
}

/** 拖动滑条后写回 startInput / endInput */
export function syncRangeFromSlider(
  startSec: number,
  endSec: number,
  durationSec: number,
  options?: { minSpanSec?: number },
):
  | { ok: true; range: ExtractAudioSliderRange; startInput: string; endInput: string }
  | { ok: false; error: string } {
  const clamped = clampExtractSliderRange(startSec, endSec, durationSec, options)
  if (!clamped.ok) return clamped
  const inputs = rangeSecToInputs(clamped.range, durationSec)
  return {
    ok: true,
    range: clamped.range,
    startInput: inputs.startInput,
    endInput: inputs.endInput,
  }
}

/**
 * 弹窗播放/提取：以滑条钳制结果为准，避免 endInput toFixed 五入后校验失败、
 * 但区间条仍显示可贴片尾的「看起来合法」状态。
 */
export function resolveSliderBackedExtractRange(options: {
  startInput: string
  endInput: string
  durationSec: number
}):
  | { ok: true; startSec: number; endSec: number; startInput: string; endInput: string }
  | { ok: false; error: string } {
  if (!Number.isFinite(options.durationSec) || options.durationSec <= 0) {
    return { ok: false, error: '视频时长无效' }
  }

  const startParsed = parseExtractSecInput(options.startInput)
  if (startParsed === null) {
    return { ok: false, error: '起始时间无效' }
  }

  const endParsed = parseExtractSecInput(options.endInput)
  if (endParsed === null) {
    return { ok: false, error: '结束时间无效' }
  }

  const startSec = startParsed ?? 0
  const endSec = endParsed ?? options.durationSec
  const synced = syncRangeFromSlider(startSec, endSec, options.durationSec)
  if (!synced.ok) return synced
  return {
    ok: true,
    startSec: synced.range.startSec,
    endSec: synced.range.endSec,
    startInput: synced.startInput,
    endInput: synced.endInput,
  }
}

/**
 * 精确输入 → 滑条秒数。
 * 滑条模式下 end 不可为空；区间短于最小跨度时返回 error（不静默钳制，便于输入框提示）。
 */
export function inputsToRangeSec(
  startInput: string,
  endInput: string,
  durationSec: number,
  options?: { minSpanSec?: number },
): { ok: true; range: ExtractAudioSliderRange } | { ok: false; error: string } {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return { ok: false, error: '视频时长无效' }
  }

  const startParsed = parseExtractSecInput(startInput)
  if (startParsed === null || startParsed === undefined) {
    return { ok: false, error: '起始时间无效' }
  }

  const endParsed = parseExtractSecInput(endInput)
  if (endParsed === null) {
    return { ok: false, error: '结束时间无效' }
  }
  if (endParsed === undefined) {
    return { ok: false, error: '请填写结束时间' }
  }

  const normalized = normalizeExtractAudioRange(startParsed, endParsed, durationSec)
  if (!normalized.ok) return normalized

  const { startSec, endSec } = normalized.range
  if (endSec == null) {
    return { ok: false, error: '请填写结束时间' }
  }

  const minSpan = resolveMinSpanSec(durationSec, options?.minSpanSec)
  if (endSec - startSec < minSpan) {
    return {
      ok: false,
      error: `截取时长至少 ${minSpan.toFixed(1)} 秒`,
    }
  }

  return { ok: true, range: { startSec, endSec } }
}
