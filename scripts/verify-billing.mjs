/**
 * Phase 5 计费全自动验收 — 统一入口（Layer A + B + C）
 *
 * 用法:
 *   npm run verify:billing
 *   npm run probe:billing
 *   PROBE_STRICT=1 npm run verify:billing
 *   PROBE_SKIP_COMPILE=1 npm run verify:billing
 *   PROBE_JSON=1 npm run verify:billing
 *
 * 环境变量:
 *   PROBE_STRICT=1          SKIP/WARN 视为失败
 *   PROBE_SKIP_COMPILE=1    5.1 跳过 compile（仅 smoke:billing）
 *   PROBE_INTERNAL_TOKEN    内部员工 JWT → T2/T3/T4/T8 API E2E
 *   PROBE_ORG_PROJECT_ID    组织项目 UUID → T3/T4 charge/reverse
 *   API_BASE                默认 http://8.141.97.65/api
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import {
  parseScenarioJsonFromStdout,
  printBillingVerifyReport,
} from './lib/billing-verify-report.mjs'
import { normalizeApiBase } from './lib/probe-api.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiBase = normalizeApiBase()
const isWin = process.platform === 'win32'

/** @type {{ label: string, ok: boolean }[]} */
const stepResults = []

function runInherit(label, command, args, env = process.env) {
  console.log(`\n── ${label} ──\n`)
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
    env,
  })
  const ok = result.status === 0
  stepResults.push({ label, ok })
  if (!ok) {
    console.error(`\n✗ ${label} failed (exit ${result.status ?? 'unknown'})`)
  }
  return ok
}

function runCapture(label, command, args, env = process.env) {
  console.log(`\n── ${label} ──\n`)
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: isWin,
    env,
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  const ok = result.status === 0
  stepResults.push({ label, ok })
  if (!ok) {
    console.error(`\n✗ ${label} failed (exit ${result.status ?? 'unknown'})`)
  }
  return { ok, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

function main() {
  console.log('=== Billing 全自动验收 (verify:billing) ===')
  console.log(`  API_BASE=${apiBase}`)
  console.log(`  PROBE_STRICT=${process.env.PROBE_STRICT ?? 'off'}`)
  console.log(`  PROBE_SKIP_COMPILE=${process.env.PROBE_SKIP_COMPILE ?? 'off'}`)
  console.log('')
  console.log('  Layer A  5.1  逻辑矩阵')
  console.log('  Layer B  5.2  models + API scenarios')
  console.log('  Layer C  5.3  HTTP call matrix (mock fetch)')

  let layerA = false
  let layerB = false
  let layerC = false
  /** @type {import('./lib/billing-verify-report.mjs').ScenarioStatus extends never ? never : any[] | null} */
  let scenarioRows = null

  if (process.env.PROBE_SKIP_COMPILE === '1') {
    layerA = runInherit('Layer A — smoke:billing (skip compile)', 'npm', ['run', 'smoke:billing'])
  } else {
    layerA = runInherit('Layer A — compile + smoke:billing', 'npm', ['run', 'probe:billing:5.1'])
  }

  if (layerA) {
    const modelsOk = runInherit('Layer B — probe:models', 'node', ['scripts/probe-models-consumption.mjs'])
    const scenariosEnv = { ...process.env, PROBE_JSON: '1' }
    const scenarios = runCapture('Layer B — probe:billing:scenarios', 'node', [
      'scripts/probe-billing-scenarios.mjs',
    ], scenariosEnv)
    scenarioRows = parseScenarioJsonFromStdout(scenarios.stdout)
    layerB = modelsOk && scenarios.ok
  }

  if (layerA && layerB) {
    layerC = runInherit('Layer C — smoke:billing:calls', 'npm', ['run', 'smoke:billing:calls'])
  }

  const overallOk = printBillingVerifyReport({
    layerA,
    layerB,
    layerC,
    scenarioRows: scenarioRows ?? [],
    apiBase,
  })

  if (process.env.PROBE_JSON === '1') {
    console.log('__VERIFY_BILLING_JSON__')
    console.log(
      JSON.stringify(
        {
          strict: process.env.PROBE_STRICT === '1',
          apiBase,
          layers: { a: layerA, b: layerB, c: layerC },
          steps: stepResults,
          scenarioRows: scenarioRows ?? [],
          pass: overallOk,
        },
        null,
        2,
      ),
    )
  }

  if (!overallOk) process.exit(1)
}

main()
