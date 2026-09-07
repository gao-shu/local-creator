// Copyright (c) Haode AI. All rights reserved.

import type { CanvasVideoNodeData } from '@/types/canvas-nodes'

/** 将毫秒格式化为「12秒」或「1分05秒」 */
export function formatCanvasGenerationElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  if (minutes <= 0) return `${seconds}秒`
  return `${minutes}分${String(seconds).padStart(2, '0')}秒`
}

/** 解析生视频开始时间：优先节点字段，其次远端任务创建时间 */
export function resolveCanvasVideoGenerationStartedAt(
  data: Pick<CanvasVideoNodeData, 'generationStartedAt' | 'remoteJob'>,
): number | undefined {
  const started = Number(data.generationStartedAt) || 0
  if (started > 0) return started
  const remoteCreated = Number(data.remoteJob?.createdAt) || 0
  if (remoteCreated > 0) return remoteCreated
  return undefined
}

/** 开始生视频时写入的计时字段 */
export function buildCanvasVideoGenerationStartPatch(now = Date.now()): {
  generationStartedAt: number
  generationElapsedMs: undefined
} {
  return {
    generationStartedAt: now,
    generationElapsedMs: undefined,
  }
}

/** 生视频结束时写入最终耗时（可恢复轮询场景也能算） */
export function buildCanvasVideoGenerationElapsedPatch(
  data: Pick<CanvasVideoNodeData, 'generationStartedAt' | 'remoteJob'>,
  now = Date.now(),
): {
  generationStartedAt: number
  generationElapsedMs: number
} {
  const startedAt = resolveCanvasVideoGenerationStartedAt(data) ?? now
  return {
    generationStartedAt: startedAt,
    generationElapsedMs: Math.max(0, now - startedAt),
  }
}
