// Copyright (c) Haode AI. All rights reserved.

import {
  getBillingPath,
  isProjectConsumptionModel,
  readSystemVideoCatalog,
  type BillingPath,
} from '@/lib/auth/billing-routing'
import { canReportProjectConsumption } from '@/lib/auth/consumption-service'
import { resolveModelHaodouCost } from '@/lib/auth/haodou-consume-service'
import { hasPersistedRealToken, isLoginRequired } from '@/lib/auth/login-mode'
import { resolveVideoHaodouCost } from '@/lib/models/video-model-pricing'
import { formatModelUnitPriceLabel } from '@/lib/models/system-model-unit-price-label'
import { isWeishiApiModel } from '@/lib/models/weishi-model-presets'
import { useAuthStore } from '@/stores/auth-store'
import type { ModelConfig } from '@/types/settings'

export type VideoBatchBillingEstimate = {
  billingPath: BillingPath
  modelName: string
  durationSec: number
  shotCount: number
  /** 好豆路径且已登录可扣 */
  consumesHaodou: boolean
  perShotHaodou: number | null
  totalHaodou: number | null
  haodouUnitPerSec: number | null
  /** 项目统计路径且 internal 员工可上报 */
  reportsProjectConsumption: boolean
  projectUnitLabel: string | null
  perShotYuan: number | null
  totalYuan: number | null
}

function parseYuanFromUnitLabel(label: string | null): number | null {
  if (!label) return null
  const price = parseFloat(label.split('/')[0]?.trim() ?? '')
  return Number.isFinite(price) && price > 0 ? price : null
}

/** 估算批量视频生成的计费路径与金额（好豆 / 项目统计） */
export function estimateVideoBatchBilling(options: {
  videoModel: ModelConfig | null | undefined
  shotCount: number
  durationSec?: number
  resolution?: string | null
  /** 不传则从 settings-store 读取系统视频 catalog */
  systemCatalog?: ModelConfig[]
}): VideoBatchBillingEstimate {
  const shotCount = Math.max(0, options.shotCount)
  const durationSec = options.durationSec ?? 5
  const model = options.videoModel
  const modelName = model?.name?.trim() || '当前视频模型'
  const catalog = options.systemCatalog ?? readSystemVideoCatalog()
  const billingPath = getBillingPath(model, catalog)
  const canChargeHaodou =
    isLoginRequired() && hasPersistedRealToken(useAuthStore.getState().token)

  const base: VideoBatchBillingEstimate = {
    billingPath,
    modelName,
    durationSec,
    shotCount,
    consumesHaodou: false,
    perShotHaodou: null,
    totalHaodou: null,
    haodouUnitPerSec: null,
    reportsProjectConsumption: false,
    projectUnitLabel: null,
    perShotYuan: null,
    totalYuan: null,
  }

  if (billingPath === 'haodou' && model) {
    const perShotCost = resolveModelHaodouCost(model, 'video', {
      durationSec,
      resolution: options.resolution,
    })
    const unitPerSec =
      durationSec > 0 && perShotCost > 0
        ? Math.round((perShotCost / durationSec) * 100) / 100
        : resolveModelHaodouCost(model, 'video', {
            durationSec: 1,
            resolution: options.resolution,
          }) || null
    const billable = perShotCost > 0
    return {
      ...base,
      consumesHaodou: billable && canChargeHaodou,
      perShotHaodou: billable ? perShotCost : null,
      totalHaodou: billable ? perShotCost * shotCount : null,
      haodouUnitPerSec: billable ? unitPerSec : null,
    }
  }

  if (billingPath === 'project' && model && isProjectConsumptionModel(model, catalog)) {
    // 微视 API：内部配额模型，画布不展示人民币预估
    if (isWeishiApiModel(model)) {
      return {
        ...base,
        reportsProjectConsumption: false,
        projectUnitLabel: null,
        perShotYuan: null,
        totalYuan: null,
      }
    }
    const unitLabel = formatModelUnitPriceLabel(model, catalog, { skipAuthCheck: true })
    const yuanPerSec = parseYuanFromUnitLabel(unitLabel)
    if (yuanPerSec != null) {
      const perShotYuan = Math.round(yuanPerSec * durationSec * 100) / 100
      const totalYuan = Math.round(perShotYuan * shotCount * 100) / 100
      return {
        ...base,
        reportsProjectConsumption: false,
        projectUnitLabel: unitLabel,
        perShotYuan,
        totalYuan,
      }
    }
    return {
      ...base,
      reportsProjectConsumption: false,
      projectUnitLabel: unitLabel,
    }
  }

  return base
}

