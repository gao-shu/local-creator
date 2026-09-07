/**
 * 1.2 探针：persist:aiweb-doubao 跨 BrowserView / 跨进程是否保留 Cookie。
 * 用法: node scripts/probe-doubao-session.mjs
 * 退出码: 0=persist 生效; 1=失败
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'

const PARTITION = 'persist:aiweb-doubao'
const CHAT_URL = 'https://www.doubao.com/chat/'
const TEST_NAME = 'haode_probe_session'
const TEST_VALUE = `v_${Date.now()}`

const require = createRequire(import.meta.url)

function resolveElectronBinary() {
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
  if (!hit) throw new Error(`electron binary not found: ${candidates.join(', ')}`)
  return hit
}

function writeElectronMain(mainFile, phase, userDataDir) {
  const src = `
const { app, BrowserWindow, BrowserView, session } = require('electron')
const fs = require('fs')

const PARTITION = ${JSON.stringify(PARTITION)}
const CHAT_URL = ${JSON.stringify(CHAT_URL)}
const TEST_NAME = ${JSON.stringify(TEST_NAME)}
const TEST_VALUE = ${JSON.stringify(TEST_VALUE)}
const PHASE = ${JSON.stringify(phase)}
const reportPath = process.env.PROBE_REPORT

app.setPath('userData', ${JSON.stringify(userDataDir)})

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function createView(win) {
  const view = new BrowserView({
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.setBrowserView(view)
  view.setBounds({ x: 0, y: 0, width: 1100, height: 800 })
  const wc = view.webContents
  await wc.loadURL(CHAT_URL, {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  })
  await sleep(8000)
  return { view, wc }
}

async function readCookies() {
  const ses = session.fromPartition(PARTITION)
  const cookies = await ses.cookies.get({ url: CHAT_URL })
  return cookies.map((c) => ({
    name: c.name,
    value: String(c.value || '').slice(0, 24),
    domain: c.domain,
    session: c.session,
    expirationDate: c.expirationDate || null,
  }))
}

app.whenReady().then(async () => {
  const report = {
    phase: PHASE,
    partition: PARTITION,
    userData: app.getPath('userData'),
    electron: process.versions.electron,
  }

  try {
    const win = new BrowserWindow({
      width: 1100,
      height: 800,
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    })

    if (PHASE === 'seed') {
      const first = await createView(win)
      const ses = session.fromPartition(PARTITION)
      // 持久 Cookie（非会话级），模拟登录态落盘
      await ses.cookies.set({
        url: CHAT_URL,
        name: TEST_NAME,
        value: TEST_VALUE,
        domain: '.doubao.com',
        path: '/',
        secure: true,
        httpOnly: false,
        expirationDate: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      })
      await ses.cookies.flushStore()
      report.afterSeed = await readCookies()
      report.probeCookiePresent = report.afterSeed.some(
        (c) => c.name === TEST_NAME && c.value.startsWith('v_')
      )
      report.doubaoSiteCookies = report.afterSeed.filter((c) => c.name !== TEST_NAME).length

      // 跨 View：destroy 后再同 partition 创建
      win.setBrowserView(null)
      first.view.webContents.close()
      // Electron 无统一 destroy API；去掉引用后新建
      const second = await createView(win)
      report.afterRecreateView = await readCookies()
      report.persistAcrossViewDestroy = report.afterRecreateView.some(
        (c) => c.name === TEST_NAME && c.value === TEST_VALUE
      )
      report.siteCookiesAfterRecreate = report.afterRecreateView.filter(
        (c) => c.name !== TEST_NAME
      ).length
      void second
    } else if (PHASE === 'reload') {
      await createView(win)
      report.afterProcessRestart = await readCookies()
      report.persistAcrossProcess =
        report.afterProcessRestart.some((c) => c.name === TEST_NAME && c.value === TEST_VALUE)
      report.siteCookiesAfterRestart = report.afterProcessRestart.filter(
        (c) => c.name !== TEST_NAME
      ).length
    }
  } catch (err) {
    report.fatal = String(err && err.stack ? err.stack : err)
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
  app.exit(0)
})

app.on('window-all-closed', (e) => e.preventDefault())
`
  fs.writeFileSync(mainFile, src, 'utf8')
}

async function runPhase(phase, userDataDir, reportPath, mainFile) {
  writeElectronMain(mainFile, phase, userDataDir)
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
    child.on('error', reject)
    child.on('close', (code) => {
      if (!fs.existsSync(reportPath)) {
        reject(new Error(`phase ${phase} exit ${code}, no report. stderr:\n${stderr.slice(0, 2000)}`))
        return
      }
      resolve({ code, stderr })
    })
  })
  return JSON.parse(fs.readFileSync(reportPath, 'utf8'))
}

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doubao-session-'))
const userDataDir = path.join(tmpRoot, 'userData')
const mainFile = path.join(tmpRoot, 'main.cjs')
const seedReportPath = path.join(tmpRoot, 'seed.json')
const reloadReportPath = path.join(tmpRoot, 'reload.json')
fs.mkdirSync(userDataDir, { recursive: true })

const seed = await runPhase('seed', userDataDir, seedReportPath, mainFile)
const reload = await runPhase('reload', userDataDir, reloadReportPath, mainFile)

const summary = {
  verdict:
    seed.persistAcrossViewDestroy && reload.persistAcrossProcess && !seed.fatal && !reload.fatal
      ? 'PASS'
      : 'FAIL',
  partition: PARTITION,
  chatUrl: CHAT_URL,
  strategy: {
    partition: PARTITION,
    closePanel: 'hide BrowserView, keep same partition (do not destroy session)',
    acrossRelaunch: 'reuse persist:aiweb-doubao under app userData',
    multiVendor: false,
  },
  acrossViewDestroy: {
    ok: Boolean(seed.persistAcrossViewDestroy),
    probeCookiePresent: seed.probeCookiePresent,
    siteCookiesAfterSeed: seed.doubaoSiteCookies,
    siteCookiesAfterRecreate: seed.siteCookiesAfterRecreate,
    fatal: seed.fatal || null,
  },
  acrossProcessRestart: {
    ok: Boolean(reload.persistAcrossProcess),
    siteCookiesAfterRestart: reload.siteCookiesAfterRestart,
    fatal: reload.fatal || null,
  },
  note: '探测 Cookie 为本地写入的持久化测试 Cookie；站点自带 Cookie 数量作参考。真人登录扫码未自动化。',
}

const outPath = path.join(process.cwd(), 'tmp-probe-doubao-1.2.json')
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8')
console.log(JSON.stringify(summary, null, 2))
console.log(`\n[probe] wrote ${outPath}`)

try {
  fs.rmSync(tmpRoot, { recursive: true, force: true })
} catch {
  /* ignore */
}

process.exit(summary.verdict === 'PASS' ? 0 : 1)
