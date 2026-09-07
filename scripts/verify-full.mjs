/**
 * 发版前 / 全量回归聚合（Mock E2E + 纯逻辑 + 计价客户端层 + FFmpeg Layer A）
 *
 *   npm run verify:full
 *   VERIFY_FULL_SKIP_E2E=1 npm run verify:full   # 跳过 Electron E2E（约 40s）
 *   VERIFY_FULL_SKIP_PRICING=1 npm run verify:full
 *
 * 不含：verify:ui（需 dev）、真实 API、scan:security、verify:ffmpeg-win-pack（打包专项）
 * 计价：共用一次 smoke:billing + 图片/视频 Layer A（PROBE_SKIP_BILLING）
 * 清单见 docs/FULL_REGRESSION_CHECKLIST.md
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

/** @type {{ label: string, ok: boolean }[]} */
const results = []

function runStep(label, args, env = {}) {
  console.log(`\n[verify:full] ── ${label} ──\n`)
  const result = spawnSync('npm', args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
    env: { ...process.env, ...env },
  })
  const ok = (result.status ?? 1) === 0
  results.push({ label, ok })
  if (!ok) {
    console.error(`[verify:full] ✗ ${label}`)
  }
  return ok
}

console.log('[verify:full] 全量回归（自动化 Mock 线）开始…')
console.log(`[verify:full] 根目录: ${root}`)

const skipE2e = process.env.VERIFY_FULL_SKIP_E2E === '1'
const skipPricing = process.env.VERIFY_FULL_SKIP_PRICING === '1'

runStep('compile', ['run', 'compile'])

if (!skipE2e) {
  runStep('E2E 全部套件 (46)', ['run', 'test:e2e'])
} else {
  console.log('[verify:full] 跳过 E2E（VERIFY_FULL_SKIP_E2E=1）')
}

runStep('画布 P0 纯逻辑', ['run', 'test:canvas-p0'])
// 全局库 E2E 五件套已含在上面的 test:e2e；此处仅补纯逻辑
runStep('全局库纯逻辑', ['run', 'test:global-libraries'])
runStep('分镜模板纯逻辑', ['run', 'test:storyboard-all'])
runStep('FFmpeg / IPC Layer A', ['run', 'test:ffmpeg-layer-a'])

if (!skipPricing) {
  const pricingEnv = {
    PROBE_SKIP_COMPILE: '1',
    PROBE_SKIP_BACKEND: '1',
  }
  runStep('smoke:billing（计价 Layer B 共用）', ['run', 'smoke:billing'], pricingEnv)
  const pricingWithSkipBilling = { ...pricingEnv, PROBE_SKIP_BILLING: '1' }
  runStep('图片分档计价 Layer A', ['run', 'verify:image-pricing'], pricingWithSkipBilling)
  runStep('视频分档计价 Layer A', ['run', 'verify:video-pricing'], pricingWithSkipBilling)
} else {
  console.log('[verify:full] 跳过计价（VERIFY_FULL_SKIP_PRICING=1）')
}

const failed = results.filter((r) => !r.ok)
console.log('\n[verify:full] ── 汇总 ──')
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.label}`)
}

if (failed.length > 0) {
  console.error(`\n[verify:full] ✗ 失败 ${failed.length}/${results.length}：${failed.map((f) => f.label).join('、')}`)
  console.error('[verify:full] 手工项见 docs/FULL_REGRESSION_CHECKLIST.md §4')
  process.exit(1)
}

console.log('\n[verify:full] ✓ 自动化全量通过')
console.log('[verify:full] 建议补充：npm run verify:p1 或 verify:all；dev + verify:ui、真实 API 手工表')
