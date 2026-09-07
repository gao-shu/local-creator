/**
 * Phase 5：探测 POST /client/haodou/consume 与 refund
 *
 * 用法:
 *   npm run probe:haodou
 *   API_BASE=http://8.141.97.65/api npm run probe:haodou
 *   PROBE_REFUND=0 npm run probe:haodou          # 扣豆后不退还
 *   PROBE_INSUFFICIENT=1 npm run probe:haodou    # 额外验证 1070 余额不足
 *   PROBE_TOKEN=eyJ... npm run probe:haodou      # 使用已有账号（跳过注册）
 */
import { createProbeApi } from './lib/probe-api.mjs'
import { isProbeStrict } from './lib/probe-scenario-report.mjs'

const { api, apiBase } = createProbeApi()
const shouldRefund = process.env.PROBE_REFUND !== '0'
const testInsufficient = process.env.PROBE_INSUFFICIENT === '1'

function pickExternalBillableModel(list) {
  return list.find(
    (item) =>
      item.billing_mode !== 'internal' &&
      item.proxy_available !== false &&
      Number(item.haodou_cost) > 0 &&
      String(item.model_key || '').trim(),
  )
}

function reasonForKind(kind) {
  if (kind === 'image') return 'consume_image'
  if (kind === 'video') return 'consume_video'
  return 'consume_script'
}

async function registerProbeUser() {
  const suffix = Date.now().toString(36)
  const username = `probe_hd_${suffix}`
  const password = 'password123'
  const reg = await api('/client/auth/register', {
    method: 'POST',
    body: { username, password },
  })
  if (reg.json?.code !== 0 || !reg.json?.data?.access_token) {
    throw new Error(`register failed: ${JSON.stringify(reg.json)}`)
  }
  return {
    token: reg.json.data.access_token,
    username,
    user: reg.json.data.user,
  }
}

async function fetchMe(token) {
  const res = await api('/client/auth/me', { token })
  if (res.json?.code !== 0) {
    throw new Error(`GET /client/auth/me failed: ${JSON.stringify(res.json)}`)
  }
  return res.json.data
}

async function fetchModels(token) {
  const res = await api('/client/models', { token })
  if (res.json?.code !== 0) {
    throw new Error(`GET /client/models failed: ${JSON.stringify(res.json)}`)
  }
  const list = res.json.data?.list ?? res.json.data ?? []
  if (!Array.isArray(list)) {
    throw new Error(`unexpected models payload: ${JSON.stringify(res.json)}`)
  }
  return list
}

async function consumeHaodou(token, { modelKey, reason, quantity }) {
  return api('/client/haodou/consume', {
    method: 'POST',
    token,
    body: {
      model_key: modelKey,
      reason,
      quantity,
    },
  })
}

async function refundHaodou(token, amount) {
  return api('/client/haodou/refund', {
    method: 'POST',
    token,
    body: { amount, reason: 'refund_failed' },
  })
}

async function main() {
  console.log(`\n=== Phase 5 probe: haodou consume @ ${apiBase} ===\n`)

  let token = process.env.PROBE_TOKEN?.trim() || ''
  let username = process.env.PROBE_USERNAME?.trim() || '(existing token)'

  if (!token) {
    const registered = await registerProbeUser()
    token = registered.token
    username = registered.username
    console.log(`registered ${username}`)
  } else {
    console.log(`using PROBE_TOKEN (${username})`)
  }

  const meBefore = await fetchMe(token)
  const balanceBefore = Number(meBefore?.bells ?? meBefore?.remaining_quota ?? 0)
  console.log(`balance before: ${balanceBefore}`)
  console.log(`is_internal: ${Boolean(meBefore?.is_internal)}\n`)

  const models = await fetchModels(token)
  const billable = pickExternalBillableModel(models)

  if (!billable) {
    console.log('⚠ SKIP: 无 external 系统模型（haodou_cost>0 且可代理）')
    console.log('  Admin 需配置 external LLM/生图/视频模型后重试')
    console.log('  可先运行: npm run probe:models')
    process.exit(isProbeStrict() ? 1 : 0)
  }

  console.log('target model:', {
    model_key: billable.model_key,
    name: billable.name,
    kind: billable.kind,
    haodou_cost: billable.haodou_cost,
    billing_mode: billable.billing_mode ?? 'external',
  })

  const reason = reasonForKind(billable.kind)
  const quantity = billable.kind === 'video' ? 5 : 1

  const consumeRes = await consumeHaodou(token, {
    modelKey: billable.model_key,
    reason,
    quantity,
  })

  if (consumeRes.json?.code !== 0) {
    console.error('✗ consume failed:', JSON.stringify(consumeRes.json, null, 2))
    process.exit(1)
  }

  const consumed = Number(consumeRes.json.data?.consumed ?? 0)
  const balanceAfterConsume = Number(consumeRes.json.data?.balance ?? NaN)
  console.log('\n✓ consume ok:', {
    consumed,
    balance: balanceAfterConsume,
    model_key: consumeRes.json.data?.model_key,
  })

  if (consumed <= 0) {
    console.log('⚠ consumed=0（模型可能配置为免费）；跳过后续余额断言')
  } else if (Number.isFinite(balanceAfterConsume) && balanceAfterConsume > balanceBefore) {
    console.error('✗ balance increased after consume (unexpected)')
    process.exit(1)
  }

  const meAfterConsume = await fetchMe(token)
  const meBalance = Number(meAfterConsume?.bells ?? meAfterConsume?.remaining_quota ?? NaN)
  if (consumed > 0 && Number.isFinite(meBalance) && meBalance !== balanceAfterConsume) {
    console.log(`note: /auth/me bells=${meBalance}, consume response balance=${balanceAfterConsume}`)
  }

  if (shouldRefund && consumed > 0) {
    const refundRes = await refundHaodou(token, consumed)
    if (refundRes.json?.code !== 0) {
      console.error('✗ refund failed:', JSON.stringify(refundRes.json, null, 2))
      process.exit(1)
    }
    console.log('\n✓ refund ok:', {
      refunded: refundRes.json.data?.refunded,
      balance: refundRes.json.data?.balance,
    })

    const meAfterRefund = await fetchMe(token)
    const balanceAfterRefund = Number(meAfterRefund?.bells ?? meAfterRefund?.remaining_quota ?? 0)
    if (Math.abs(balanceAfterRefund - balanceBefore) > 0.01) {
      console.log(
        `note: balance after refund ${balanceAfterRefund} != before ${balanceBefore} (新用户赠豆/流水延迟可忽略)`,
      )
    }
  }

  if (testInsufficient) {
    console.log('\n--- PROBE_INSUFFICIENT: 期望 1070 ---')
    const hugeQty = Math.max(1_000_000, balanceBefore + 999_999)
    const failRes = await consumeHaodou(token, {
      modelKey: billable.model_key,
      reason,
      quantity: hugeQty,
    })
    if (failRes.json?.code === 1070) {
      console.log('✓ insufficient balance → code 1070:', failRes.json.message)
    } else {
      console.error('✗ expected code 1070, got:', JSON.stringify(failRes.json, null, 2))
      process.exit(1)
    }
  }

  console.log('\n=== Phase 5 haodou probe 完成 ===')
  console.log('T 矩阵对照: npm run probe:billing:scenarios')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
