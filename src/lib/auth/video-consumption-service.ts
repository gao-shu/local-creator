// Copyright (c) local-creator contributors. All rights reserved.

/** @deprecated 客户端已移除组织项目消耗上报 */
export async function chargeVideoConsumptionForTask(_options: {
  taskId: string
  durationSec: number
  model: unknown
  resolution?: string | null
  provider?: string
  apiBase?: string
  systemCatalog?: unknown[]
}): Promise<boolean> {
  return false
}

/** @deprecated 客户端已移除组织项目消耗上报 */
export async function reverseVideoConsumptionForTask(_options: {
  taskId: string
  apiBase?: string
}): Promise<void> {}
