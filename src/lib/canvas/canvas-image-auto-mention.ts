// Copyright (c) local-creator contributors. All rights reserved.

const CANVAS_IMAGE_AUTO_MENTION_KEY = 'lc-canvas-image-auto-mention'

/**
 * 画布图片节点「自动@资产」开关（全局，与参考条 UI 一致）。
 * 默认开启：与视频节点一致；关闭后仅保留用户手写 @。
 */
export function readCanvasImageAutoMentionEnabled(): boolean {
  try {
    const raw = localStorage.getItem(CANVAS_IMAGE_AUTO_MENTION_KEY)
    if (raw === null) return true
    return raw !== '0' && raw !== 'false'
  } catch {
    return true
  }
}

export function writeCanvasImageAutoMentionEnabled(enabled: boolean) {
  try {
    localStorage.setItem(CANVAS_IMAGE_AUTO_MENTION_KEY, enabled ? '1' : '0')
  } catch {
    // ignore
  }
}
