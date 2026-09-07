// Copyright (c) local-creator contributors. All rights reserved.

/** 分集展示标签（剪映/成片清单等） */
export function buildCanvasEpisodeLabel(episodeIndex?: number, episodeTitle?: string): string {
  if (episodeIndex != null) return `第 ${episodeIndex} 集`
  return episodeTitle?.trim() || '分集'
}
