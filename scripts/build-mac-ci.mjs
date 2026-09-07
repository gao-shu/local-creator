/**
 * 本机 macOS 打包：arm64 dmg（可选 zip）
 */
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const result = spawnSync(process.execPath, ['scripts/build-desktop.mjs'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env, BUILD_MAC_ONLY: '1' },
})

process.exit(result.status ?? 1)
