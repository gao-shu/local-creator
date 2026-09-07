// Copyright (c) local-creator contributors. All rights reserved.

import { revealPathInExplorer } from '@/lib/storage/fs-service'
import {
  isRemoteMediaReference,
  resolveProjectMediaPath,
} from '@/lib/storage/media-path-resolver'
import { PROJECT_MEDIA_FOLDERS } from '@/lib/storage/project-paths'
import { joinPathSegments } from '@/lib/storage/storage-path-utils'
import { getAssetPreviewPath } from '@/lib/workflow/asset-utils'
import type { WorkflowAsset } from '@/types/workflow'

export function resolveAssetExplorerTarget(
  asset: WorkflowAsset,
  projectRoot: string,
): { absolutePath: string; revealFile: boolean } {
  const previewPath = getAssetPreviewPath(asset)
  if (previewPath && !isRemoteMediaReference(previewPath)) {
    const absolutePath = resolveProjectMediaPath(previewPath, projectRoot)
    if (absolutePath && !isRemoteMediaReference(absolutePath)) {
      return { absolutePath, revealFile: true }
    }
  }

  const absolutePath = joinPathSegments(projectRoot, PROJECT_MEDIA_FOLDERS[asset.kind])
  return { absolutePath, revealFile: false }
}

export async function openAssetInExplorer(
  asset: WorkflowAsset,
  projectRoot: string,
): Promise<{ success: boolean; error?: string }> {
  const target = resolveAssetExplorerTarget(asset, projectRoot)
  return revealPathInExplorer(target.absolutePath, { revealFile: target.revealFile })
}
