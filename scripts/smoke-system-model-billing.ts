/**
 * C5 系统模型计费联调冒烟（纯逻辑，无需 Electron / 真实 API）
 *
 * Phase 5.1：T1–T8 客户端计费矩阵 → npm run smoke:billing
 * Phase 5.2：生产 API probe → npm run probe:billing:5.2
 *
 * 用法：npm run smoke:billing
 */
import assert from 'node:assert/strict'

import {
  resolveModelHaodouCost,
  resolveHaodouConsumeQuantity,
} from '@/lib/auth/haodou-consume-service'
import {
  buildVideoBatchBillingLines,
  estimateVideoBatchBilling,
} from '@/lib/auth/billing-display'
import {
  estimateVideoHaodouCostSync,
  formatVideoHaodouPreviewText,
} from '@/lib/auth/video-billing-display'
import { shouldShowVideoCostHint } from '@/hooks/use-video-generation-cost-preview'
import {
  buildVideoProxyTierPayload,
  shouldShowVideoResolutionSelector,
} from '@/lib/models/video-generation-tier-params'
import { formatVideoModelListPriceLabel } from '@/lib/models/video-model-pricing'
import { getVideoModelDisplayTags } from '@/lib/models/video-model-display'
import {
  getBillingPath,
  resolveProjectConsumptionChargeModel,
  shouldChargeHaodou,
  shouldReportInternalProjectConsumption,
} from '@/lib/auth/billing-routing'
import { planGenerationBilling } from '@/lib/auth/billing-matrix'
import { buildModelSelectOptions } from '@/lib/models/model-select-options'
import { mapSystemModelDto, mergeModelsForKind } from '@/lib/models/system-models-service'
import {
  computeHaodouChargeAmount,
  resolveConsumptionBillingQuantity,
  resolveHaodouBillingQuantity,
} from '@/lib/models/system-model-unit-price'
import {
  formatModelUnitPriceLabel,
  resolveConsumptionBillingModel,
} from '@/lib/models/system-model-unit-price-label'
import {
  isInternalSystemModel,
  shouldUseSystemModelProxy,
} from '@/lib/models/system-model-routing'
import { resolveVideoProviderKind } from '@/lib/video/video-provider'
import {
  listWeishiVideoModelOptions,
  resolveWeishiVideoModelOptions,
} from '@/lib/models/weishi-model-catalog'
import type { ModelConfig } from '@/types/settings'

function ok(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`  ✗ ${name}`)
    console.error(`    ${message}`)
    process.exitCode = 1
  }
}

const internalSeedanceDto = {
  model_key: 'sys_internal_seedance_20',
  name: '内部·Seedance 2.0',
  kind: 'video' as const,
  source: 'system' as const,
  api_format: 'weishi_api',
  platform: 'openai_compatible',
  upstream_model: 'seedance-2.0',
  haodou_cost: 0,
  billing_mode: 'internal' as const,
  unit_price: '2.5',
  unit_label: '元/秒',
  config_json: {
    unit_price: '2.5',
    ratios: ['16:9', '9:16'],
    durations: [5, 10],
    resolutions: ['720P'],
  },
  proxy_available: false,
  consumption: {
    billing_enabled: true,
    price: '2.5',
    unit: 'second' as const,
    unit_label: '元/秒',
  },
}

const externalVideoDto = {
  model_key: 'sys_ext_video',
  name: '外部·示例视频',
  kind: 'video' as const,
  source: 'system' as const,
  api_format: 'openai_compatible',
  platform: 'openai_compatible',
  upstream_model: 'cogvideox',
  haodou_cost: 4,
  billing_mode: 'external' as const,
  unit_price: '3.5',
  unit_label: '豆/秒',
  config_json: { unit_price: '3.5' },
  proxy_available: true,
  consumption: null,
}

