/**
 * 视频模型分档计价 · Layer A 合并回归（5A–5G）
 *
 * 用法：npm run test:video-pricing
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

const STEPS = ['5a', '5b', '5c', '5d', '5e', '5f', '5g'] as const

console.log('[test:video-pricing] running Phase 5A–5G suite')

for (const step of STEPS) {
  const script = path.join('scripts', `test-video-model-pricing-${step}.ts`)
  console.log(`\n[test:video-pricing] → ${step}`)
  const result = spawnSync('npx', ['--yes', 'tsx', script], {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
  })
  if (result.status !== 0) {
    console.error(`\n[test:video-pricing] failed at step ${step} (exit ${result.status ?? 'unknown'})`)
    process.exit(result.status ?? 1)
  }
}

console.log('\n[test:video-pricing] all passed (5A–5G)')
