/**
 * @deprecated 请使用 npm run test:e2e:workshop
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const runE2e = path.join(__dirname, 'e2e', 'run.mjs')

const result = spawnSync(process.execPath, [runE2e, 'workshop-flow'], {
  stdio: 'inherit',
  env: process.env,
})

process.exit(result.status ?? 1)