const tieredExternalVideoDto = {
  model_key: 'sys_ext_video_tiered',
  name: '外部·分档视频',
  kind: 'video' as const,
  source: 'system' as const,
  api_format: 'openai_compatible',
  platform: 'openai_compatible',
  upstream_model: 'cogvideox-hd',
  haodou_cost: 1,
  billing_mode: 'external' as const,
  unit_price: '0.9',
  unit_label: '豆/秒',
  pricing_mode: 'by_resolution' as const,
  pricing_summary: '720P~1080P: 0.9~1.2 豆/秒',
  default_resolution: '720P',
  resolutions: ['720P', '1080P'],
  config_json: {
    unit_price: '0.9',
    price_by_resolution: { '1080P': '1.2' },
  },
  proxy_available: true,
  consumption: null,
}

const externalLlmDto = {
  model_key: 'sys_ext_llm',
  name: '外部·示例 LLM',
  kind: 'llm' as const,
  source: 'system' as const,
  api_format: 'openai_compatible',
  platform: 'openai_compatible',
  upstream_model: 'gpt-4o-mini',
  haodou_cost: 4,
  billing_mode: 'external' as const,
  unit_price: '4',
  unit_label: '豆/次',
  config_json: { unit_price: '4' },
  proxy_available: true,
  consumption: null,
}

const externalImageDto = {
  model_key: 'sys_ext_image',
  name: '外部·示例生图',
  kind: 'image' as const,
  source: 'system' as const,
  api_format: 'openai_compatible',
  platform: 'openai_compatible',
  upstream_model: 'dall-e-3',
  haodou_cost: 4,
  billing_mode: 'external' as const,
  unit_price: '4',
  unit_label: '豆/张',
  config_json: { unit_price: '4' },
  proxy_available: true,
  consumption: null,
}

console.log('C5 smoke — 系统模型计费路由')

ok('DTO 映射 internal Seedance billingMode=internal', () => {
  const model = mapSystemModelDto(internalSeedanceDto)
  assert.equal(model.billingMode, 'internal')
  assert.equal(model.apiFormat, 'weishi_api')
  assert.equal(model.model, 'seedance-2.0')
  assert.equal(model.unitPrice, 2.5)
  assert.equal(model.unitLabel, '元/秒')
  assert.equal(model.consumption?.billing_enabled, true)
  assert.equal(model.haodouCost, undefined)
  assert.match(model.remark || '', /内部 API/)
})

ok('DTO 映射 external 模型带 unitPrice，无 consumption', () => {
  const model = mapSystemModelDto(externalVideoDto)
  assert.equal(model.billingMode, 'external')
  assert.equal(model.unitPrice, 3.5)
  assert.equal(model.unitLabel, '豆/秒')
  assert.equal(model.consumption, undefined)
  assert.equal(model.haodouCost, 4)
})

ok('internal Seedance → video provider weishi（非 system 代理）', () => {
  const model = mapSystemModelDto(internalSeedanceDto)
  assert.equal(resolveVideoProviderKind(model), 'weishi')
})

ok('external 系统视频 → video provider system', () => {
  const model = mapSystemModelDto(externalVideoDto)
  assert.equal(resolveVideoProviderKind(model), 'system')
})

ok('shouldUseSystemModelProxy：internal=false external=true', () => {
  const internal = mapSystemModelDto(internalSeedanceDto)
  const external = mapSystemModelDto(externalVideoDto)
  assert.equal(shouldUseSystemModelProxy(internal), false)
  assert.equal(shouldUseSystemModelProxy(external), true)
})

ok('internal Seedance 视频消耗：单价×秒数', () => {
  const model = mapSystemModelDto(internalSeedanceDto)
  assert.equal(model.consumption?.unit, 'second')
  assert.equal(resolveConsumptionBillingQuantity('video', { durationSec: 10 }), 10)
  assert.equal(model.unitPrice! * 10, 25)
})

