/**
 * 计费 probe 场景报告（T1–T8 对照 + PROBE_STRICT）
 */
import { rollupStatuses } from './billing-verify-report.mjs'

export { rollupStatuses }

/** PROBE_STRICT=1 时 SKIP/WARN 视为失败 */
export function isProbeStrict() {
  const raw = String(process.env.PROBE_STRICT ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

/**
 * @typedef {'pass' | 'fail' | 'skip' | 'warn' | 'delegate'} ScenarioStatus
 */

/**
 * @typedef {Object} ScenarioRow
 * @property {string} id
 * @property {string} matrix  T1–T8 或 '-'
 * @property {'api' | 'client' | 'config'} layer
 * @property {ScenarioStatus} status
 * @property {string} detail
 */

export class ScenarioReport {
  constructor() {
    /** @type {ScenarioRow[]} */
    this.rows = []
  }

  /**
   * @param {ScenarioRow} row
   */
  record(row) {
    this.rows.push(row)
  }

  pass(id, matrix, layer, detail) {
    this.record({ id, matrix, layer, status: 'pass', detail })
  }

  fail(id, matrix, layer, detail) {
    this.record({ id, matrix, layer, status: 'fail', detail })
  }

  skip(id, matrix, layer, detail) {
    this.record({ id, matrix, layer, status: 'skip', detail })
  }

  warn(id, matrix, layer, detail) {
    this.record({ id, matrix, layer, status: 'warn', detail })
  }

  delegate(id, matrix, detail) {
    this.record({ id, matrix, layer: 'client', status: 'delegate', detail })
  }

  /** @returns {ScenarioRow[]} */
  failingRows() {
    const strict = isProbeStrict()
    return this.rows.filter((row) => {
      if (row.status === 'fail') return true
      if (strict && (row.status === 'skip' || row.status === 'warn')) return true
      return false
    })
  }

  /** 按 Matrix T1–T8 汇总（api + client + config） */
  printMatrixRollup() {
    const groups = [
      { matrix: 'T1', ids: ['gate-ext-video', 'T1-api-consume'], note: '外部+external：好豆+门禁' },
      { matrix: 'T2', ids: ['T2-api-consume'], note: '内部+external：仅好豆' },
      { matrix: 'T3', ids: ['T3-api-charge', 'contract-internal-zero'], note: '内部+微视→项目统计' },
      { matrix: 'T4', ids: ['T3-api-charge'], note: 'internal catalog charge（与 T3 同 API 步骤）' },
      { matrix: 'T5', ids: ['T5-api-fast-skip', 'config-models-audit'], note: 'Fast 无 consumption' },
      { matrix: 'T6', ids: ['T6-client-openai'], note: '自定义 OpenAI 不计费' },
      { matrix: 'T6b', ids: ['T6b-client-no-org'], note: '微视无 orgProjectId' },
      { matrix: 'T7', ids: ['T7-api-no-auth'], note: '未登录不 consume' },
      { matrix: 'T8', ids: ['T8-api-consume-image'], note: 'external 生图 consume_image' },
      { matrix: 'HTTP', ids: ['T1-T8-http-order'], note: 'consume 在 proxy 之前（client）' },
    ]

    console.log('\n=== T1–T8 矩阵汇总 ===\n')
    console.log('| Matrix | Rollup | Layers | Note |')
    console.log('|--------|--------|--------|------|')

    for (const group of groups) {
      const rows = this.rows.filter((row) => group.ids.includes(row.id))
      if (!rows.length) {
        console.log(`| ${group.matrix} | — | — | ${group.note} |`)
        continue
      }
      const rollup = rollupStatuses(rows.map((r) => r.status))
      const layers = [...new Set(rows.map((r) => r.layer))].join('+')
      console.log(`| ${group.matrix} | ${rollup} | ${layers} | ${group.note} |`)
    }
  }

  /** @param {string} [apiBase] */
  printSummary(apiBase = process.env.API_BASE || 'http://8.141.97.65/api') {
    console.log(`\n=== Phase 5.2 API 场景对照 @ ${apiBase} ===\n`)
    console.log('| ID | Matrix | Layer | Status | Detail |')
    console.log('|----|--------|-------|--------|--------|')
    for (const row of this.rows) {
      const detail = String(row.detail).replace(/\|/g, '\\|').replace(/\n/g, ' ')
      console.log(`| ${row.id} | ${row.matrix} | ${row.layer} | ${row.status} | ${detail} |`)
    }

    const passed = this.rows.filter((r) => r.status === 'pass').length
    const failed = this.rows.filter((r) => r.status === 'fail').length
    const skipped = this.rows.filter((r) => r.status === 'skip').length
    const warned = this.rows.filter((r) => r.status === 'warn').length
    const delegated = this.rows.filter((r) => r.status === 'delegate').length

    console.log('\n── 汇总 ──')
    console.log(`  pass: ${passed}  fail: ${failed}  skip: ${skipped}  warn: ${warned}  delegate: ${delegated}`)
    console.log(`  PROBE_STRICT: ${isProbeStrict() ? 'on' : 'off'}`)

    const blockers = this.failingRows()
    if (blockers.length) {
      console.log('\n✗ 未通过场景:')
      for (const row of blockers) {
        console.log(`  - ${row.id} (${row.matrix}): ${row.detail}`)
      }
      return false
    }

    console.log('\n✓ API 场景全部通过（SKIP 在 strict=off 下可接受）')
    return true
  }

  /** @param {string} [apiBase] */
  finalizeExit(apiBase) {
    this.printMatrixRollup()
    const ok = this.printSummary(apiBase)
    if (!ok) process.exit(1)
  }
}

/**
 * JSON 输出（CI 解析）
 * PROBE_JSON=1 时写入 stdout 末行
 */
export function maybePrintJsonReport(report) {
  if (process.env.PROBE_JSON !== '1') return
  console.log('\n__PROBE_JSON__')
  console.log(JSON.stringify({ strict: isProbeStrict(), rows: report.rows }, null, 2))
}
