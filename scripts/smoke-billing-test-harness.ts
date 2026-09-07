/**
 * Step 1：billing-test-harness 自检
 *
 * 用法：npm run smoke:billing:harness
 */
import assert from 'node:assert/strict'

import {
  assertBillingLog,
  createDefaultBillingMocks,
  FetchRecorder,
  normalizeApiPath,
  resetAuthStore,
  runWithBillingHarness,
  seedAuthStore,
} from './lib/billing-test-harness'

async function ok(name: string, fn: () => void | Promise<void>) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`  ✗ ${name}`)
    console.error(`    ${message}`)
    process.exitCode = 1
  }
}

async function main() {
  await ok('normalizeApiPath：剥离 apiBase', () => {
    const base = 'https://billing-test.example/api'
    assert.equal(normalizeApiPath(`${base}/client/haodou/consume`, base), '/client/haodou/consume')
    assert.equal(
      normalizeApiPath('https://other.host/client/models?q=1', base),
      '/client/models?q=1',
    )
  })

  await ok('FetchRecorder：记录顺序与 mock 响应', async () => {
    const apiBase = 'https://billing-test.example/api'
    const recorder = new FetchRecorder({ apiBase, mocks: createDefaultBillingMocks() })
    recorder.install()
    try {
      seedAuthStore({ isInternal: false, bells: 20 })

      const consumeRes = await fetch(`${apiBase}/client/haodou/consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_key: 'x', reason: 'consume_script', quantity: 1 }),
      })
      const consumeJson = (await consumeRes.json()) as { code?: number }
      assert.equal(consumeJson.code, 0)

      const chatRes = await fetch(`${apiBase}/client/system-models/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_key: 'x', messages: [] }),
      })
      const chatJson = (await chatRes.json()) as { code?: number }
      assert.equal(chatJson.code, 0)

      assert.equal(recorder.recordedCalls.length, 2)
      assertBillingLog(recorder.recordedCalls, {
        includes: ['/client/haodou/consume', '/client/system-models/chat'],
        orderBefore: [['/client/haodou/consume', '/client/system-models/chat']],
        excludes: ['/client/projects/video-consumption'],
      })
    } finally {
      recorder.uninstall()
      resetAuthStore()
    }
  })

  await ok('assertBillingLog：互斥组检测', () => {
    const calls = [
      { order: 1, url: '', method: 'POST', path: '/client/haodou/consume', body: null },
      { order: 2, url: '', method: 'POST', path: '/client/projects/video-consumption', body: null },
    ]
    assert.throws(
      () =>
        assertBillingLog(calls, {
          mutuallyExclusive: [['/client/haodou/consume', '/client/projects/video-consumption']],
        }),
      /at most one/,
    )
  })

  await ok('seedAuthStore：未登录不写入 token', async () => {
    await runWithBillingHarness(async () => {
      seedAuthStore({ loggedIn: false })
      const { useAuthStore } = await import('@/stores/auth-store')
      const { token, user } = useAuthStore.getState()
      assert.equal(token, null)
      assert.equal(user, null)
      return true
    })
  })

  await ok('runWithBillingHarness：自动卸载 fetch 并恢复 auth', async () => {
    const beforeFetch = globalThis.fetch
    await runWithBillingHarness(async ({ apiBase }) => {
      seedAuthStore({ isInternal: true, bells: 99 })
      await fetch(`${apiBase}/client/haodou/consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_key: 'x', reason: 'consume_script', quantity: 1 }),
      })
      return 'done'
    })

    assert.equal(globalThis.fetch, beforeFetch)
  })

  if (process.exitCode) {
    console.error('\nbilling-test-harness smoke 失败')
    process.exit(process.exitCode)
  }
  console.log('\nbilling-test-harness smoke 全部通过（Step 1）')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
