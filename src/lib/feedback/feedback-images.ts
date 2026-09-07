// Copyright (c) Haode AI. All rights reserved.

import {
  resolveClientFilePublicUrl,
  uploadClientImageFile,
} from '@/lib/auth/client-file-service'

export const MAX_FEEDBACK_IMAGES = 3
export const MAX_FEEDBACK_IMAGE_BYTES = 5 * 1024 * 1024

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export type FeedbackImageDraft = {
  id: string
  file: File
  previewUrl: string
}

export function validateFeedbackImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.has(file.type)) {
    return '仅支持 JPG、PNG、WebP、GIF 截图'
  }
  if (file.size > MAX_FEEDBACK_IMAGE_BYTES) {
    return '单张截图不能超过 5MB'
  }
  return null
}

export function createFeedbackImageDraft(file: File): FeedbackImageDraft {
  const error = validateFeedbackImageFile(file)
  if (error) throw new Error(error)
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: URL.createObjectURL(file),
  }
}

export function revokeFeedbackImageDrafts(drafts: FeedbackImageDraft[]): void {
  for (const draft of drafts) {
    URL.revokeObjectURL(draft.previewUrl)
  }
}

export async function uploadFeedbackImages(
  drafts: FeedbackImageDraft[],
  apiBase?: string,
): Promise<string[]> {
  const urls: string[] = []
  for (const draft of drafts) {
    const uploaded = await uploadClientImageFile(draft.file, apiBase, 'images')
    urls.push(resolveClientFilePublicUrl(uploaded, apiBase))
  }
  return urls
}