ok('external 模型无 consumption 下发', () => {
  const model = mapSystemModelDto(externalVideoDto)
  assert.equal(model.consumption, undefined)
})

ok('unit-price：好豆/消耗数量与金额计算', () => {
  assert.equal(resolveHaodouBillingQuantity('video', { durationSec: 10 }), 10)
  assert.equal(resolveHaodouBillingQuantity('image'), 1)
  assert.equal(resolveConsumptionBillingQuantity('llm'), 1)
  assert.equal(computeHaodouChargeAmount(1.5, 10), 15)
  assert.equal(computeHaodouChargeAmount(0.5, 3), 2)
})

ok('buildImageModelSelectOptions 带 internal/external 色标并排序', () => {
  const internal = mapSystemModelDto(internalSeedanceDto)
  const external = mapSystemModelDto(externalVideoDto)
  const custom: ModelConfig = {
    id: 'custom-1',
    name: '我的模型',
    source: 'custom',
  }
  const options = buildModelSelectOptions([custom, external, internal], 'video')
  assert.equal(options.length, 3)
  assert.equal(options[0].systemBadgeTone, 'internal')
  assert.equal(options[1].systemBadgeTone, 'external')
  assert.equal(options[2].label, '我的模型')
  assert.equal(options[2].systemBadgeTone, undefined)
  assert.equal(options[2].group, '自定义模型')
})

ok('buildImageModelSelectOptions 图片：pricing_summary + group_name 分组', () => {
  const channelOne = mapSystemModelDto({
    ...externalImageDto,
    model_key: 'sys_img_ch1',
    name: 'GPT Image · 渠道一',
    pricing_mode: 'by_resolution',
    pricing_summary: '4K: 3.0 豆/张',
    default_resolution: '1K',
    default_quality: 'medium',
    resolutions: ['1K', '2K', '4K'],
    group_name: 'gpt-image-2',
    description: '渠道一',
  })
  const channelTwo = mapSystemModelDto({
    ...externalImageDto,
    model_key: 'sys_img_ch2',
    name: 'GPT Image · 渠道二',
    pricing_mode: 'by_resolution',
    pricing_summary: '4K: 3.0 豆/张',
    default_resolution: '1K',
    default_quality: 'medium',
    resolutions: ['1K', '2K', '4K'],
    group_name: 'gpt-image-2',
    description: '渠道二',
  })
  const custom: ModelConfig = { id: 'custom-img', name: '自建生图', source: 'custom' }
  const options = buildModelSelectOptions([channelOne, channelTwo, custom], 'image')
  assert.equal(options.length, 3)
  assert.equal(options[0].group, 'gpt-image-2')
  assert.ok(options.some((item) => item.label === 'GPT Image · 渠道一'))
  assert.ok(options.some((item) => item.suffix?.includes('4K: 3.0 豆/张')))
  assert.equal(options[0].systemBadgeTone, 'external')
  assert.equal(options[2].group, '自定义模型')
})

ok('微视 Model 下拉：从系统模型 catalog 解析 upstream_model', () => {
  const internal = mapSystemModelDto(internalSeedanceDto)
  const fastDto = {
    ...internalSeedanceDto,
    model_key: 'sys_internal_seedance_20_fast',
    name: '内部·Seedance 2.0 Fast',
    upstream_model: 'seedance-2.0-fast',
  }
  const fast = mapSystemModelDto(fastDto)
  const external = mapSystemModelDto(externalVideoDto)
  const options = listWeishiVideoModelOptions([external, internal, fast])
  assert.deepEqual(
    options.map((item) => item.modelId),
    ['seedance-2.0', 'seedance-2.0-fast'],
  )
  assert.equal(options[0].label, 'Seedance 2.0')
  assert.equal(options[1].label, 'Seedance 2.0 Fast')
})

ok('微视 Model 下拉：无后台数据时回退本地默认', () => {
  // smoke 脚本无登录 Session，走离线兜底
  const options = resolveWeishiVideoModelOptions([])
  assert.equal(options.length, 2)
  assert.equal(options[0].modelId, 'seedance-2.0')
})

