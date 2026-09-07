/**
 * Phase 5.3 / Step 2：T1–T8 客户端计费 HTTP 调用矩阵
 *
 * mock fetch + 真实 billing 入口，验证 Network 等价行为（无需 Electron / 手工 DevTools）。
 *
 * 用法：npm run smoke:billing:calls
 */
import assert from 'node:assert/strict'

import { consumeHaodouIfNeeded } from '@/lib/auth/haodou-consume-service'
import { runWithHaodouConsume } from '@/lib/auth/haodou-generation-guard'
import { chargeVideoConsumptionForTask } from '@/lib/auth/video-consumption-service'
import { callChatCompletionsWithMessages } from '@/lib/models/llm-client'
import { generateImage } from '@/lib/models/image-client'
import { proxySystemModelChat } from '@/lib/models/system-model-proxy'

import {
  customOpenAiLlm,
  customWeishiVideo,
  externalImage,
  externalLlm,
  HAODOU_VS_PROJECT_EXCLUSIVE,
  internalSeedance,
  internalSeedanceFast,
  videoCatalog,
} from './lib/billing-call-fixtures'
import {
  assertBillingLog,
  createDefaultBillingMocks,
  ensureNodeImportMetaEnv,
  runWithBillingHarness,
  seedAuthStore,
  seedBillingTestEnv,
  TEST_API_BASE,
  type MockFetchRule,
} from './lib/billing-test-harness'

const BILLING_PATHS = {
  consume: '/client/haodou/consume',
  refund: '/client/haodou/refund',
  chat: '/client/system-models/chat',
  image: '/client/system-models/image',
  videoConsumption: '/client/projects/video-consumption',
  projectConsumption: '/client/projects/consumption',
}

