// Copyright (c) Haode AI. All rights reserved.

import {
  getBillingPath,
  readSystemVideoCatalog,
  resolveProjectConsumptionChargeModel,
  shouldChargeHaodou,
  type BillingPath,
} from '@/lib/auth/billing-routing'
import type { ModelConfig } from '@/types/settings'

/** 单次生成前的用户上下文（纯数据，便于联调矩阵测试） */
export type GenerationBillingContext = {
  isLoggedIn: boolean
  isInternalEmployee: boolean
}

export type GenerationBillingPlan = {
  billingPath: BillingPath
  /** 是否会调用 POST /client/haodou/consume */
  willConsumeHaodou: boolean
  /** 是否会调用项目消耗 charge（客户端已移除组织项目上报，恒为 false） */
  willReportProjectConsumption: boolean
  /** 项目 charge 使用的 internal model_key；无映射时为 null */
  projectChargeModelKey: string | null
}

/**
 * 规划单次 AI 生成的计费动作（好豆 / 项目统计互斥）。
 * 对齐 Phase 0.5 矩阵 T1–T8，供 smoke 与联调脚本共用。
 */
export function planGenerationBilling(
  model: ModelConfig | null | undefined,
  ctx: GenerationBillingContext,
  options?: { systemCatalog?: ModelConfig[] },
): GenerationBillingPlan {
  const catalog = options?.systemCatalog ?? readSystemVideoCatalog()
  const billingPath = getBillingPath(model, catalog)
  const chargeModel = model ? resolveProjectConsumptionChargeModel(model, catalog) : null

  const willConsumeHaodou =
    billingPath === 'haodou' &&
    ctx.isLoggedIn &&
    shouldChargeHaodou(model) &&
    Boolean(model?.modelKey?.trim())

  const willReportProjectConsumption = false

  return {
    billingPath,
    willConsumeHaodou,
    willReportProjectConsumption,
    projectChargeModelKey: chargeModel?.modelKey?.trim() || null,
  }
}