ok('微视 Model 下拉：登录态无 weishi 模型时不回退硬编码', () => {
  // 模拟真实登录：需 mock store；此处只验证 catalog 筛选逻辑
  const external = mapSystemModelDto(externalVideoDto)
  assert.equal(listWeishiVideoModelOptions([external]).length, 0)
})

ok('mergeModelsForKind(video)：系统模型仅保留外部 API', () => {
  const internal = mapSystemModelDto(internalSeedanceDto)
  const external = mapSystemModelDto(externalVideoDto)
  const custom: ModelConfig = {
    id: 'custom-weishi',
    name: '微视API',
    source: 'custom',
    apiFormat: 'weishi_api',
  }
  const merged = mergeModelsForKind(
    'video',
    [custom],
    { llm: [], image: [], video: [internal, external] },
  )
  assert.equal(merged.length, 2)
  assert.equal(merged[0].id, external.id)
  assert.equal(merged[1].id, custom.id)
  assert.equal(merged.some((m) => isInternalSystemModel(m)), false)
})

ok('resolveConsumptionBillingModel：自定义微视匹配 internal 系统模型', () => {
  const internal = mapSystemModelDto(internalSeedanceDto)
  const custom: ModelConfig = {
    id: 'custom-weishi',
    name: '微视API',
    source: 'custom',
    apiFormat: 'weishi_api',
    model: 'seedance-2.0',
  }
  const billing = resolveConsumptionBillingModel(custom, [internal])
  assert.ok(billing)
  assert.equal(billing?.modelKey, internal.modelKey)
})

ok('formatModelUnitPriceLabel：internal 系统模型单价文案', () => {
  const internal = mapSystemModelDto(internalSeedanceDto)
  // 无登录 Session 时不展示
  assert.equal(formatModelUnitPriceLabel(internal, [internal]), null)
})

ok('Phase1 billing-routing：internal → project，external → haodou', () => {
  const internal = mapSystemModelDto(internalSeedanceDto)
  const external = mapSystemModelDto(externalVideoDto)
  const custom: ModelConfig = {
    id: 'custom-weishi',
    name: '微视API',
    source: 'custom',
    apiFormat: 'weishi_api',
  }

  assert.equal(shouldReportInternalProjectConsumption(internal), true)
  assert.equal(shouldReportInternalProjectConsumption(external), false)
  assert.equal(shouldReportInternalProjectConsumption(custom), false)

  assert.equal(shouldChargeHaodou(external), true)
  assert.equal(shouldChargeHaodou(internal), false)
  assert.equal(shouldChargeHaodou(custom), false)

  assert.equal(getBillingPath(internal), 'project')
  assert.equal(getBillingPath(external), 'haodou')
  assert.equal(getBillingPath(custom), 'none')
})

ok('Phase1 billing-routing：internal 无 consumption 时不记项目统计', () => {
  const fastDto = {
    ...internalSeedanceDto,
    model_key: 'sys_internal_seedance_20_fast',
    consumption: null,
  }
  const fast = mapSystemModelDto(fastDto)
  assert.equal(shouldReportInternalProjectConsumption(fast), false)
  assert.equal(getBillingPath(fast), 'none')
})

ok('Phase2 haodou：external 模型单价与视频秒数', () => {
  const external = mapSystemModelDto(externalVideoDto)
  assert.equal(resolveModelHaodouCost(external, 'llm'), 4)
  assert.equal(resolveModelHaodouCost(external, 'image'), 4)
  assert.equal(resolveModelHaodouCost(external, 'video', { durationSec: 10 }), 35)
  assert.equal(resolveHaodouConsumeQuantity('video', { durationSec: 10 }), 10)
  assert.equal(resolveModelHaodouCost(external, 'video', { durationSec: 0 }), 0)
})

