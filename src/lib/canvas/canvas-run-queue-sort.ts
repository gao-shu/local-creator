// Copyright (c) Haode AI. All rights reserved.

import type { Node } from '@xyflow/react'

function readQueueActivityAt(node: Node): number {
  const data = (node.data ?? {}) as {
    statusUpdatedAt?: number
    remoteJob?: { createdAt?: number }
  }
  return Number(data.statusUpdatedAt) || Number(data.remoteJob?.createdAt) || 0
}

/**
 * 运行队列排序（纯时间）：
 * 1. 最近活动时间倒序（statusUpdatedAt，缺省则 remoteJob.createdAt）
 * 2. 画布位置 y → x
 * 3. id
 *
 * 同一镜头再生成会更新该节点时间并顶到前面；不按状态分区，避免「失败后再跑」看起来像被状态规则挪位/覆盖错觉。
 */
export function compareCanvasRunQueueNodes(a: Node, b: Node): number {
  const timeDiff = readQueueActivityAt(b) - readQueueActivityAt(a)
  if (timeDiff !== 0) return timeDiff

  const yDiff = a.position.y - b.position.y
  if (yDiff !== 0) return yDiff
  const xDiff = a.position.x - b.position.x
  if (xDiff !== 0) return xDiff
  return a.id.localeCompare(b.id)
}

export function sortCanvasRunQueueNodes(nodes: Node[]): Node[] {
  return [...nodes].sort(compareCanvasRunQueueNodes)
}
