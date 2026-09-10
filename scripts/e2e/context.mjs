/**
 * Electron E2E 会话：启动/断言/清理
 */
import {
  assertCondition,
  dumpFailureArtifacts,
  ensureCompiled,
  gotoHash,
  waitForAppBootstrap,
  waitForElectronReady,
} from '../lib/e2e-helpers.mjs'
import { closeElectronApp, launchElectronApp } from '../lib/electron-launcher.mjs'

const IGNORED_CONSOLE_PATTERNS = [
  'validateDOMNesting',
  'Maximum update depth',
  'ERR_UNKNOWN_URL_SCHEME',
  'Failed to load resource: the server responded with a status of 404',
]

export class E2eSession {
  /** @param {{ prepareWorkspace: () => Promise<object>, label?: string }} options */
  constructor(options) {
    this.prepareWorkspace = options.prepareWorkspace
    this.label = options.label ?? 'e2e'
    this.errors = []
    this.workspace = null
    this.electronApp = null
    this.page = null
    /** @type {(condition: boolean, message: string) => void} */
    this.assert = (condition, message) => {
      assertCondition(condition, message, this.errors)
    }
    this.fail = this.fail.bind(this)
  }

  async fail(message) {
    this.errors.push(message)
    if (this.page && this.workspace?.projectDir) {
      await dumpFailureArtifacts(this.page, this.workspace.projectDir, `${this.label}-failed`)
    } else if (this.page) {
      await dumpFailureArtifacts(this.page, this.workspace?.dataRoot ?? '', `${this.label}-failed`)
    }
  }

  attachPageHandlers() {
    this.page.on('pageerror', (err) => this.errors.push(`pageerror: ${err.message}`))
    this.page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (IGNORED_CONSOLE_PATTERNS.some((pattern) => text.includes(pattern))) return
      this.errors.push(`console: ${text}`)
    })
  }

  async start(launchEnv) {
    this.launchEnv = launchEnv ?? {}
    await ensureCompiled()
    this.workspace = await this.prepareWorkspace()
    console.log(`[${this.label}] 数据目录: ${this.workspace.dataRoot}`)
    console.log(`[${this.label}] 启动器: ${this.workspace.launcherDir}`)

    ;({ app: this.electronApp, page: this.page } = await launchElectronApp({
      launcherDir: this.workspace.launcherDir,
      env: launchEnv,
    }))
    this.attachPageHandlers()

    await waitForElectronReady(this.page)
    await gotoHash(this.page, '#/dashboard')
    await waitForAppBootstrap(this.page)
  }

  /** 关闭并复用同一 launcher 目录重启 Electron（重启级持久化测试） */
  async relaunch(launchEnv) {
    if (!this.workspace?.launcherDir) {
      throw new Error('relaunch: workspace 未初始化')
    }
    await closeElectronApp(this.electronApp)
    this.electronApp = null
    this.page = null
    await new Promise((resolve) => setTimeout(resolve, 500))

    const env = launchEnv ?? this.launchEnv ?? {}
    ;({ app: this.electronApp, page: this.page } = await launchElectronApp({
      launcherDir: this.workspace.launcherDir,
      env,
    }))
    if (this.page.isClosed()) {
      throw new Error('relaunch: Electron 窗口已关闭')
    }
    this.attachPageHandlers()
    await waitForElectronReady(this.page)
    await gotoHash(this.page, '#/dashboard')
    await waitForAppBootstrap(this.page)
  }

  async stop() {
    await closeElectronApp(this.electronApp)
    this.electronApp = null
    this.page = null

    if (process.env.LC_E2E_KEEP === '1') {
      console.log(`[${this.label}] 保留目录: ${this.workspace?.root}`)
      return
    }
    if (this.workspace?.cleanup) {
      try {
        await Promise.race([
          this.workspace.cleanup(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('workspace cleanup timeout')), 15_000),
          ),
        ])
      } catch (error) {
        console.warn(`[${this.label}] 清理临时目录失败（可忽略）:`, error)
      }
    }
    this.workspace = null
  }

  get hasErrors() {
    return this.errors.length > 0
  }

  formatErrors() {
    return this.errors.map((item) => `  - ${item}`).join('\n')
  }
}
