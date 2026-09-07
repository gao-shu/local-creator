// Copyright (c) Haode AI. All rights reserved.

import type { HaodouConsumeReason } from '@/lib/auth/haodou-labels'
import {
  consumeHaodouIfNeeded,
  refundHaodou,
  shouldCallHaodouConsume,
} from '@/lib/auth/haodou-consume-service'
import type { ModelConfig, ModelKind } from '@/types/settings'

export type RunWithHaodouConsumeOptions = {
  model: ModelConfig
  kind: ModelKind
  reason?: HaodouConsumeReason
  durationSec?: number
  apiBase?: string
}

/**
 * external 系统模型：先 consume 再执行任务；失败且已扣豆则 refund。
 * internal / 自定义模型：直接执行任务。
 */
export async function runWithHaodouConsume<T>(
  options: RunWithHaodouConsumeOptions,
  task: () => Promise<T>,
): Promise<T> {
  if (!shouldCallHaodouConsume(options.model)) {
    return task()
  }

  let consumed = 0
  try {
    const result = await consumeHaodouIfNeeded({
      model: options.model,
      kind: options.kind,
      reason: options.reason,
      durationSec: options.durationSec,
      apiBase: options.apiBase,
    })
    consumed = result?.consumed ?? 0
    return await task()
  } catch (error) {
    if (consumed > 0) {
      await refundHaodou({ amount: consumed, apiBase: options.apiBase })
    }
    throw error
  }
}
