/**
 * Phase 5 Step 11 — 视频模型分档计价 · 双仓联调验收
 *
 * 用法:
 *   npm run verify:video-pricing
 *   PROBE_SKIP_COMPILE=1 npm run verify:video-pricing
 *   PROBE_SKIP_BACKEND=1 npm run verify:video-pricing   # 仅客户端
 *   PROBE_SKIP_BILLING=1 npm run verify:video-pricing   # 跳过 Layer B（billing 已跑过）
 *   PROBE_JSON=1 npm run verify:video-pricing
 *
 * Layer A  test:video-pricing   5A–5G 分档解析 / UI / 代理 / 费用预览
 * Layer B  compile + smoke:billing   计费矩阵 + 视频分档 smoke
 * Layer C  admin backend pytest（可选，兄弟仓 haode-ai-admin/backend）
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

/** @type {{ label: string, ok: boolean }[]} */
const stepResults = []

function resolveAdminBackendDir() {
  const candidates = [
    path.resolve(root, '..', 'haode-ai-admin', 'backend'),
    path.resolve(root, '..', '..', 'cangku', 'haode-ai-admin', 'backend'),
  ]
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'tests', 'test_client_video_model_pricing.py'))) {
      return dir
    }
  }
  return null
}

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

function runInheritCwd(label, cwd, command, args, env = process.env) {
  console.log(`\n── ${label} ──\n`)
  const result = spawnSync(command, args, {
    cwd,
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

function printReport({ layerA, layerB, layerC, backendSkipped }) {
  console.log('\n=== 视频分档计价验收 (verify:video-pricing) ===')
  console.log(`  Layer A  test:video-pricing        ${layerA ? '✓' : '✗'}`)
  console.log(`  Layer B  compile + smoke:billing   ${layerB ? '✓' : '✗'}`)
  if (backendSkipped) {
    console.log('  Layer C  backend pytest            — (skipped)')
  } else {
    console.log(`  Layer C  backend pytest            ${layerC ? '✓' : '✗'}`)
  }
  const overall = layerA && layerB && (backendSkipped || layerC)
  console.log(`\n  总体: ${overall ? 'PASS' : 'FAIL'}`)
  console.log('\n  发版前手工清单见:')
  console.log('    haode-ai-admin/docs/design/video-model-pricing-client.md §6')
  console.log('    haode-ai-client/docs/TESTING.md §9')
  return overall
}

function main() {
  console.log('=== Phase 5 Step 11 — 视频模型分档计价联调 ===')
  console.log(`  PROBE_SKIP_COMPILE=${process.env.PROBE_SKIP_COMPILE ?? 'off'}`)
  console.log(`  PROBE_SKIP_BACKEND=${process.env.PROBE_SKIP_BACKEND ?? 'off'}`)

  const layerA = runInherit('Layer A — test:video-pricing', 'npm', ['run', 'test:video-pricing'])

  let layerB = false
  if (layerA) {
    if (process.env.PROBE_SKIP_BILLING === '1') {
      console.log('\n── Layer B — smoke:billing ──')
      console.log('  — (skipped，PROBE_SKIP_BILLING=1，已由 verify:full 等上游跑过)')
      layerB = true
    } else if (process.env.PROBE_SKIP_COMPILE === '1') {
      layerB = runInherit('Layer B — smoke:billing (skip compile)', 'npm', ['run', 'smoke:billing'])
    } else {
      layerB = runInherit('Layer B — compile + smoke:billing', 'npm', ['run', 'compile']) &&
        runInherit('Layer B — smoke:billing', 'npm', ['run', 'smoke:billing'])
    }
  }

  let layerC = false
  let backendSkipped = process.env.PROBE_SKIP_BACKEND === '1'
  if (layerA && layerB && !backendSkipped) {
    const backendDir = resolveAdminBackendDir()
    if (!backendDir) {
      console.log('\n── Layer C — backend pytest ──')
      console.log('  ⚠ 未找到 haode-ai-admin/backend，跳过 Layer C')
      console.log('  可设 PROBE_SKIP_BACKEND=1 或在本机 clone 兄弟仓后重跑')
      backendSkipped = true
      layerC = true
    } else {
      const pytestArgs = [
        'tests/test_client_video_model_pricing.py',
        'tests/test_video_model_pricing.py',
        'tests/test_admin_video_model_pricing.py',
        '-q',
      ]
      layerC = runInheritCwd(
        `Layer C — backend pytest (${path.basename(path.dirname(backendDir))})`,
        backendDir,
        'pytest',
        pytestArgs,
      )
    }
  }

  const overallOk = printReport({ layerA, layerB, layerC, backendSkipped })

  if (process.env.PROBE_JSON === '1') {
    console.log('__VERIFY_VIDEO_PRICING_JSON__')
    console.log(
      JSON.stringify(
        {
          layers: { a: layerA, b: layerB, c: backendSkipped ? null : layerC },
          backendSkipped,
          steps: stepResults,
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
