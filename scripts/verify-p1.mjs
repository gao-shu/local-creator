/**
 * P1 回归聚合（verify:full 之外的专项自动化）
 *
 *   npm run verify:p1
 *   VERIFY_P1_SKIP_COMPILE=1 npm run verify:p1
 *   VERIFY_P1_SKIP_AUTH=1 npm run verify:p1
 *   VERIFY_P1_SKIP_CANVAS_LOGIC=1 npm run verify:p1
 *
 * 含：P1 E2E 三件套（可单独跑）、视频进度、画布模块纯逻辑、登录 verify
 * 不含：verify:ui（需 dev）、真实 API live、scan:security
 * 清单见 docs/FULL_REGRESSION_CHECKLIST.md §2
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

/** @type {{ label: string, ok: boolean }[]} */
const results = []

function runStep(label, args, env = {}) {
  console.log(`\n[verify:p1] ── ${label} ──\n`)
  const result = spawnSync('npm', args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
    env: { ...process.env, ...env },
  })
  const ok = (result.status ?? 1) === 0
  results.push({ label, ok })
  if (!ok) {
    console.error(`[verify:p1] ✗ ${label}`)
  }
  return ok
}

console.log('[verify:p1] P1 回归（专项自动化）开始…')
console.log(`[verify:p1] 根目录: ${root}`)

const skipCompile = process.env.VERIFY_P1_SKIP_COMPILE === '1'
const skipAuth = process.env.VERIFY_P1_SKIP_AUTH === '1'
const skipE2e = process.env.VERIFY_P1_SKIP_E2E === '1'
const skipCanvasLogic = process.env.VERIFY_P1_SKIP_CANVAS_LOGIC === '1'

if (!skipCompile) {
  runStep('compile', ['run', 'compile'])
} else {
  console.log('[verify:p1] 跳过 compile（VERIFY_P1_SKIP_COMPILE=1）')
}

if (!skipE2e) {
  runStep('P1 E2E 三件套', ['run', 'test:e2e:p1'])
} else {
  console.log('[verify:p1] 跳过 P1 E2E（VERIFY_P1_SKIP_E2E=1，已在 verify:full 中跑过时可跳过）')
}

runStep('视频进度重开 UI 纯逻辑', ['run', 'test:video-progress-reopen'])

if (!skipCanvasLogic) {
  runStep('画布模块纯逻辑', ['run', 'test:canvas-logic-extra'])
} else {
  console.log('[verify:p1] 跳过 canvas-logic-extra（VERIFY_P1_SKIP_CANVAS_LOGIC=1）')
}

if (!skipAuth) {
  runStep('登录 flow + UI', ['run', 'verify:auth'])
} else {
  console.log('[verify:p1] 跳过 verify:auth（VERIFY_P1_SKIP_AUTH=1）')
}

const failed = results.filter((r) => !r.ok)
console.log('\n[verify:p1] ── 汇总 ──')
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.label}`)
}

if (failed.length > 0) {
  console.error(`\n[verify:p1] ✗ 失败 ${failed.length}/${results.length}：${failed.map((f) => f.label).join('、')}`)
  process.exit(1)
}

console.log('\n[verify:p1] ✓ P1 专项自动化通过')
console.log('[verify:p1] 完整发版建议：npm run verify:all（= verify:full + verify:p1）')
