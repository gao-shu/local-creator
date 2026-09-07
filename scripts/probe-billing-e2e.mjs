/**
 * @deprecated 请用 npm run verify:billing 或 npm run probe:billing
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

console.log('probe-billing-e2e.mjs → 转发至 verify-billing.mjs\n')

const result = spawnSync('node', ['scripts/verify-billing.mjs'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
})

process.exit(result.status ?? 1)
