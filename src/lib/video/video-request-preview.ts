// Copyright (c) Local Creator. All rights reserved.

import type { ShotVideoReferenceKind } from '@/lib/workflow/shot-video-utils'

/** Debug / confirm-dialog preview of an outbound video create request. */
export interface VideoRequestPreview {
  method: 'POST'
  url: string
  headers: Record<string, string>
  body: Record<string, unknown>
  context: {
    modelName: string
    modelId: string
    shotNumber?: number
    referenceMode?: string
    referenceModeLabel?: string
    durationSec: number
    aspectRatio: string
    resolution?: string
    referenceImagePath?: string | null
    referenceImagePaths?: string[]
    referenceImageItems?: Array<{
      label: string
      path: string
      kind?: ShotVideoReferenceKind
    }>
    referenceAudioItems?: Array<{ label: string; path: string }>
    referenceNote?: string
    batchCount?: number
  }
}