/** 异步估算批量视频计费（分档分辨率走 quote） */
export async function estimateVideoBatchBillingAsync(options: {
  videoModel: ModelConfig | null | undefined
  shotCount: number
  durationSec?: number
  resolution?: string | null
  systemCatalog?: ModelConfig[]
  apiBase?: string
}): Promise<VideoBatchBillingEstimate> {
  const shotCount = Math.max(0, options.shotCount)
  const durationSec = options.durationSec ?? 5
  const model = options.videoModel
  const modelName = model?.name?.trim() || '当前视频模型'
  const catalog = options.systemCatalog ?? readSystemVideoCatalog()
  const billingPath = getBillingPath(model, catalog)
  const canChargeHaodou =
    isLoginRequired() && hasPersistedRealToken(useAuthStore.getState().token)

  const base: VideoBatchBillingEstimate = {
    billingPath,
    modelName,
    durationSec,
    shotCount,
    consumesHaodou: false,
    perShotHaodou: null,
    totalHaodou: null,
    haodouUnitPerSec: null,
    reportsProjectConsumption: false,
    projectUnitLabel: null,
    perShotYuan: null,
    totalYuan: null,
  }

  if (billingPath === 'haodou' && model) {
    const perShotCost = await resolveVideoHaodouCost(model, {
      durationSec,
      resolution: options.resolution,
      apiBase: options.apiBase,
    })
    const unitPerSec =
      durationSec > 0 && perShotCost > 0
        ? Math.round((perShotCost / durationSec) * 100) / 100
        : (await resolveVideoHaodouCost(model, {
            durationSec: 1,
            resolution: options.resolution,
            apiBase: options.apiBase,
          })) || null
    const billable = perShotCost > 0
    return {
      ...base,
      consumesHaodou: billable && canChargeHaodou,
      perShotHaodou: billable ? perShotCost : null,
      totalHaodou: billable ? perShotCost * shotCount : null,
      haodouUnitPerSec: billable ? unitPerSec : null,
    }
  }

  return estimateVideoBatchBilling({
    videoModel: model,
    shotCount,
    durationSec,
    resolution: options.resolution,
    systemCatalog: catalog,
  })
}

export type VideoBatchBillingLine = {
  kind: 'haodou' | 'project' | 'info'
  text: string
}

export type VideoBatchBarPreview =
  | {
      kind: 'haodou'
      amount: number
      tooltip: string
    }
  | {
      kind: 'project'
      text: string
    }

/** 画布底部批量栏：计费预览（好豆为数字 + 图标，不含「预计/好豆」文案） */
export function resolveVideoBatchBarPreview(
  estimate: VideoBatchBillingEstimate,
): VideoBatchBarPreview | null {
  const { durationSec, shotCount } = estimate

  if (estimate.billingPath === 'haodou' && estimate.totalHaodou != null && estimate.totalHaodou > 0) {
    const loginHint = estimate.consumesHaodou ? '' : '（登录后扣费）'
    const scope = shotCount > 1 ? `${shotCount}镜 × ${durationSec}秒` : `${durationSec}秒`
    return {
      kind: 'haodou',
      amount: estimate.totalHaodou,
      tooltip: `${scope}${loginHint}`,
    }
  }

  if (estimate.reportsProjectConsumption && estimate.totalYuan != null) {
    const scope = shotCount > 1 ? `${shotCount}镜 × ${durationSec}秒` : `${durationSec}秒`
    return {
      kind: 'project',
      text: `约 ${estimate.totalYuan} 元（${scope}）`,
    }
  }

  return null
}

/** 批量视频确认弹窗用的计费说明行 */
export function buildVideoBatchBillingLines(
  estimate: VideoBatchBillingEstimate,
): VideoBatchBillingLine[] {
  const { durationSec, shotCount, modelName } = estimate

  if (estimate.billingPath === 'haodou' && estimate.totalHaodou != null && estimate.totalHaodou > 0) {
    const loginHint = estimate.consumesHaodou ? '' : '（登录后扣费）'
    const unitPart =
      estimate.haodouUnitPerSec != null
        ? `${estimate.haodouUnitPerSec} 好豆/秒 × ${durationSec}秒`
        : `${estimate.perShotHaodou} 好豆/镜`
    return [
      {
        kind: 'haodou',
        text:
          shotCount === 1
            ? `预计消耗 ${estimate.totalHaodou} 好豆（${modelName} · ${unitPart}）${loginHint}。`
            : `预计消耗 ${estimate.totalHaodou} 好豆（${modelName} · ${unitPart} × ${shotCount}镜）${loginHint}。`,
      },
    ]
  }

  if (estimate.billingPath === 'project') {
    if (!canReportProjectConsumption()) {
      return [
        {
          kind: 'info',
          text: '当前模型为内部计费（项目消耗统计）；外部账号不享受内部配额。',
        },
      ]
    }
    if (estimate.totalYuan != null && estimate.projectUnitLabel) {
      const unitPart = `${estimate.projectUnitLabel} × ${durationSec}秒`
      return [
        {
          kind: 'project',
          text:
            shotCount === 1
              ? `内部配额模型，预估约 ${estimate.totalYuan} 元（${modelName} · ${unitPart}），不扣好豆。`
              : `内部配额模型，预估约 ${estimate.totalYuan} 元（${modelName} · ${unitPart} × ${shotCount}镜），不扣好豆。`,
        },
      ]
    }
    return [
      {
        kind: 'project',
        text: '内部计费模型，按项目消耗统计，不扣好豆。',
      },
    ]
  }

  return [
    {
      kind: 'info',
      text: '当前模型不消耗好豆（自定义或未配置单价）。',
    },
  ]
}
