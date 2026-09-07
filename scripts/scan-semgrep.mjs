/**
 * 源码静态安全扫描（Electron / auth / storage 重点目录）
 * 优先本机 semgrep；不可用时走内置规则（与 .semgrep/electron-security.yaml 对齐）
 *
 *   npm run scan:semgrep
 */
import { commandExists, projectRoot, runCommand } from './lib/security-scan-utils.mjs'
import { runSourceSecurityScan } from './lib/source-security-scan.mjs'

function runSemgrepCli() {
  if (!commandExists('semgrep')) return null
  return runCommand('Semgrep CLI', 'semgrep', [
    'scan',
    '--config',
    'p/typescript',
    '--config',
    'p/secrets',
    '--config',
    '.semgrep/electron-security.yaml',
    '--metrics',
    'off',
    '--error',
    'electron/',
    'src/lib/auth/',
    'src/lib/storage/',
  ])
}

function runBuiltinScan() {
  console.log('\n[scan:semgrep] ▶ 内置规则扫描（未检测到 semgrep 可执行文件）')
  console.log('[scan:semgrep] 提示：可选安装 semgrep 获得更全规则 → pip install semgrep')
  const { ok, findings } = runSourceSecurityScan(projectRoot)
  if (findings.length === 0) {
    console.log('[scan:semgrep] ✓ 内置规则未发现 ERROR')
    return true
  }
  for (const item of findings) {
    const prefix = item.severity === 'ERROR' ? '✗' : '⚠'
    console.log(
      `[scan:semgrep] ${prefix} ${item.file}:${item.line} [${item.rule}] ${item.message}`,
    )
    console.log(`             ${item.preview}`)
  }
  if (!ok) {
    console.error(`[scan:semgrep] ✗ 发现 ${findings.filter((f) => f.severity === 'ERROR').length} 个 ERROR`)
  }
  return ok
}

const semgrepResult = runSemgrepCli()
if (semgrepResult === true) {
  process.exit(0)
}
if (semgrepResult === false) {
  process.exit(1)
}

process.exit(runBuiltinScan() ? 0 : 1)
