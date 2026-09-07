// Copyright (c) local-creator contributors. All rights reserved.

import { getAssetPreviewPath } from '@/lib/workflow/asset-utils'
import { getShotPreviewPath } from '@/lib/workflow/shot-utils'
import type { WorkflowProjectData } from '@/types/workflow'

/** 从项目数据中提取预览图路径（优先分镜图，其次资产图） */
export function collectProjectPreviewPaths(
  data: WorkflowProjectData,
  limit = 4,
): string[] {
  const paths: string[] = []
  const seen = new Set<string>()

  const push = (value?: string) => {
    if (!value || seen.has(value)) return
    seen.add(value)
    paths.push(value)
  }

  const shots = [...(data.shots ?? [])].sort((a, b) => b.updatedAt - a.updatedAt)
  for (const shot of shots) {
    push(getShotPreviewPath(shot))
    if (paths.length >= limit) return paths
  }

  const assets = [...data.characters, ...data.scenes, ...data.props].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  )
  for (const asset of assets) {
    push(getAssetPreviewPath(asset))
    if (paths.length >= limit) return paths
  }

  return paths
}
