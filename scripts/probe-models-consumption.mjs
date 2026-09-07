/**
 * Phase 0.3：探测 GET /client/models 中 consumption / billing_mode 配置
 *
 * 用法:
 *   node scripts/probe-models-consumption.mjs
 *   API_BASE=http://8.141.97.65/api node scripts/probe-models-consumption.mjs
 */
const API_BASE = (process.env.API_BASE || 'http://8.141.97.65/api').replace(/\/+$/, '')

async function api(path, { method = 'GET', body, token } = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  return { status: res.status, json }
}

function summarizeModel(item) {
  return {
    model_key: item.model_key,
    name: item.name,
    kind: item.kind,
    billing_mode: item.billing_mode ?? '(missing→external)',
    haodou_cost: item.haodou_cost,
    unit_price: item.unit_price,
    unit_label: item.unit_label,
    proxy_available: item.proxy_available,
    consumption: item.consumption ?? null,
  }
}

function parsePrice(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return 0
  return Math.round(num * 10) / 10
}

function isWeishiApi(item) {
  return String(item.api_format || '').trim().toLowerCase() === 'weishi_api'
}

/** 客户端 shouldReportConsumption 等价：仅看 consumption.billing_enabled */
function clientWouldReportProjectConsumption(item) {
  return item.billing_mode === 'internal' && item.consumption?.billing_enabled === true
}

/** resolveConsumptionBillingModel 等价：billing_enabled 或 internal unit_price>0 */
function clientWouldResolveBillingModel(item) {
  if (item.billing_mode !== 'internal') return false
  const fromConsumption = parsePrice(item.consumption?.price)
  if (item.consumption?.billing_enabled && fromConsumption > 0) return true
  return parsePrice(item.unit_price) > 0
}

function expectedConsumptionUnit(kind) {
  if (kind === 'video') return 'second'
  if (kind === 'image') return 'count'
  return 'call'
}

function classifyIssue(item) {
  const mode = item.billing_mode === 'internal' ? 'internal' : 'external'
  const c = item.consumption
  const issues = []

  if (mode === 'external') {
    if (c?.billing_enabled === true) {
      issues.push('external 但 consumption.billing_enabled=true（应 false 或 null）')
    }
    if (Number(item.haodou_cost) <= 0 && item.proxy_available) {
      issues.push('external 且可代理但 haodou_cost=0')
    }
  }

  if (mode === 'internal') {
    if (Number(item.haodou_cost) > 0) {
      issues.push('internal 但 haodou_cost>0（应走项目统计，不应有好豆定价）')
    }
    if (item.proxy_available === true) {
      issues.push('internal 但 proxy_available=true（internal 不应走系统代理）')
    }

    const priceFromConsumption = parsePrice(c?.price)
    const priceFromUnit = parsePrice(item.unit_price)

    if (!c || c.billing_enabled !== true) {
      issues.push('internal 但 consumption.billing_enabled 未启用 → charge 会被 skip')
    }
    if (c?.billing_enabled === true && priceFromConsumption <= 0) {
      issues.push('internal consumption 已启用但 price<=0 → 项目统计金额为 0')
    }
    if (c?.billing_enabled === true && c.unit !== expectedConsumptionUnit(item.kind)) {
      issues.push(
        `internal consumption.unit=${c.unit ?? '(missing)'}，期望 ${expectedConsumptionUnit(item.kind)}`,
      )
    }
    if (c?.billing_enabled === true && !String(c.unit_label || '').trim()) {
      issues.push('internal consumption.unit_label 为空 → 下拉单价文案不完整')
    }

    if (isWeishiApi(item)) {
      if (!item.upstream_model?.trim()) {
        issues.push('internal 微视缺少 upstream_model → 自定义微视无法按 model 匹配单价')
      }
      if (priceFromUnit > 0 && (!c || c.billing_enabled !== true)) {
        issues.push(
          `仅有 unit_price=${item.unit_price} 但 consumption 未启用 → UI 可能显示单价，但 charge 仍 skip`,
        )
      }
    } else if (item.kind === 'llm' || item.kind === 'image') {
      issues.push('internal 非微视 LLM/生图：客户端当前不支持直连，配置了也无法用')
    }
  }

  return issues
}

