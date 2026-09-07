// Copyright (c) local-creator contributors. All rights reserved.

import type { PreviewAspectMode } from '@/components/workshop/storyboard-center-panel'

export type StoryboardPreviewMode = 'image' | 'video'

export interface StoryboardPreviewPrefs {
  previewMode: StoryboardPreviewMode
  previewAspect: PreviewAspectMode
}

export function normalizeStoryboardPreviewMode(
  value?: string | null,
  fallback: StoryboardPreviewMode = 'video',
): StoryboardPreviewMode {
  return value === 'image' || value === 'video' ? value : fallback
}

export function normalizeStoryboardPreviewAspect(
  value?: string | null,
  fallback: PreviewAspectMode = 'landscape',
): PreviewAspectMode {
  return value === 'landscape' || value === 'portrait' ? value : fallback
}

/** 从 settings.json 恢复 Step4 预览区上次选用 */
export function resolveStoryboardPreviewPrefs(
  settings?: {
    lastUsedStoryboardPreviewMode?: string
    lastUsedStoryboardPreviewAspect?: string
  } | null,
): StoryboardPreviewPrefs {
  return {
    previewMode: normalizeStoryboardPreviewMode(settings?.lastUsedStoryboardPreviewMode),
    previewAspect: normalizeStoryboardPreviewAspect(settings?.lastUsedStoryboardPreviewAspect),
  }
}
