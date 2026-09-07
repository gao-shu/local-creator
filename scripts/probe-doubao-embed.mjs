/**
 * 1.1 探针：豆包聊天页能否在 Electron BrowserView 内嵌加载。
 * 用法: node scripts/probe-doubao-embed.mjs
 * 退出码: 0=可嵌入可看页面; 1=加载失败; 2=白屏/异常壳
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'

const URLS = [
  'https://www.doubao.com/chat/',
  'https://www.doubao.com/',
]

const SETTLE_MS = 12_000
const require = createRequire(import.meta.url)

function resolveElectronBinary() {
  // Outside Electron, require('electron') returns the binary path string.
  const fromExport = require('electron')
  if (typeof fromExport === 'string' && fs.existsSync(fromExport)) {
    return fromExport
  }
  const electronPkg = require.resolve('electron/package.json')
  const root = path.dirname(electronPkg)
  const relative = fs.existsSync(path.join(root, 'path.txt'))
    ? fs.readFileSync(path.join(root, 'path.txt'), 'utf8').trim()
    : 'electron.exe'
  const candidates = [
    path.join(root, 'dist', relative),
    path.join(root, relative),
  ]
  const hit = candidates.find((p) => fs.existsSync(p))
  if (!hit) {
    throw new Error(`electron binary not found; tried: ${candidates.join(', ')}`)
  }
  return hit
}

async function fetchHeaders(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    })
    const interesting = [
      'content-type',
      'x-frame-options',
      'content-security-policy',
      'cross-origin-opener-policy',
      'cross-origin-embedder-policy',
      'set-cookie',
    ]
    const headers = {}
    for (const key of interesting) {
      const v = res.headers.get(key)
      if (v) headers[key] = v.slice(0, 500)
    }
    return { ok: res.ok, status: res.status, finalUrl: res.url, headers }
  } catch (err) {
    return { ok: false, error: String(err?.message || err) }
  }
}

async function runHeaderProbe() {
  const out = {}
  for (const url of URLS) {
    out[url] = await fetchHeaders(url)
  }
  return out
}

/** Electron 子进程入口：写报告到 process.env.PROBE_REPORT */
function electronMainSource() {
  return `
const { app, BrowserWindow, BrowserView, session } = require('electron')
const fs = require('fs')

const URLS = ${JSON.stringify(URLS)}
const SETTLE_MS = ${SETTLE_MS}
const reportPath = process.env.PROBE_REPORT

const report = {
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  platform: process.platform,
  results: [],
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function probeOne(url) {
  const entry = {
    url,
    events: [],
    consoleErrors: [],
    loadFails: [],
    title: '',
    finalUrl: '',
    bodyTextSample: '',
    bodyLen: 0,
    visibleTextLen: 0,
    hasLoginHint: false,
    hasChatHint: false,
    blank: false,
    ok: false,
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const partition = 'persist:probe-doubao-' + Date.now()
  const view = new BrowserView({
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.setBrowserView(view)
  view.setBounds({ x: 0, y: 0, width: 1280, height: 900 })

  const wc = view.webContents
  wc.on('did-start-loading', () => entry.events.push('did-start-loading'))
  wc.on('did-finish-load', () => {
    entry.events.push('did-finish-load')
    entry.finalUrl = wc.getURL()
    entry.title = wc.getTitle()
  })
  wc.on('did-navigate', (_e, u) => entry.events.push('did-navigate:' + u.slice(0, 120)))
  wc.on('did-fail-load', (_e, code, desc, validatedURL, isMainFrame) => {
    entry.loadFails.push({ code, desc, validatedURL, isMainFrame })
    entry.events.push('did-fail-load:' + code + ':' + desc)
  })
  wc.on('console-message', (_e, level, message) => {
    if (level >= 2) entry.consoleErrors.push(String(message).slice(0, 300))
  })

  try {
    await wc.loadURL(url, {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    })
  } catch (err) {
    entry.loadFails.push({ code: -1, desc: String(err?.message || err), validatedURL: url, isMainFrame: true })
  }

  await sleep(SETTLE_MS)

  entry.finalUrl = wc.getURL()
  entry.title = wc.getTitle()

  try {
    const snap = await wc.executeJavaScript(\`(function(){
      const body = document.body
      const text = (body && (body.innerText || '')) || ''
      const htmlLen = (body && body.innerHTML) ? body.innerHTML.length : 0
      const lower = text.toLowerCase()
      return {
        bodyLen: htmlLen,
        visibleTextLen: text.trim().length,
        sample: text.replace(/\\\\s+/g, ' ').trim().slice(0, 240),
        hasLoginHint: /登录|扫码|验证码|login|sign in/i.test(text),
        hasChatHint: /新对话|豆包|doubao|发送|输入消息|chat/i.test(text),
        title: document.title || '',
      }
    })()\`)
    entry.bodyLen = snap.bodyLen
    entry.visibleTextLen = snap.visibleTextLen
    entry.bodyTextSample = snap.sample
    entry.hasLoginHint = snap.hasLoginHint
    entry.hasChatHint = snap.hasChatHint
    if (snap.title) entry.title = snap.title
  } catch (err) {
    entry.executeError = String(err?.message || err)
  }

  entry.blank = entry.visibleTextLen < 40 && entry.bodyLen < 200
  entry.ok =
    entry.loadFails.filter((f) => f.isMainFrame).length === 0 &&
    !entry.blank &&
    entry.visibleTextLen >= 40

  win.destroy()
  return entry
}

app.whenReady().then(async () => {
  try {
    for (const url of URLS) {
      report.results.push(await probeOne(url))
    }
  } catch (err) {
    report.fatal = String(err?.stack || err)
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
  app.exit(0)
})

app.on('window-all-closed', (e) => e.preventDefault())
`
}

