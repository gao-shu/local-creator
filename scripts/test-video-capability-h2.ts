/**
 * H2 · 计价路径回归：quote / sync 只用 resolution + duration_sec；
 * aspect_ratio / reference_mode 不进计价。
 *
 * 用法：npm run test:video-capability-h2
 */

import assert from 'node:assert/strict'

import { estimateVideoBatchBilling } from '@/lib/auth/billing-display'
import { estimateVideoHaodouCostSync } from '@/lib/auth/video-billing-display'
import {
  buildClientVideoQuoteRequestBody,
  resolveVideoHaodouCostSync,
} from '@/lib/models/video-model-pricing'
import { buildVideoProxyTierPayload } from '@/lib/models/video-generation-tier-params'
import { mapSystemModelDto, type ClientSystemModelDto } from '@/lib/models/system-models-service'

function tieredVideoDto(): ClientSystemModelDto {
  return {
    model_key: 'ext_vid_h2',
    name: 'H2 Tiered',
    kind: 'video',
    source: 'system',
    haodou_cost: 1,
    billing_mode: 'external',
    unit_price: '0.9',
    unit_label: '豆/秒',
    pricing_mode: 'by_resolution',
    pricing_summary: '720P~1080P: 0.9~1.2 豆/秒',
    default_resolution: '720P',
    resolutions: ['720P', '1080P'],
    config_json: { unit_price: '0.9' },
    proxy_available: true,
  }
}

const tiered = mapSystemModelDto(tieredVideoDto())

console.log('[test:video-capability-h2] quote body only includes pricing fields')
{
  const body = buildClientVideoQuoteRequestBody({
    modelKey: 'ext_vid_h2',
    durationSec: 10,
    resolution: '1080P',
  })
  assert.deepEqual(body, {
    model_key: 'ext_vid_h2',
    duration_sec: 10,
    resolution: '1080P',
  })
  assert.equal('aspect_ratio' in body, false)
  assert.equal('aspectRatio' in body, false)
  assert.equal('reference_mode' in body, false)
  assert.equal('referenceMode' in body, false)
  assert.equal('ratio' in body, false)

  const noRes = buildClientVideoQuoteRequestBody({
    modelKey: 'ext_vid_h2',
    durationSec: 5,
  })
  assert.deepEqual(Object.keys(noRes).sort(), ['duration_sec', 'model_key'])
}

console.log('[test:video-capability-h2] duration and resolution affect haodou; capability fields ignored by API')
{
  const base = resolveVideoHaodouCostSync(tiered, {
    durationSec: 10,
    resolution: '720P',
  })
  assert.equal(base, 9)

  const longer = resolveVideoHaodouCostSync(tiered, {
    durationSec: 20,
    resolution: '720P',
  })
  assert.equal(longer, 18)

  // 非默认清晰度 sync 走 quote（返回 0），证实 resolution 参与计价分支
  const premiumSync = resolveVideoHaodouCostSync(tiered, {
    durationSec: 10,
    resolution: '1080P',
  })
  assert.equal(premiumSync, 0)

  // 能力字段不在函数签名中；同 resolution/duration 的 estimate 不受「参数区」影响
  const withExtraContext = estimateVideoHaodouCostSync({
    model: {
      ...tiered,
      // 仅能力：不应出现在计价计算里
      ratios: ['9:16'],
      referenceModes: ['first_last_frame'],
      defaultRatio: '9:16',
      defaultReferenceMode: 'first_last_frame',
    },
    durationSec: 10,
    resolution: '720P',
  })
  assert.equal(withExtraContext.haodouCost, 9)
}

console.log('[test:video-capability-h2] batch billing uses resolution+duration only')
{
  const a = estimateVideoBatchBilling({
    videoModel: tiered,
    shotCount: 2,
    durationSec: 10,
    resolution: '720P',
    systemCatalog: [],
  })
  const b = estimateVideoBatchBilling({
    videoModel: {
      ...tiered,
      ratios: ['1:1'],
      referenceModes: ['text_to_video'],
    },
    shotCount: 2,
    durationSec: 10,
    resolution: '720P',
    systemCatalog: [],
  })
  assert.equal(a.totalHaodou, b.totalHaodou)
  assert.equal(a.perShotHaodou, 9)
  assert.equal(a.totalHaodou, 18)

  const premium = estimateVideoBatchBilling({
    videoModel: tiered,
    shotCount: 2,
    durationSec: 10,
    resolution: '1080P',
    systemCatalog: [],
  })
  // sync 路径非默认档 haodou 为 null，等待 async quote；仍只看 resolution
  assert.equal(premium.perShotHaodou, null)
  assert.equal(premium.totalHaodou, null)
}

console.log('[test:video-capability-h2] proxy tier payload only carries resolution')
{
  const payload = buildVideoProxyTierPayload(tiered, { resolution: '1080P' })
  assert.deepEqual(Object.keys(payload), ['resolution'])
  assert.equal(payload.resolution, '1080P')
  assert.equal('aspectRatio' in payload, false)
  assert.equal('referenceMode' in payload, false)
  assert.equal('durationSec' in payload, false)
}

console.log('[test:video-capability-h2] all passed')
