// Copyright (c) local-creator contributors. All rights reserved.

import type { AppSettings } from '@/types/settings'
import {
  joinPathSegments,
  resolveCanvasStorageDir,
} from '@/lib/storage/storage-path-utils'

export const CANVAS_ASSET_FOLDERS = {
  references: 'assets/references',
  images: 'assets/images',
  videos: 'assets/videos',
} as const

export function resolveCanvasProjectRoot(
  settings: Pick<AppSettings, 'dataRootPath'>,
  dataRoot: string,
  projectId: string,
): string {
  return joinPathSegments(resolveCanvasStorageDir(settings, dataRoot), projectId)
}

export function resolveCanvasAssetDir(
  settings: Pick<AppSettings, 'dataRootPath'>,
  dataRoot: string,
  projectId: string,
  kind: keyof typeof CANVAS_ASSET_FOLDERS,
): string {
  return joinPathSegments(
    resolveCanvasProjectRoot(settings, dataRoot, projectId),
    CANVAS_ASSET_FOLDERS[kind],
  )
}