ok('Phase2 haodou：internal / 自定义不扣豆', () => {
  const internal = mapSystemModelDto(internalSeedanceDto)
  const custom: ModelConfig = {
    id: 'custom-1',
    name: '我的模型',
    source: 'custom',
  }
  assert.equal(resolveModelHaodouCost(internal, 'video', { durationSec: 5 }), 0)
  assert.equal(resolveModelHaodouCost(custom, 'image'), 0)
  assert.equal(shouldChargeHaodou(internal), false)
})

ok('Phase3：自定义微视映射 internal catalog 用于项目 charge', () => {
  const internal = mapSystemModelDto(internalSeedanceDto)
  const custom: ModelConfig = {
    id: 'custom-weishi',
    name: '微视API',
    source: 'custom',
    apiFormat: 'weishi_api',
    model: 'seedance-2.0',
  }
  const charge = resolveProjectConsumptionChargeModel(custom, [internal])
  assert.ok(charge)
  assert.equal(charge?.modelKey, internal.modelKey)
  assert.equal(getBillingPath(custom, [internal]), 'project')
})

ok('Phase3：upstream 无匹配且无 consumption 时不 charge', () => {
  const fastDto = {
    ...internalSeedanceDto,
    model_key: 'sys_internal_seedance_20_fast',
    consumption: null,
  }
  const fast = mapSystemModelDto(fastDto)
  const custom: ModelConfig = {
    id: 'custom-fast',
    name: '微视API Fast',
    source: 'custom',
    apiFormat: 'weishi_api',
    model: 'seedance-2.0-fast',
  }
  assert.equal(resolveProjectConsumptionChargeModel(custom, [fast]), null)
  assert.equal(getBillingPath(custom, [fast]), 'none')
})

ok('Phase4 billing-display：external 视频好豆文案含 /秒', () => {
  const external = mapSystemModelDto(externalVideoDto)
  const estimate = estimateVideoBatchBilling({
    videoModel: external,
    shotCount: 3,
    durationSec: 10,
  })
  assert.equal(estimate.billingPath, 'haodou')
  assert.equal(estimate.totalHaodou, 105)
  const lines = buildVideoBatchBillingLines(estimate)
  assert.equal(lines.length, 1)
  assert.equal(lines[0]?.kind, 'haodou')
  assert.match(lines[0]?.text ?? '', /好豆\/秒 × 10秒/)
  assert.match(lines[0]?.text ?? '', /× 3镜/)
})

ok('Phase4 billing-display：自定义微视项目消耗文案', () => {
  const internal = mapSystemModelDto(internalSeedanceDto)
  const custom: ModelConfig = {
    id: 'custom-weishi',
    name: '微视API',
    source: 'custom',
    apiFormat: 'weishi_api',
    model: 'seedance-2.0',
  }
  const estimate = estimateVideoBatchBilling({
    videoModel: custom,
    shotCount: 2,
    durationSec: 5,
    systemCatalog: [internal],
  })
  assert.equal(estimate.billingPath, 'project')
  const lines = buildVideoBatchBillingLines(estimate)
  assert.ok(lines.length >= 1)
  const text = lines.map((line) => line.text).join(' ')
  assert.ok(text.includes('项目消耗') || text.includes('内部计费'))
})

ok('Phase4b video-pricing：tiered DTO 映射 videoPricing', () => {
  const tiered = mapSystemModelDto(tieredExternalVideoDto)
  assert.equal(tiered.videoPricing?.pricingMode, 'by_resolution')
  assert.deepEqual(tiered.videoPricing?.resolutions, ['720P', '1080P'])
  assert.equal(tiered.videoPricing?.defaultResolution, '720P')
  assert.equal(formatVideoModelListPriceLabel(tiered), '720P~1080P: 0.9~1.2 豆/秒')
})