async function ok(name: string, fn: () => Promise<void>) {
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

function withExclusive(expect: Parameters<typeof assertBillingLog>[1]): Parameters<typeof assertBillingLog>[1] {
  return {
    ...expect,
    mutuallyExclusive: [...(expect.mutuallyExclusive ?? []), HAODOU_VS_PROJECT_EXCLUSIVE],
  }
}

async function main() {
  ensureNodeImportMetaEnv()
  console.log('Phase 5.3 billing HTTP call matrix (T1–T8)\n')

  await ok('T1：外部 + external LLM → consume → chat，无项目统计', async () => {
    const { calls } = await runWithBillingHarness(async ({ apiBase }) => {
      seedBillingTestEnv({ apiBase, videoCatalog })
      seedAuthStore({ isInternal: false })

      const content = await callChatCompletionsWithMessages(
        externalLlm,
        [{ role: 'user', content: 'hello' }],
      )
      assert.equal(content, 'ok')
    })

    assertBillingLog(
      calls,
      withExclusive({
        includes: [BILLING_PATHS.consume, BILLING_PATHS.chat],
        orderBefore: [[BILLING_PATHS.consume, BILLING_PATHS.chat]],
        excludes: [BILLING_PATHS.videoConsumption, BILLING_PATHS.projectConsumption],
      }),
    )
  })

  await ok('T2：内部 + external LLM + org → 仅好豆，无项目统计', async () => {
    const { calls } = await runWithBillingHarness(async ({ apiBase }) => {
      seedBillingTestEnv({ apiBase, videoCatalog })
      seedAuthStore({ isInternal: true })

      await callChatCompletionsWithMessages(externalLlm, [{ role: 'user', content: 'hello' }])
    })

    assertBillingLog(
      calls,
      withExclusive({
        includes: [BILLING_PATHS.consume, BILLING_PATHS.chat],
        excludes: [BILLING_PATHS.videoConsumption, BILLING_PATHS.projectConsumption],
      }),
    )
  })

  await ok('T3：内部 + 自定义微视 seedance-2.0 → 客户端不再上报 video-consumption', async () => {
    const custom = customWeishiVideo('seedance-2.0')
    const { calls, result } = await runWithBillingHarness(async ({ apiBase }) => {
      seedBillingTestEnv({ apiBase, videoCatalog })
      seedAuthStore({ isInternal: true })

      const charged = await chargeVideoConsumptionForTask({
        model: custom,
        taskId: 'probe-t3-video',
        durationSec: 5,
        provider: 'weishi',
        apiBase,
        systemCatalog: videoCatalog,
      })
      assert.equal(charged, false)
      return charged
    })

    assert.equal(result, false)
    assertBillingLog(
      calls,
      withExclusive({
        excludes: [BILLING_PATHS.consume, BILLING_PATHS.chat, BILLING_PATHS.image, BILLING_PATHS.videoConsumption],
      }),
    )
  })

  await ok('T4：内部 + internal Seedance catalog → 客户端不再上报 video-consumption', async () => {
    const { calls, result } = await runWithBillingHarness(async ({ apiBase }) => {
      seedBillingTestEnv({ apiBase, videoCatalog })
      seedAuthStore({ isInternal: true })

      const charged = await chargeVideoConsumptionForTask({
        model: internalSeedance,
        taskId: 'probe-t4-video',
        durationSec: 5,
        provider: 'weishi',
        apiBase,
      })
      assert.equal(charged, false)
      return charged
    })

    assert.equal(result, false)
    assertBillingLog(
      calls,
      withExclusive({
        excludes: [BILLING_PATHS.consume, BILLING_PATHS.videoConsumption],
      }),
    )
  })

  await ok('T5：内部 + 自定义微视 Fast（无 consumption）→ skip charge', async () => {
    const custom = customWeishiVideo('seedance-2.0-fast', 'custom-fast')
    const catalog = [internalSeedanceFast]
    const { calls, result } = await runWithBillingHarness(async ({ apiBase }) => {
      seedBillingTestEnv({ apiBase, videoCatalog: catalog })
      seedAuthStore({ isInternal: true })

      const charged = await chargeVideoConsumptionForTask({
        model: custom,
        taskId: 'probe-t5-video',
        durationSec: 5,
        provider: 'weishi',
        apiBase,
        systemCatalog: catalog,
      })
      assert.equal(charged, false)
      return charged
    })

    assert.equal(result, false)
    assertBillingLog(
      calls,
      withExclusive({
        excludes: [
          BILLING_PATHS.consume,
          BILLING_PATHS.videoConsumption,
          BILLING_PATHS.projectConsumption,
        ],
      }),
    )
  })

  await ok('T6：自定义 OpenAI → 无 billing HTTP', async () => {
    const custom = customOpenAiLlm()
    const { calls } = await runWithBillingHarness(async () => {
      seedAuthStore({ isInternal: true })
      const content = await callChatCompletionsWithMessages(custom, [{ role: 'user', content: 'ping' }])
      assert.equal(content, 'custom ok')
    })

    assertBillingLog(
      calls,
      withExclusive({
        includes: ['/v1/chat/completions'],
        excludes: [
          BILLING_PATHS.consume,
          BILLING_PATHS.videoConsumption,
          BILLING_PATHS.projectConsumption,
          BILLING_PATHS.chat,
        ],
      }),
    )
  })

    await ok('T7：未登录 + external → 不调用 consume', async () => {
    const { calls, result } = await runWithBillingHarness(async ({ apiBase }) => {
      seedBillingTestEnv({ apiBase, videoCatalog })
      seedAuthStore({ loggedIn: false })

      const consumed = await consumeHaodouIfNeeded({
        model: externalLlm,
        kind: 'llm',
        apiBase,
      })
      assert.equal(consumed, null)
      return consumed
    })

    assert.equal(result, null)
    assertBillingLog(calls, { excludes: [BILLING_PATHS.consume, BILLING_PATHS.refund] })
  })

  await ok('T8：内部 + external 生图 + org → consume_image → image 代理', async () => {
    const { calls } = await runWithBillingHarness(async ({ apiBase }) => {
      seedBillingTestEnv({ apiBase, videoCatalog })
      seedAuthStore({ isInternal: true })

      const url = await generateImage(
        externalImage,
        'a cat',
        '1024x1024',
        undefined,
        undefined,
        'consume_image',
      )
      assert.match(url, /mock\.png/)
    })

    assertBillingLog(
      calls,
      withExclusive({
        includes: [BILLING_PATHS.consume, BILLING_PATHS.image],
        orderBefore: [[BILLING_PATHS.consume, BILLING_PATHS.image]],
        excludes: [BILLING_PATHS.videoConsumption, BILLING_PATHS.projectConsumption],
      }),
    )
  })

  await ok('补充：代理失败 → 已扣好豆则 refund', async () => {
    const failingChatMock: MockFetchRule = {
      match: BILLING_PATHS.chat,
      handler: () => ({
        json: { code: 500, message: 'probe proxy failure' },
      }),
    }

    const { calls } = await runWithBillingHarness(
      async ({ apiBase }) => {
        seedBillingTestEnv({ apiBase, videoCatalog })
        seedAuthStore({ isInternal: false })

        await assert.rejects(
          () =>
            runWithHaodouConsume(
              { model: externalLlm, kind: 'llm', apiBase },
              () =>
                proxySystemModelChat({
                  modelKey: externalLlm.modelKey!,
                  prompt: 'fail me',
                  apiBase,
                }),
            ),
          /probe proxy failure|系统模型代理请求失败/,
        )
      },
      {
        apiBase: TEST_API_BASE,
        mocks: [failingChatMock, ...createDefaultBillingMocks()],
      },
    )

    assertBillingLog(calls, {
      includes: [BILLING_PATHS.consume, BILLING_PATHS.refund],
      orderBefore: [[BILLING_PATHS.consume, BILLING_PATHS.refund]],
    })
  })

  if (process.exitCode) {
    console.error('\nPhase 5.3 billing call matrix 失败')
    process.exit(process.exitCode)
  }

  console.log('\nPhase 5.3 billing call matrix 全部通过（T1–T8 + refund）')
  console.log('全自动验收: npm run verify:billing')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
