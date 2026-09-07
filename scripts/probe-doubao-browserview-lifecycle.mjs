/**
 * 2.3 探针：BrowserView 单例 + hide 再开不新建第二实例。
 * 用法: node scripts/probe-doubao-browserview-lifecycle.mjs
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'

const PARTITION = 'persist:aiweb-doubao'
const CHAT_URL = 'https://www.doubao.com/chat/'
const require = createRequire(import.meta.url)

function resolveElectronBinary() {
  const fromExport = require('electron')
  if (typeof fromExport === 'string' && fs.existsSync(fromExport)) return fromExport
  const root = path.dirname(require.resolve('electron/package.json'))
  const relative = fs.existsSync(path.join(root, 'path.txt'))
    ? fs.readFileSync(path.join(root, 'path.txt'), 'utf8').trim()
    : 'electron.exe'
  return path.join(root, 'dist', relative)
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doubao-bv-'))
const mainFile = path.join(tmpDir, 'main.cjs')
const reportPath = path.join(tmpDir, 'report.json')

fs.writeFileSync(
  mainFile,
  `
const { app, BrowserWindow, BrowserView } = require('electron')
const fs = require('fs')
const PARTITION = ${JSON.stringify(PARTITION)}
const CHAT_URL = ${JSON.stringify(CHAT_URL)}
const reportPath = process.env.PROBE_REPORT

let view = null
let createCount = 0

function ensureView() {
  if (view) return view
  createCount += 1
  view = new BrowserView({
    webPreferences: { partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  return view
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

app.whenReady().then(async () => {
  const report = { createCount: 0, steps: [], ok: false }
  try {
    const win = new BrowserWindow({ width: 1000, height: 700, show: false })
    const v1 = ensureView()
    win.setBrowserView(v1)
    v1.setBounds({ x: 600, y: 0, width: 400, height: 700 })
    await v1.webContents.loadURL(CHAT_URL)
    await sleep(3000)
    report.steps.push({ name: 'open1', views: win.getBrowserViews().length, url: v1.webContents.getURL() })

    win.removeBrowserView(v1)
    report.steps.push({ name: 'hide', views: win.getBrowserViews().length })

    const v2 = ensureView()
    win.setBrowserView(v2)
    v2.setBounds({ x: 600, y: 0, width: 400, height: 700 })
    await sleep(500)
    report.steps.push({
      name: 'open2',
      views: win.getBrowserViews().length,
      sameInstance: v1 === v2,
    })

    win.removeBrowserView(v2)
    report.steps.push({ name: 'hide2', views: win.getBrowserViews().length })

    report.createCount = createCount
    report.ok =
      createCount === 1 &&
      report.steps[0].views === 1 &&
      report.steps[1].views === 0 &&
      report.steps[2].views === 1 &&
      report.steps[2].sameInstance === true &&
      report.steps[3].views === 0
  } catch (err) {
    report.fatal = String(err && err.stack ? err.stack : err)
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  app.exit(report.ok ? 0 : 1)
})
`,
  'utf8',
)

await new Promise((resolve, reject) => {
  const child = spawn(resolveElectronBinary(), [mainFile], {
    env: { ...process.env, PROBE_REPORT: reportPath, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr.on('data', (d) => {
    stderr += d.toString()
  })
  child.on('error', reject)
  child.on('close', (code) => {
    if (!fs.existsSync(reportPath)) {
      reject(new Error(`no report, exit ${code}, stderr: ${stderr.slice(0, 1500)}`))
      return
    }
    resolve(code)
  })
})

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
const outPath = path.join(process.cwd(), 'tmp-probe-doubao-2.3.json')
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
console.log(JSON.stringify(report, null, 2))
console.log(`\n[probe] wrote ${outPath}`)
try {
  fs.rmSync(tmpDir, { recursive: true, force: true })
} catch {
  /* ignore */
}
process.exit(report.ok ? 0 : 1)
