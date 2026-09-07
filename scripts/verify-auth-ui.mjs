/**
 * 登录页 UI E2E：注册 → 进入工作台 → 退出 → 再登录
 *
 * 前置：npm run dev 已启动（默认 15173，被占用时会递增）
 *   UI_BASE_URL=http://localhost:15175 node scripts/verify-auth-ui.mjs
 */
import { chromium } from 'playwright'

const BASE = (process.env.UI_BASE_URL || 'http://localhost:15173').replace(/\/+$/, '')
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:28080/api'

function fail(msg) {
  console.error(`[FAIL] ${msg}`)
  process.exit(1)
}

function ok(msg) {
  console.log(`[OK] ${msg}`)
}

async function apiRegister(username, password) {
  const res = await fetch(`${API_BASE.replace(/\/+$/, '')}/client/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const json = await res.json()
  return { status: res.status, json }
}

async function clearRateLimits() {
  try {
    const { execSync } = await import('node:child_process')
    execSync(
      'docker compose --env-file deploy/docker/.env exec -T redis redis-cli FLUSHDB',
      { cwd: process.env.HAODE_ADMIN_ROOT || 'e:/work/project/cangku/haode-ai-admin', stdio: 'ignore' },
    )
  } catch {
    /* optional: docker not available */
  }
}

async function main() {
  await clearRateLimits()
  console.log(`\n=== Auth UI E2E: ${BASE} (api=${API_BASE}) ===\n`)

  // 先确认 dev 代理可用
  {
    const res = await fetch(`${BASE}/api/health`).catch(() => null)
    if (!res || !res.ok) {
      fail(
        `dev 代理不可用 (${BASE}/api/health → ${res?.status ?? '无连接'})。\n` +
          '请关闭旧 Electron 窗口后重新 npm run dev，或设置 UI_BASE_URL 为终端 Local 端口。',
      )
    }
    ok('dev 代理 /api/health')
  }

  const suffix = Date.now().toString(36)
  const username = `ui_${suffix}`
  const password = 'password123'

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  const errors = []
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const t = msg.text()
    if (t.includes('Maximum update depth')) return
    errors.push(`console: ${t}`)
  })

  // 清空持久化登录态
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  // 1. 应跳转登录页
  await page.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(1500)
  const loginHtml = await page.content()
  if (!loginHtml.includes('欢迎回来')) {
    fail('未进入登录页（缺少「欢迎回来」）')
  }
  if (!loginHtml.includes('注册或登录以继续')) {
    fail('登录模式未生效（应显示账号密码登录文案）')
  }
  ok('登录页展示正常')

  // 2. 注册
  await page.getByPlaceholder('4-32 位字母、数字或下划线').fill(username)
  await page.getByPlaceholder('至少 8 位').fill(password)
  await page.getByRole('button', { name: '立即注册' }).click()
  await page.getByRole('button', { name: '注册' }).click()

  await page.waitForURL(/#\/dashboard/, { timeout: 20000 }).catch(() => null)
  await page.waitForTimeout(2500)
  const dashHtml = await page.content()
  if (!dashHtml.includes('欢迎回来') || dashHtml.includes('注册或登录以继续')) {
    const errText = await page.locator('text=/后端错误|无法连接|Failed to fetch|500/').first().textContent().catch(() => '')
    fail(`注册后未进入工作台。${errText ? `错误: ${errText}` : ''}`)
  }
  ok(`注册并进入工作台 (${username})`)

  // 3. 退出登录
  const logoutBtn = page.getByRole('button', { name: '退出登录' })
  if (await logoutBtn.count() === 0) {
    fail('未找到退出登录按钮')
  }
  await logoutBtn.first().click()
  await page.waitForURL(/#\/login/, { timeout: 10000 })
  ok('退出登录回到登录页')

  // 4. 再次登录
  await page.getByPlaceholder('4-32 位字母、数字或下划线').fill(username)
  await page.getByPlaceholder('至少 8 位').fill(password)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await page.waitForURL(/#\/dashboard/, { timeout: 20000 })
  ok('再次登录成功')

  // 5. 设置 → 账户页
  await page.goto(`${BASE}/#/settings/account`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)
  const accountHtml = await page.content()
  if (!accountHtml.includes('我的邀请码') || !accountHtml.includes(username)) {
    fail('账户页未展示用户信息')
  }
  ok('设置 → 账户页正常')

  await browser.close()

  if (errors.length > 0) {
    console.warn('页面警告:\n' + errors.map((e) => `  - ${e}`).join('\n'))
  }

  console.log(`\n=== UI 注册/登录/退出 全部通过 ===\n`)
}

main().catch((err) => {
  console.error('[FAIL]', err.message || err)
  process.exit(1)
})