ok('Phase4b video-pricing：分辨率选择器与代理 payload', () => {
  const tiered = mapSystemModelDto(tieredExternalVideoDto)
  const flat = mapSystemModelDto(externalVideoDto)
  assert.equal(shouldShowVideoResolutionSelector(tiered), true)
  assert.equal(shouldShowVideoResolutionSelector(flat), false)
  const payload = buildVideoProxyTierPayload(tiered, { resolution: '1080P' })
  assert.equal(payload.resolution, '1080P')
  const defaultPayload = buildVideoProxyTierPayload(tiered, {})
  assert.equal(defaultPayload.resolution, '720P')
})

ok('Phase4b video-pricing：默认档费用预览 sync', () => {
  const tiered = mapSystemModelDto(tieredExternalVideoDto)
  assert.equal(shouldShowVideoCostHint(tiered), true)
  const estimate = estimateVideoHaodouCostSync({
    model: tiered,
    resolution: '720P',
    durationSec: 10,
  })
  assert.equal(estimate.haodouCost, 9)
  assert.match(formatVideoHaodouPreviewText(estimate) ?? '', /预计 9 好豆/)
  const premiumSync = estimateVideoHaodouCostSync({
    model: tiered,
    resolution: '1080P',
    durationSec: 10,
  })
  assert.equal(formatVideoHaodouPreviewText(premiumSync), null)
})

ok('Phase4b video-pricing：分档批量计费默认档', () => {
  const tiered = mapSystemModelDto(tieredExternalVideoDto)
  const sync = estimateVideoBatchBilling({
    videoModel: tiered,
    shotCount: 2,
    durationSec: 10,
    resolution: '720P',
    systemCatalog: [],
  })
  assert.equal(sync.perShotHaodou, 9)
  assert.equal(sync.totalHaodou, 18)
  const lines = buildVideoBatchBillingLines(sync)
  assert.equal(lines[0]?.kind, 'haodou')
  assert.match(lines[0]?.text ?? '', /18 好豆/)
})

ok('Phase4b video-pricing：设置页标签含分辨率能力', () => {
  const tiered = mapSystemModelDto(tieredExternalVideoDto)
  const tags = getVideoModelDisplayTags(tiered)
  assert.ok(tags.some((tag) => tag.includes('720') || tag.includes('1080')))
})

ok('Phase5 matrix T1：外部用户 + external LLM → 仅好豆', () => {
  const externalLlm = mapSystemModelDto(externalLlmDto)
  const plan = planGenerationBilling(externalLlm, {
    isLoggedIn: true,
    isInternalEmployee: false,
  })
  assert.equal(plan.billingPath, 'haodou')
  assert.equal(plan.willConsumeHaodou, true)
  assert.equal(plan.willReportProjectConsumption, false)
})

ok('Phase5 matrix T2：内部 + external LLM → 仅好豆', () => {
  const externalLlm = mapSystemModelDto(externalLlmDto)
  const plan = planGenerationBilling(externalLlm, {
    isLoggedIn: true,
    isInternalEmployee: true,

  })
  assert.equal(plan.willConsumeHaodou, true)
  assert.equal(plan.willReportProjectConsumption, false)
})

ok('Phase5 matrix T3：内部 + 自定义微视 → 项目路径但不客户端上报', () => {
  const internal = mapSystemModelDto(internalSeedanceDto)
  const custom: ModelConfig = {
    id: 'custom-weishi',
    name: '微视API',
    source: 'custom',
    apiFormat: 'weishi_api',
    model: 'seedance-2.0',
  }
  const plan = planGenerationBilling(
    custom,
    { isLoggedIn: true, isInternalEmployee: true },
    { systemCatalog: [internal] },
  )
  assert.equal(plan.billingPath, 'project')
  assert.equal(plan.willConsumeHaodou, false)
  assert.equal(plan.willReportProjectConsumption, false)
  assert.equal(plan.projectChargeModelKey, internal.modelKey)
})

