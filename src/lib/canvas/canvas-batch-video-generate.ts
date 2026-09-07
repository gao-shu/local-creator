// Copyright (c) Haode AI. All rights reserved.

import { VIDEO_BATCH_CONCURRENCY } from '@/constants/batch-concurrency'

export type CanvasBatchVideoRunShot = (nodeId: string, index: number) => Promise<boolean | void>

/** 按并发上限串行调度批量视频生成（与工坊 Step4 对齐） */
export async function runCanvasBatchVideoGenerate(options: {
  nodeIds: readonly string[]
  runShot: CanvasBatchVideoRunShot
  concurrency?: number
  onProgress?: (completed: number, total: number) => void
}): Promise<void> {
  const total = options.nodeIds.length
  if (total === 0) return

  const limit = Math.max(1, options.concurrency ?? VIDEO_BATCH_CONCURRENCY)
  let cursor = 0
  let completed = 0

  const worker = async () => {
    while (cursor < total) {
      const index = cursor
      cursor += 1
      const nodeId = options.nodeIds[index]
      if (!nodeId) continue
      await options.runShot(nodeId, index)
      completed += 1
      options.onProgress?.(completed, total)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, total) }, () => worker()))
}
