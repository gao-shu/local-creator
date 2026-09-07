/**
 * 依赖 CVE 扫描（npmmirror 不支持 audit，需走官方 registry）
 * 优先检查运行时 dependencies；devDependencies 仅告警不阻塞
 *
 *   npm run audit:deps
 */
import { spawnSync } from 'node:child_process'
import { projectRoot } from './lib/security-scan-utils.mjs'

const registryArgs = ['--registry=https://registry.npmjs.org']

function runAudit(label, extraArgs) {
  console.log(`\n[audit:deps] ▶ ${label}`)
  const result = spawnSync('npm', ['audit', ...registryArgs, ...extraArgs], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  return (result.status ?? 1) === 0
}

const prodOk = runAudit('运行时依赖 (dependencies, moderate+)', [
  '--omit=dev',
  '--audit-level=moderate',
])

if (!prodOk) {
  console.error(
    '\n[audit:deps] ✗ 运行时依赖存在 moderate+ 漏洞，请升级对应 package 后发版。',
  )
  process.exit(1)
}

console.log('\n[audit:deps] ✓ 运行时依赖无 moderate+ 漏洞')

console.log('\n[audit:deps] ▶ Electron 版本（打入安装包，虽在 devDependencies）')
console.warn(
  '[audit:deps]   当前 electron 在 devDependencies；完整 audit 可能报 high，请择机升级大版本。',
)
console.warn('[audit:deps]   查看详情：npm audit --registry=https://registry.npmjs.org --audit-level=high')

const devOk = runAudit('全部 devDependencies (high+，仅参考)', [
  '--audit-level=high',
])

if (!devOk) {
  console.warn(
    '\n[audit:deps] ⚠ 开发依赖存在 high 漏洞（多为 electron-builder/tar 链），',
  )
  console.warn('[audit:deps]   不影响安装包运行时；可择机 npm audit fix 或升级 electron-builder。')
} else {
  console.log('\n[audit:deps] ✓ 开发依赖无 high 漏洞')
}

console.log(`\n[audit:deps] 完成 (${projectRoot})`)
