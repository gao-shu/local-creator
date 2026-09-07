/**
 * 密钥泄露扫描：优先 gitleaks，否则内置规则兜底
 *
 *   npm run scan:secrets
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { commandExists, projectRoot } from './lib/security-scan-utils.mjs'

const ALLOW_PATH_SUFFIX = [
  '.env.example',
  'BUG-REGISTRY.md',
  'release-ship/SKILL.md',
  'config-bug-registry/SKILL.md',
]

const ALLOW_LINE_PATTERNS = [
  /你的AccessKey/i,
  /你的SecretKey/i,
  /YOUR_/i,
  /example\.com/i,
  /users\.noreply\.github\.com/i,
  /offline-local-token/,
  /x+\.xxx/i,
  /placeholder/i,
  /请配置/i,
  /# /,
]

const SECRET_PATTERNS = [
  { name: 'OpenAI/通用 sk- Key', regex: /sk-[a-zA-Z0-9]{20,}/ },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'Bearer Token', regex: /Bearer\s+[a-zA-Z0-9._-]{24,}/ },
  {
    name: 'TOS/云 AK 明文',
    regex: /TOS_(ACCESS|SECRET)_KEY\s*=\s*['"]?[a-zA-Z0-9/+]{16,}['"]?/i,
  },
  {
    name: 'SFTP 密码明文',
    regex: /SFTP_(PASS|PASSWORD)\s*=\s*['"]?[^\s'"]{8,}['"]?/i,
  },
  {
    name: 'Feishu App Secret',
    regex: /FEISHU_(APP_)?SECRET\s*=\s*['"]?[a-zA-Z0-9]{12,}['"]?/i,
  },
]

function shouldSkipPath(relativePath) {
  return ALLOW_PATH_SUFFIX.some((suffix) => relativePath.endsWith(suffix))
}

function shouldSkipLine(line) {
  return ALLOW_LINE_PATTERNS.some((pattern) => pattern.test(line))
}

function runGitleaks() {
  if (!commandExists('gitleaks')) return null
  console.log('\n[scan:secrets] ▶ gitleaks detect')
  const result = spawnSync(
    'gitleaks',
    ['detect', '--source', projectRoot, '--config', join(projectRoot, '.gitleaks.toml'), '--redact'],
    { cwd: projectRoot, stdio: 'inherit', shell: process.platform === 'win32' },
  )
  return (result.status ?? 1) === 0
}

function runFallbackScan() {
  console.log('\n[scan:secrets] ▶ 内置规则扫描（未检测到 gitleaks 可执行文件）')
  const listed = spawnSync('git', ['ls-files'], {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if ((listed.status ?? 1) !== 0) {
    console.error('[scan:secrets] git ls-files 失败，请确认在 git 仓库内')
    return false
  }

  const findings = []
  for (const relativePath of listed.stdout.split('\n').filter(Boolean)) {
    if (shouldSkipPath(relativePath)) continue
    if (/\.(png|jpg|jpeg|gif|webp|ico|exe|dmg|zip|blockmap|woff2?)$/i.test(relativePath)) {
      continue
    }
    let text = ''
    try {
      text = readFileSync(join(projectRoot, relativePath), 'utf8')
    } catch {
      continue
    }
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      if (shouldSkipLine(line)) continue
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.regex.test(line)) {
          findings.push({
            file: relativePath,
            line: i + 1,
            rule: pattern.name,
            preview: line.trim().slice(0, 120),
          })
        }
      }
    }
  }

  if (findings.length === 0) {
    console.log('[scan:secrets] ✓ 内置规则未发现疑似密钥')
    return true
  }

  console.error(`[scan:secrets] ✗ 发现 ${findings.length} 处疑似密钥：`)
  for (const item of findings) {
    console.error(`  - ${item.file}:${item.line} [${item.rule}] ${item.preview}`)
  }
  return false
}

const gitleaksOk = runGitleaks()
if (gitleaksOk === true) {
  console.log('\n[scan:secrets] ✓ gitleaks 通过')
  process.exit(0)
}
if (gitleaksOk === false) {
  console.error('\n[scan:secrets] ✗ gitleaks 发现泄露')
  process.exit(1)
}

process.exit(runFallbackScan() ? 0 : 1)