function auditInternalModel(item) {
  const c = item.consumption
  return {
    model_key: item.model_key,
    name: item.name,
    kind: item.kind,
    api_format: item.api_format,
    upstream_model: item.upstream_model,
    haodou_cost: item.haodou_cost,
    unit_price: item.unit_price,
    unit_label: item.unit_label,
    proxy_available: item.proxy_available,
    consumption: c ?? null,
    client_charge: clientWouldReportProjectConsumption(item) ? 'YES' : 'NO',
    client_billing_resolve: clientWouldResolveBillingModel(item) ? 'YES' : 'NO',
    issues: classifyIssue(item),
  }
}

async function main() {
  const phase = process.env.PROBE_PHASE || '0.3+0.4'
  console.log(`\n=== Phase ${phase} probe: ${API_BASE} ===\n`)

  const suffix = Date.now().toString(36)
  const username = `probe_${suffix}`
  const password = 'password123'

  const reg = await api('/client/auth/register', {
    method: 'POST',
    body: { username, password },
  })
  if (reg.json?.code !== 0 || !reg.json?.data?.access_token) {
    console.error('register failed:', JSON.stringify(reg.json, null, 2))
    process.exit(1)
  }
  const token = reg.json.data.access_token
  console.log(`registered ${username}\n`)

  const models = await api('/client/models', { token })
  if (models.json?.code !== 0) {
    console.error('GET /client/models failed:', JSON.stringify(models.json, null, 2))
    process.exit(1)
  }

  const list = models.json.data?.list ?? models.json.data ?? []
  if (!Array.isArray(list)) {
    console.error('unexpected models payload:', JSON.stringify(models.json, null, 2))
    process.exit(1)
  }

  console.log(`total models: ${list.length}\n`)

  const byMode = { internal: [], external: [], other: [] }
  const allIssues = []

  for (const raw of list) {
    const item = summarizeModel(raw)
    const mode = raw.billing_mode === 'internal' ? 'internal' : 'external'
    byMode[mode].push(item)
    const issues = classifyIssue(raw)
    if (issues.length) allIssues.push({ ...item, issues })
  }

  for (const mode of ['internal', 'external']) {
    console.log(`--- ${mode} (${byMode[mode].length}) ---`)
    for (const item of byMode[mode]) {
      console.log(JSON.stringify(item, null, 2))
      console.log('')
    }
  }

  const internalAudits = list
    .filter((raw) => raw.billing_mode === 'internal')
    .map(auditInternalModel)

  if (internalAudits.length) {
    console.log('=== Phase 0.4 internal 审计（含客户端 charge 预判）===')
    for (const row of internalAudits) {
      console.log(JSON.stringify(row, null, 2))
      console.log('')
    }

    const weishiInternals = internalAudits.filter((row) => isWeishiApi(row))
    if (weishiInternals.length) {
      console.log('--- 自定义微视 upstream 匹配表 ---')
      for (const row of weishiInternals) {
        const charge = row.client_charge
        const resolve = row.client_billing_resolve
        console.log(
          `  ${row.upstream_model || '(无)'} ← ${row.model_key} | charge=${charge} | billingResolve=${resolve}`,
        )
      }
      console.log('')
    }
  } else {
    console.log('=== Phase 0.4：无 internal 模型 ===\n')
  }

  console.log('=== 配置校验 ===')
  if (!allIssues.length) {
    console.log('✓ 全部模型 billing_mode 与 consumption 配置一致')
  } else {
    console.log(`✗ 发现 ${allIssues.length} 条异常:\n`)
    for (const row of allIssues) {
      console.log(`- ${row.model_key} (${row.kind})`)
      for (const issue of row.issues) console.log(`    · ${issue}`)
    }
  }

  const chargeReady = internalAudits.filter((row) => row.client_charge === 'YES').length
  const chargeGap = internalAudits.length - chargeReady
  console.log('\n=== Phase 0.4 汇总 ===')
  console.log(`internal 总数: ${internalAudits.length}`)
  console.log(`可正常 charge: ${chargeReady}`)
  console.log(`charge 会 skip: ${chargeGap}`)

  console.log('\n=== 期望对照 ===')
  console.log('| billing_mode | consumption | haodou_cost | 计费 |')
  console.log('| internal     | billing_enabled=true, price>0, unit 对齐 kind | 0 | 项目统计 |')
  console.log('| external     | null 或 billing_enabled=false | >0 | 好豆 consume |')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