ok('Phase5 matrix T4：内部 + internal Seedance → 项目路径但不客户端上报', () => {
  const internal = mapSystemModelDto(internalSeedanceDto)
  const plan = planGenerationBilling(
    internal,
    { isLoggedIn: true, isInternalEmployee: true },
    { systemCatalog: [internal] },
  )
  assert.equal(plan.willConsumeHaodou, false)
  assert.equal(plan.willReportProjectConsumption, false)
  assert.equal(plan.projectChargeModelKey, 'sys_internal_seedance_20')
})

ok('Phase5 matrix T5：Fast 无 consumption → 项目 skip', () => {
  const fastDto = {
    ...internalSeedanceDto,
    model_key: 'sys_internal_seedance_20_fast',
    consumption: null,
  }
  const fast = mapSystemModelDto(fastDto)
  const custom: ModelConfig = {
    id: 'custom-fast',
    name: '微视API Fast',
    source: 'custom',
    apiFormat: 'weishi_api',
    model: 'seedance-2.0-fast',
  }
  const plan = planGenerationBilling(
    custom,
    { isLoggedIn: true, isInternalEmployee: true },
    { systemCatalog: [fast] },
  )
  assert.equal(plan.billingPath, 'none')
  assert.equal(plan.willReportProjectConsumption, false)
})

ok('Phase5 matrix T6：自定义 OpenAI → 不计费', () => {
  const custom: ModelConfig = {
    id: 'custom-openai',
    name: '我的 GPT',
    source: 'custom',
    apiFormat: 'openai_compatible',
  }
  const plan = planGenerationBilling(custom, {
    isLoggedIn: true,
    isInternalEmployee: true,
  })
  assert.equal(plan.billingPath, 'none')
  assert.equal(plan.willConsumeHaodou, false)
  assert.equal(plan.willReportProjectConsumption, false)
})

ok('Phase5 matrix T7：未登录 + external → 不扣好豆', () => {
  const externalLlm = mapSystemModelDto(externalLlmDto)
  const plan = planGenerationBilling(externalLlm, {
    isLoggedIn: false,
    isInternalEmployee: false,
  })
  assert.equal(plan.billingPath, 'haodou')
  assert.equal(plan.willConsumeHaodou, false)
})

ok('Phase5 matrix T8：内部 + external 生图 → 仅好豆', () => {
  const externalImage = mapSystemModelDto(externalImageDto)
  const plan = planGenerationBilling(externalImage, {
    isLoggedIn: true,
    isInternalEmployee: true,
  })
  assert.equal(plan.willConsumeHaodou, true)
  assert.equal(plan.willReportProjectConsumption, false)
})

ok('Phase5 matrix：好豆与项目统计互斥', () => {
  const internal = mapSystemModelDto(internalSeedanceDto)
  const externalLlm = mapSystemModelDto(externalLlmDto)
  const custom: ModelConfig = {
    id: 'custom-weishi',
    name: '微视API',
    source: 'custom',
    apiFormat: 'weishi_api',
    model: 'seedance-2.0',
  }
  const ctx = { isLoggedIn: true, isInternalEmployee: true }
  for (const plan of [
    planGenerationBilling(externalLlm, ctx),
    planGenerationBilling(custom, ctx, { systemCatalog: [internal] }),
    planGenerationBilling(internal, ctx, { systemCatalog: [internal] }),
  ]) {
    assert.notEqual(plan.willConsumeHaodou && plan.willReportProjectConsumption, true)
  }
})

if (process.exitCode) {
  console.error('\nC5 smoke 失败')
  process.exit(process.exitCode)
}

console.log('\nC5 smoke 全部通过（Phase 5.1 客户端矩阵 T1–T8）')
console.log('Phase 5.2 API 场景: npm run probe:billing:5.2')
console.log('Phase 5.3 HTTP 调用: npm run probe:billing:5.3')
console.log('全自动验收: npm run verify:billing')
