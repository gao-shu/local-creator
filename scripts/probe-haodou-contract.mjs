/**
 * Phase 5.2：好豆 API 契约探测（无 external 模型时仍可跑）
 *
 * 完整 T 对照表请用: npm run probe:billing:scenarios
 *
 * 用法: npm run probe:haodou:contract
 */
import { createProbeApi } from './lib/probe-api.mjs'

const { api, apiBase } = createProbeApi()

async function registerUser(prefix) {
  const username = `${prefix}_${Date.now().toString(36)}`
  const reg = await api('/client/auth/register', {
    method: 'POST',
    body: { username, password: 'password123' },
  })
  if (reg.json?.code !== 0 || !reg.json?.data?.access_token) {
    throw new Error(`register failed: ${JSON.stringify(reg.json)}`)
  }
  return { token: reg.json.data.access_token, username }
}

async function consume(token, body) {
  return api('/client/haodou/consume', { method: 'POST', token, body })
}

async function main() {
  console.log(`\n=== Phase 5.2 haodou contract @ ${apiBase} ===\n`)

  const { token, username } = await registerUser('probe_hdc')
  console.log(`registered ${username}`)

  const invalid = await consume(token, {
    model_key: 'nonexistent_model_key_probe',
    reason: 'consume_script',
    quantity: 1,
  })
  if (invalid.json?.code === 0) {
    console.error('✗ invalid model_key should not succeed:', JSON.stringify(invalid.json))
    process.exit(1)
  }
  console.log('✓ invalid model_key rejected:', {
    code: invalid.json?.code,
    message: invalid.json?.message,
  })

  const models = await api('/client/models', { token })
  const list = models.json?.data?.list ?? models.json?.data ?? []
  const internal = list.find((m) => m.billing_mode === 'internal' && m.model_key)

  if (internal) {
    const internalConsume = await consume(token, {
      model_key: internal.model_key,
      reason: 'consume_video',
      quantity: 5,
    })
    const consumed = Number(internalConsume.json?.data?.consumed ?? NaN)
    if (internalConsume.json?.code === 0 && consumed === 0) {
      console.log('✓ internal model consume → consumed=0 (不走好豆):', internal.model_key)
    } else if (internalConsume.json?.code !== 0) {
      console.log('✓ internal model consume rejected (expected):', {
        model_key: internal.model_key,
        code: internalConsume.json?.code,
        message: internalConsume.json?.message,
      })
    } else {
      console.error('✗ internal model should not charge haodou:', JSON.stringify(internalConsume.json))
      process.exit(1)
    }
  } else {
    console.log('⚠ no internal model in catalog; skip internal consume check')
  }

  const refundZero = await api('/client/haodou/refund', {
    method: 'POST',
    token,
    body: { amount: 0, reason: 'refund_failed' },
  })
  if (refundZero.json?.code === 0) {
    console.log('✓ refund amount=0 accepted (no-op)')
  } else if (refundZero.status >= 400 || refundZero.json?.code != null) {
    console.log('✓ refund amount=0 rejected:', {
      http: refundZero.status,
      code: refundZero.json?.code,
      message: refundZero.json?.message,
    })
  } else {
    console.log('✓ refund amount=0 non-success response:', {
      http: refundZero.status,
      body: refundZero.json,
    })
  }

  console.log('\n=== Phase 5.2 haodou contract 完成 ===')
  console.log('T 矩阵对照: npm run probe:billing:scenarios')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
