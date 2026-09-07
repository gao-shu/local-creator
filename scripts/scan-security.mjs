/**
 * 一键安全扫描：依赖 CVE + 密钥 + 源码（Semgrep）
 *
 *   npm run scan:security
 *
 * 发版前建议执行；默认不阻塞日常 dev（仅 scan:security 失败时 exit 1）
 */
import { spawnSync } from 'node:child_process'
import { projectRoot } from './lib/security-scan-utils.mjs'

const steps = [
  { label: '依赖漏洞', script: 'scan-audit-deps.mjs' },
  { label: '密钥泄露', script: 'scan-secrets.mjs' },
  { label: '源码静态', script: 'scan-semgrep.mjs' },
]

console.log('[scan:security] 开始安全扫描…')
console.log(`[scan:security] 项目根目录: ${projectRoot}`)

const failed = []

for (const step of steps) {
  const result = spawnSync('node', [`scripts/${step.script}`], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if ((result.status ?? 1) !== 0) {
    failed.push(step.label)
  }
}

console.log('\n[scan:security] ── 可选：Electron 专项 ──')
spawnSync('node', ['scripts/scan-electron.mjs'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (failed.length > 0) {
  console.error(`\n[scan:security] ✗ 未通过：${failed.join('、')}`)
  console.error('[scan:security] 发版前请修复上述问题，避免依赖漏洞或被薅 API Key。')
  process.exit(1)
}

console.log('\n[scan:security] ✓ 基本安全扫描全部通过')
