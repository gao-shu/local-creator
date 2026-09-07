/**
 * 微信登录页联调：模拟旧 localStorage 花生壳地址，验证能连本地 Docker API
 * 用法: UI_BASE_URL=http://localhost:5175 node scripts/test-wechat-login.mjs
 */
import { chromium } from 'playwright'

const BASE = process.env.UI_BASE_URL || 'http://localhost:5175'

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  await context.addInitScript(() => {
    localStorage.setItem('haode_api_base', 'https://strengths-img-isolation-impressed.trycloudflare.com')
  })
  const page = await context.newPage()
  const apiRequests = []
  page.on('request', (req) => {
    if (req.url().includes('wechat/session')) apiRequests.push(req.url())
  })

  await page.goto(`${BASE}/#/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(6000)

  const body = await page.innerText('body')
  const hasFailed = body.includes('Failed to fetch') || body.includes('无法连接后端')
  const qrImg = page.locator('img[alt="微信登录二维码"]')
  const hasQr = (await qrImg.count()) > 0
  const qrSrc = hasQr ? await qrImg.getAttribute('src') : ''

  console.log('--- wechat login test ---')
  console.log('hasFailed:', hasFailed)
  console.log('hasQr:', hasQr)
  console.log('session API calls:', apiRequests)
  console.log('qrSrc prefix:', qrSrc?.slice(0, 100) ?? '')

  const errors = []
  if (hasFailed) errors.push('页面仍显示连接失败')
  if (!hasQr) errors.push('未渲染二维码图片')
  if (!apiRequests.some((u) => u.includes('/api/client/auth/wechat/session'))) {
    errors.push(`未请求 session API，实际: ${apiRequests.join(', ') || '无'}`)
  }
  if (!qrSrc?.includes('qrserver.com')) errors.push('二维码 URL 异常')

  await browser.close()

  if (errors.length) {
    console.error('失败:\n' + errors.map((e) => `  - ${e}`).join('\n'))
    process.exit(1)
  }
  console.log('微信登录 QR 获取成功')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
