/**
 * 无 Semgrep CLI 时的源码安全规则（与 .semgrep/electron-security.yaml 对齐）
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const SCAN_DIRS = ['electron', join('src', 'lib', 'auth'), join('src', 'lib', 'storage')]

const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

/** @type {Array<{ id: string; severity: 'ERROR' | 'WARNING'; message: string; test: (line: string, file: string) => boolean }>} */
export const RULES = [
  {
    id: 'haode-expose-ipc-renderer',
    severity: 'ERROR',
    message: '禁止向渲染进程暴露完整 ipcRenderer',
    test: (line) => /exposeInMainWorld\s*\(\s*['"]ipcRenderer['"]/.test(line),
  },
  {
    id: 'haode-node-integration-enabled',
    severity: 'ERROR',
    message: 'nodeIntegration 必须保持 false',
    test: (line) => /nodeIntegration\s*:\s*true\b/.test(line),
  },
  {
    id: 'haode-context-isolation-disabled',
    severity: 'ERROR',
    message: 'contextIsolation 必须保持 true',
    test: (line) => /contextIsolation\s*:\s*false\b/.test(line),
  },
  {
    id: 'haode-dangerously-set-inner-html',
    severity: 'WARNING',
    message: '避免 dangerouslySetInnerHTML（Electron XSS 风险）',
    test: (line) => /dangerouslySetInnerHTML/.test(line),
  },
  {
    id: 'haode-openai-sk-key-literal',
    severity: 'ERROR',
    message: '疑似硬编码 sk- API Key',
    test: (line) => /sk-[a-zA-Z0-9]{20,}/.test(line),
  },
  {
    id: 'haode-eval-usage',
    severity: 'ERROR',
    message: '避免 eval / new Function',
    test: (line) => /\beval\s*\(|new\s+Function\s*\(/.test(line),
  },
]

function walkFiles(dir, root, out = []) {
  let entries = []
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'out') continue
      walkFiles(full, root, out)
      continue
    }
    if (!EXT.has(full.slice(full.lastIndexOf('.')))) continue
    out.push(relative(root, full).replace(/\\/g, '/'))
  }
  return out
}

/**
 * @returns {{ ok: boolean; findings: Array<{ rule: string; severity: string; file: string; line: number; message: string; preview: string }> }}
 */
export function runSourceSecurityScan(projectRoot) {
  const files = SCAN_DIRS.flatMap((dir) => walkFiles(join(projectRoot, dir), projectRoot))
  /** @type {ReturnType<typeof runSourceSecurityScan>['findings']} */
  const findings = []

  for (const file of files) {
    const fullPath = join(projectRoot, file)
    let text = ''
    try {
      text = readFileSync(fullPath, 'utf8')
    } catch {
      continue
    }
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]
      for (const rule of RULES) {
        if (rule.test(line, file)) {
          findings.push({
            rule: rule.id,
            severity: rule.severity,
            file,
            line: i + 1,
            message: rule.message,
            preview: line.trim().slice(0, 120),
          })
        }
      }
    }
  }

  const hasError = findings.some((item) => item.severity === 'ERROR')
  return { ok: !hasError, findings }
}
