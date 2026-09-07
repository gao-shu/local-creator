// Copyright (c) local-creator contributors. All rights reserved.

export type ExtractAudioRangeMode = 'full' | 'range'

export interface NormalizedExtractAudioRange {
  startSec: number
  /** null 表示截取到片尾 */
  endSec: number | null
}

/**
 * 1 位小数展示可能把真实时长「五入」变大（如 15.05 → 15.1）。
 * 输入/滑条写回若落在展示精度内，校验时应钳回真实时长，而不是报超出。
 */
export function clampExtractSecToDuration(
  value: number,
  durationSec: number,
): number {
  if (!Number.isFinite(value) || !Number.isFinite(durationSec)) return value
  if (value <= durationSec + 1e-9) return Math.min(value, durationSec)

  // 允许超出至多一个 0.1s 展示步长（含 toFixed 五入）
  const displayMax = Number(durationSec.toFixed(1))
  if (value <= durationSec + 0.1 + 1e-9 || value <= displayMax + 1e-9) {
    return durationSec
  }
  return value
}

/** 规范化起止秒并校验（endSec 省略表示到片尾） */
export function normalizeExtractAudioRange(
  startSec?: number,
  endSec?: number,
  durationSec?: number | null,
): { ok: true; range: NormalizedExtractAudioRange } | { ok: false; error: string } {
  let start = startSec ?? 0
  let end = endSec ?? null

  if (!Number.isFinite(start) || start < 0) {
    return { ok: false, error: '起始时间无效' }
  }
  if (end != null && (!Number.isFinite(end) || end <= start)) {
    return { ok: false, error: '结束时间须大于起始时间' }
  }
  if (durationSec != null && Number.isFinite(durationSec)) {
    start = clampExtractSecToDuration(start, durationSec)
    if (end != null) {
      end = clampExtractSecToDuration(end, durationSec)
    }
    if (start >= durationSec) {
      return { ok: false, error: '起始时间超出视频时长' }
    }
    if (end != null && end > durationSec) {
      return { ok: false, error: '结束时间超出视频时长' }
    }
    if (end != null && end <= start) {
      return { ok: false, error: '结束时间须大于起始时间' }
    }
  }

  return { ok: true, range: { startSec: start, endSec: end } }
}

export function parseExtractSecInput(value: string): number | undefined | null {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return undefined
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

export function formatProbeDurationLabel(durationSec: number | null | undefined): string {
  if (durationSec == null || !Number.isFinite(durationSec)) return '未知'
  return `${durationSec.toFixed(1)} 秒`
}

export function resolveExtractAudioRequestRange(options: {
  mode: ExtractAudioRangeMode
  startInput: string
  endInput: string
  durationSec?: number | null
}):
  | { ok: true; startSec?: number; endSec?: number }
  | { ok: false; error: string } {
  if (options.mode === 'full') {
    return { ok: true }
  }

  const startParsed = parseExtractSecInput(options.startInput)
  if (startParsed === null) {
    return { ok: false, error: '起始时间无效' }
  }

  const endParsed = parseExtractSecInput(options.endInput)
  if (endParsed === null) {
    return { ok: false, error: '结束时间无效' }
  }

  const normalized = normalizeExtractAudioRange(startParsed, endParsed, options.durationSec)
  if (!normalized.ok) {
    return normalized
  }

  const { startSec, endSec } = normalized.range
  return {
    ok: true,
    startSec,
    endSec: endSec ?? undefined,
  }
}
