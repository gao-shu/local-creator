// Copyright (c) local-creator contributors. All rights reserved.

import type { WorkflowAsset } from '@/types/workflow'

export type MaterialsSyncProjectKind = 'workflow' | 'canvas'

/** 同步素材到全局库时传入的资产快照 */
export interface MaterialsSyncAssetPayload {
  asset: WorkflowAsset
  projectId: string
  projectTitle: string
  projectKind?: MaterialsSyncProjectKind
}

export interface MaterialsSyncAssetResult {
  success: boolean
  entry?: import('@/types/material-library').SyncedMaterialEntry
  error?: string
}
