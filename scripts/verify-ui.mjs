/**
 * UI 冒烟验证：需在 dev server 运行后执行
 *   终端 A: npm run dev
 *   终端 B: npm run verify:ui
 */
import { chromium } from 'playwright'

const BASE = process.env.UI_BASE_URL || 'http://localhost:15173'

const VERIFY_AUTH_STORAGE = JSON.stringify({
  state: {
    token: 'verify-ui-token',
    refreshToken: '',
    user: {
      id: 'verify-ui',
      username: 'verify-ui',
      nickname: 'UI验证',
      role: 'user',
      status: 'active',
      remaining_quota: 999999,
      free_quota: 999999,
      used_quota: 0,
      avatar_url: null,
    },
  },
  version: 0,
})

const routes = [
  { hash: '#/login', expect: '微信扫码登录', auth: false },
  { hash: '#/dashboard', expect: '欢迎回来' },
  { hash: '#/dashboard', expect: '最近项目' },
  { hash: '#/dashboard', expect: '无限画布' },
  { hash: '#/workshop', expect: '创作工坊' },
  { hash: '#/canvas', expect: '无限画布' },
  { hash: '#/canvas/cv_dev_preview', expect: '参数设置' },
  { hash: '#/canvas/cv_dev_preview', expect: '导出成片' },
  { hash: '#/canvas/cv_dev_preview', expect: '本集资产' },
  { hash: '#/canvas/cv_dev_preview', expect: '画布助手', clickText: '对话', agentSidebar: true },
  { hash: '#/canvas/cv_dev_preview', expect: '改图', clickText: '对话', agentSidebar: true },
  { hash: '#/settings', expect: '便携数据目录' },
  { hash: '#/settings/models', expect: '模型配置' },
  { hash: '#/materials', expect: '素材库' },
  { hash: '#/workshop/wf_dev_preview/step/1', expect: '导入文件' },
  { hash: '#/workshop/wf_dev_preview/step/1', expect: '50000' },
  { hash: '#/workshop/wf_dev_preview/step/2', expect: 'AI 分集并提取资产' },
  { hash: '#/workshop/wf_dev_preview/step/3', expect: '角色设定' },
  { hash: '#/workshop/wf_dev_preview/step/3', expect: '批量生成' },
  { hash: '#/workshop/wf_dev_preview/step/4', expect: '推理分镜' },
  { hash: '#/workshop/wf_dev_preview/step/4', expect: '导出至剪映' },
]

async function main() {
  const browser = await chromium.launch()
  const errors = []

  // 登录页：未登录态（本地模式会 GuestGuard 重定向到 dashboard）
  {
    const loginContext = await browser.newContext()
    const loginPage = await loginContext.newPage()
    loginPage.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
    await loginPage.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await loginPage.waitForTimeout(1500)
    const loginContent = await loginPage.content()
    const loginOk =
      loginContent.includes('微信扫码登录') || loginContent.includes('欢迎回来')
    if (!loginOk) {
      errors.push(
        '路由 #/login 未找到「微信扫码登录」（登录模式）或「欢迎回来」（本地模式重定向）',
      )
    }
    await loginContext.close()
  }

  const context = await browser.newContext()
  await context.addInitScript((storageJson) => {
    localStorage.setItem('auth-storage', storageJson)
    localStorage.setItem('token', 'verify-ui-token')
  }, VERIFY_AUTH_STORAGE)
  const page = await context.newPage()

  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (text.includes('Maximum update depth')) return
    errors.push(`console: ${text}`)
  })

  const protectedRoutes = routes.filter((r) => r.auth !== false)
  for (const route of protectedRoutes) {
    const { hash, expect: text, clickText } = route
    const url = `${BASE}/${hash}`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1200)
    if (clickText) {
      const trigger = page.getByRole('button', { name: clickText }).first()
      if (await trigger.count()) {
        await trigger.click()
        await page.waitForTimeout(clickText === '对话' ? 1200 : 600)
      }
    }
    const content = await page.content()
    if (!content.includes(text)) {
      errors.push(`路由 ${hash} 未找到文案「${text}」`)
    }
  }

  await browser.close()

  if (errors.length > 0) {
    console.error('UI 验证失败:\n' + errors.map((e) => `  - ${e}`).join('\n'))
    process.exit(1)
  }

  console.log(`UI 验证通过 (${routes.length} 个路由)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
