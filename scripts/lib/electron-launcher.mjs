/**
 * Playwright · 启动 Electron 主进程（真 IPC + 本地文件存储）
 */
import { createRequire } from 'node:module'
import { _electron as electron } from 'playwright'
import { MAIN_ENTRY, REPO_ROOT } from './e2e-helpers.mjs'

const require = createRequire(import.meta.url)
const electronExecutable = require('electron')

export async function launchElectronApp({ launcherDir, env: envOverrides = {} }) {
  const app = await electron.launch({
    executablePath: electronExecutable,
    args: [MAIN_ENTRY],
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      HAODE_E2E: '1',
      HAODE_E2E_MOCK_AI: '1',
      HAODE_E2E_LAUNCHER_DIR: launcherDir,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      ...envOverrides,
    },
    timeout: 90_000,
  })

  const page = await app.firstWindow()
  page.setDefaultTimeout(60_000)
  page.setDefaultNavigationTimeout(60_000)
  await page.waitForLoadState('domcontentloaded')
  return { app, page }
}

export async function closeElectronApp(app) {
  if (!app) return
  try {
    await Promise.race([
      app.close(),
      new Promise((resolve) => setTimeout(resolve, 12_000)),
    ])
  } catch {
    /* ignore */
  }
  try {
    const proc = typeof app.process === 'function' ? app.process() : null
    if (proc && !proc.killed) {
      proc.kill('SIGKILL')
    }
  } catch {
    /* ignore */
  }
  // Windows 上给文件句柄释放留时间，避免下一套件 launch / cleanup 卡住
  await new Promise((resolve) => setTimeout(resolve, 800))
}
