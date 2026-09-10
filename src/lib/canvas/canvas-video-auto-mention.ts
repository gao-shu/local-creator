// Copyright (c) local-creator contributors. All rights reserved.

const CANVAS_VIDEO_AUTO_MENTION_KEY = 'lc-canvas-video-auto-mention'

/** 画布视频节点「自动@资产」开关（全局，与参考条 UI 一致） */
export function readCanvasVideoAutoMentionEnabled(): boolean {
  try {
    const raw = localStorage.getItem(CANVAS_VIDEO_AUTO_MENTION_KEY)
    if (raw === null) return true
    return raw !== '0' && raw !== 'false'
  } catch {
    return true
  }
}

export function writeCanvasVideoAutoMentionEnabled(enabled: boolean) {
  try {
    localStorage.setItem(CANVAS_VIDEO_AUTO_MENTION_KEY, enabled ? '1' : '0')
  } catch {
    // ignore
  }
}
