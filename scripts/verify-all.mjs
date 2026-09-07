/**
 * 完整自动化回归 = verify:full + verify:p1
 *
 *   npm run verify:all
 *   VERIFY_ALL_SKIP_AUTH=1 npm run verify:all
 *   VERIFY_ALL_RUN_P1_E2E=1 npm run verify:all
 *
 * verify:p1 默认跳过 P1 E2E（已在 full 的 test:e2e 中跑过）。
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

function runNpm(args, env = {}) {
  const result = spawnSync('npm', args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
    env: { ...process.env, ...env },
  })
  return (result.status ?? 1) === 0
}

console.log('[verify:all] 完整自动化回归开始（verify:full → verify:p1）…')

const fullOk = runNpm(['run', 'verify:full'])
if (!fullOk) {
  console.error('[verify:all] ✗ verify:full 失败，中止')
  process.exit(1)
}

const p1Env = {
  VERIFY_P1_SKIP_COMPILE: '1',
  VERIFY_P1_SKIP_E2E: process.env.VERIFY_ALL_RUN_P1_E2E === '1' ? '0' : '1',
  VERIFY_P1_SKIP_AUTH: process.env.VERIFY_ALL_SKIP_AUTH === '1' ? '1' : '0',
  VERIFY_P1_SKIP_CANVAS_LOGIC: process.env.VERIFY_ALL_SKIP_CANVAS_LOGIC === '1' ? '1' : '0',
}

const p1Ok = runNpm(['run', 'verify:p1'], p1Env)
if (!p1Ok) {
  console.error('[verify:all] ✗ verify:p1 失败')
  process.exit(1)
}

console.log('\n[verify:all] ✓ 完整自动化回归通过')
console.log('[verify:all] 可选补充：dev + verify:ui、scan:security、真实 API 手工表')
