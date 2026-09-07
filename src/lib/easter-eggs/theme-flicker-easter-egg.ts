// Copyright (c) local-creator contributors. All rights reserved.

/** 5 秒内连续切换主题达到该次数则触发彩蛋 */
export const THEME_FLICKER_WINDOW_MS = 5000
export const THEME_FLICKER_THRESHOLD = 4

const toggleTimestamps: number[] = []

/**
 * 记录一次主题切换；若命中彩蛋条件返回 true（调用方负责播放效果）。
 * 无冷却：每次满足窗口内次数都可再次触发。
 */
export function recordThemeToggleForEasterEgg(now = Date.now()): boolean {
  toggleTimestamps.push(now)
  while (toggleTimestamps.length > 0 && now - toggleTimestamps[0]! > THEME_FLICKER_WINDOW_MS) {
    toggleTimestamps.shift()
  }

  if (toggleTimestamps.length < THEME_FLICKER_THRESHOLD) return false

  toggleTimestamps.length = 0
  return true
}

/** 测试 / 调试用：清计数 */
export function resetThemeFlickerEasterEgg() {
  toggleTimestamps.length = 0
}
