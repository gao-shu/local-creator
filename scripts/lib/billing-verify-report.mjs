/**
 * 计费全自动验收最终报告（Layer A/B/C + T1–T8 汇总）
 */
import { isProbeStrict } from './probe-scenario-report.mjs'

/** @typedef {'pass' | 'fail' | 'skip' | 'warn' | 'delegate'} ScenarioStatus */

/**
 * @param {ScenarioStatus[]} statuses
 */
export function rollupStatuses(statuses) {
  if (!statuses.length) return '—'
  if (statuses.includes('fail')) return 'FAIL'
  const strict = isProbeStrict()
  if (strict && (statuses.includes('skip') || statuses.includes('warn'))) return 'BLOCKED'
  if (statuses.every((s) => s === 'pass' || s === 'delegate')) return 'PASS'
  if (statuses.includes('pass') || statuses.includes('delegate')) {
    return statuses.includes('skip') ? 'PARTIAL(skip)' : 'PASS'
  }
  if (statuses.every((s) => s === 'skip')) return 'SKIP'
  if (statuses.includes('warn')) return 'WARN'
  return 'PARTIAL'
}

const MATRIX_GROUPS = [
  { matrix: 'T1', ids: ['gate-ext-video', 'T1-api-consume'], note: '外部+external' },
  { matrix: 'T2', ids: ['T2-api-consume'], note: '内部+external 仅好豆' },
  { matrix: 'T3', ids: ['T3-api-charge', 'contract-internal-zero'], note: '微视→项目统计' },
  { matrix: 'T4', ids: ['T3-api-charge'], note: 'internal catalog' },
  { matrix: 'T5', ids: ['T5-api-fast-skip', 'config-models-audit'], note: 'Fast consumption' },
  { matrix: 'T6', ids: ['T6-client-openai'], note: '自定义 OpenAI' },
  { matrix: 'T6b', ids: ['T6b-client-no-org'], note: '无 orgProjectId' },
  { matrix: 'T7', ids: ['T7-api-no-auth'], note: '未登录' },
  { matrix: 'T8', ids: ['T8-api-consume-image'], note: 'external 生图' },
  { matrix: 'HTTP', ids: ['T1-T8-http-order'], note: 'consume 在 proxy 前' },
]

/**
 * @param {Array<{ id: string, status: ScenarioStatus }>} rows
 */
export function buildMatrixRollup(rows) {
  return MATRIX_GROUPS.map((group) => {
    const matched = rows.filter((row) => group.ids.includes(row.id))
    const statuses = matched.map((r) => r.status)
    let rollup = rollupStatuses(statuses)
    if (rollup === 'PASS' && group.matrix !== 'HTTP' && statuses.every((s) => s === 'delegate')) {
      rollup = 'PASS(client)'
    }
    return { matrix: group.matrix, rollup, note: group.note, statuses }
  })
}

/**
 * @param {object} options
 * @param {boolean} options.layerA
 * @param {boolean} options.layerB
 * @param {boolean} options.layerC
 * @param {Array<{ id: string, matrix: string, layer: string, status: ScenarioStatus, detail: string }>} [options.scenarioRows]
 * @param {string} [options.apiBase]
 */
export function printBillingVerifyReport(options) {
  const strict = isProbeStrict()
  const { layerA, layerB, layerC, scenarioRows = [], apiBase } = options

  const allLayersOk = layerA && layerB && layerC
  const scenarioBlockers = scenarioRows.filter((row) => {
    if (row.status === 'fail') return true
    if (strict && (row.status === 'skip' || row.status === 'warn')) return true
    return false
  })

  const overallPass = allLayersOk && scenarioBlockers.length === 0
  const verdict = overallPass ? 'PASS' : 'FAIL'

  console.log('\n══════════════════════════════════════════════════════')
  console.log(`  BILLING VERIFY: ${verdict}  (PROBE_STRICT=${strict ? 'on' : 'off'})`)
  console.log('══════════════════════════════════════════════════════')
  console.log(`  Layer A  5.1  逻辑矩阵 (smoke:billing)          ${layerA ? '✓' : '✗'}`)
  console.log(`  Layer B  5.2  API 场景 (models + scenarios)       ${layerB ? '✓' : '✗'}`)
  console.log(`  Layer C  5.3  HTTP 调用 (smoke:billing:calls)    ${layerC ? '✓' : '✗'}`)
  if (apiBase) console.log(`  API_BASE: ${apiBase}`)

  if (scenarioRows.length) {
    const pass = scenarioRows.filter((r) => r.status === 'pass').length
    const skip = scenarioRows.filter((r) => r.status === 'skip').length
    const warn = scenarioRows.filter((r) => r.status === 'warn').length
    const delegate = scenarioRows.filter((r) => r.status === 'delegate').length
    console.log(`  API 场景: pass=${pass} skip=${skip} warn=${warn} delegate=${delegate}`)

    console.log('\n  ── T1–T8 跨层汇总 (API + client delegate) ──')
    for (const row of buildMatrixRollup(scenarioRows)) {
      console.log(`    ${row.matrix.padEnd(5)} ${row.rollup.padEnd(16)} ${row.note}`)
    }
  }

  const adminHints = []
  if (scenarioRows.some((r) => r.id === 'T1-api-consume' && r.status === 'skip')) {
    adminHints.push('配置 external 模型 (haodou_cost>0) → T1/T2/T8 API 全绿')
  }
  if (scenarioRows.some((r) => r.id === 'T3-api-charge' && r.status === 'skip')) {
    adminHints.push('注入 PROBE_INTERNAL_TOKEN + PROBE_ORG_PROJECT_ID → T3/T4 charge E2E')
  }
  if (scenarioRows.some((r) => r.id === 'config-models-audit' && r.status === 'warn')) {
    adminHints.push('为 sys_internal_seedance_20_fast 补 consumption → T5 去 WARN')
  }

  if (adminHints.length && !strict) {
    console.log('\n  Admin / CI 可选（当前 strict=off，SKIP/WARN 不阻断）:')
    for (const hint of adminHints) console.log(`    · ${hint}`)
  }

  if (scenarioBlockers.length) {
    console.log('\n  ✗ 阻断项:')
    for (const row of scenarioBlockers) {
      console.log(`    - ${row.id} (${row.matrix}): ${row.detail}`)
    }
  }

  console.log('\n  命令:')
  console.log('    npm run verify:billing')
  console.log('    PROBE_STRICT=1 PROBE_INTERNAL_TOKEN=... PROBE_ORG_PROJECT_ID=... npm run verify:billing')
  console.log('══════════════════════════════════════════════════════\n')

  return overallPass
}

/**
 * 从 probe-billing-scenarios 子进程 stdout 解析 PROBE_JSON
 * @param {string} stdout
 */
export function parseScenarioJsonFromStdout(stdout) {
  const marker = '__PROBE_JSON__'
  const idx = stdout.indexOf(marker)
  if (idx === -1) return null
  const after = stdout.slice(idx + marker.length)
  const start = after.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let end = -1
  for (let i = start; i < after.length; i += 1) {
    const ch = after[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  if (end === -1) return null

  try {
    const parsed = JSON.parse(after.slice(start, end))
    return parsed.rows ?? null
  } catch {
    return null
  }
}
