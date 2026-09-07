// Copyright (c) Haode AI. All rights reserved.

/** Electron E2E：preload 注入 HAODE_E2E_MOCK_AI=1 时走 mock 生图/生视频，避免联调 API */
export function shouldUseE2eMockAi(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(window.__HAODE_E2E_MOCK_AI__)
}

/** E2E mock 延迟（ms），可由 preload 注入 __HAODE_E2E_MOCK_DELAY_MS__ 覆盖 */
export function getE2eMockDelayMs(fallback: number): number {
  if (!shouldUseE2eMockAi()) return fallback
  const override = window.__HAODE_E2E_MOCK_DELAY_MS__
  return typeof override === 'number' && override > 0 ? override : fallback
}

export type E2eMockFailKind = 'shot-image' | 'shot-video' | 'asset-image'

/** preload 注入 __HAODE_E2E_MOCK_FAIL__：shot-image | shot-video | asset-image | all */
export function getE2eMockFailMode(): E2eMockFailKind | 'all' | null {
  if (!shouldUseE2eMockAi()) return null
  const raw = window.__HAODE_E2E_MOCK_FAIL__
  if (typeof raw !== 'string' || !raw.trim()) return null
  const mode = raw.trim()
  if (mode === 'all') return 'all'
  if (mode === 'shot-image' || mode === 'shot-video' || mode === 'asset-image') return mode
  return null
}

export function shouldE2eMockFail(kind: E2eMockFailKind): boolean {
  const mode = getE2eMockFailMode()
  if (!mode) return false
  return mode === 'all' || mode === kind
}

export function createE2eMockFailError(kind: E2eMockFailKind): Error {
  const label =
    kind === 'shot-video' ? '分镜生视频' : kind === 'asset-image' ? '资产生图' : '分镜生图'
  return new Error(`429 Too Many Requests: E2E mock ${label} failure`)
}