async function runElectronProbe() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doubao-probe-'))
  const mainFile = path.join(tmpDir, 'main.cjs')
  const reportPath = path.join(tmpDir, 'report.json')
  fs.writeFileSync(mainFile, electronMainSource(), 'utf8')

  const electronBin = resolveElectronBinary()
  await new Promise((resolve, reject) => {
    const child = spawn(electronBin, [mainFile], {
      env: {
        ...process.env,
        PROBE_REPORT: reportPath,
        ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    child.stdout.on('data', () => {})
    child.on('error', reject)
    child.on('close', (code) => {
      if (!fs.existsSync(reportPath)) {
        reject(new Error(`electron exited ${code} without report. stderr:\n${stderr.slice(0, 2000)}`))
        return
      }
      resolve({ code, stderr })
    })
  })

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
  return report
}

function summarize(headers, electronReport) {
  const results = electronReport.results || []
  const best = results.find((r) => r.ok) || results[0]
  const embedOk = Boolean(best?.ok)
  return {
    verdict: embedOk ? 'PASS' : 'FAIL',
    embedOk,
    recommendedUrl: best?.ok ? best.url : null,
    note: embedOk
      ? 'BrowserView 可加载豆包页（有可见 DOM/文案）。X-Frame-Options 对 BrowserView 通常无效；后续可用 persist session。'
      : '主文档加载失败或近似白屏。建议降级：按钮仅 shell.openExternal。',
    headers,
    electron: {
      version: electronReport.electron,
      chrome: electronReport.chrome,
      fatal: electronReport.fatal || null,
      results: results.map((r) => ({
        url: r.url,
        ok: r.ok,
        blank: r.blank,
        title: r.title,
        finalUrl: r.finalUrl,
        visibleTextLen: r.visibleTextLen,
        hasLoginHint: r.hasLoginHint,
        hasChatHint: r.hasChatHint,
        bodyTextSample: r.bodyTextSample,
        loadFails: r.loadFails,
        consoleErrors: (r.consoleErrors || []).slice(0, 8),
        executeError: r.executeError || null,
      })),
    },
  }
}

const headers = await runHeaderProbe()
const electronReport = await runElectronProbe()
const summary = summarize(headers, electronReport)

const outPath = path.join(process.cwd(), 'tmp-probe-doubao-1.1.json')
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8')
console.log(JSON.stringify(summary, null, 2))
console.log(`\n[probe] wrote ${outPath}`)

process.exit(summary.embedOk ? 0 : 1)
