/**
 * 安全扫描脚本共用工具
 */
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export function runCommand(label, command, args, { allowFail = false, env = process.env } = {}) {
  console.log(`\n[security] ▶ ${label}`)
  console.log(`[security] $ ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  })
  const code = result.status ?? 1
  if (code !== 0 && !allowFail) {
    console.error(`[security] ✗ ${label} 失败 (exit ${code})`)
    return false
  }
  if (code !== 0) {
    console.warn(`[security] ⚠ ${label} 跳过或告警 (exit ${code})`)
  } else {
    console.log(`[security] ✓ ${label} 通过`)
  }
  return code === 0
}

export function commandExists(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  })
  return (result.status ?? 1) === 0
}
