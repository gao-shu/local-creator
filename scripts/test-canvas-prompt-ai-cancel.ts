/**
 * 画布智能分镜 / 提取资产：取消后禁止落盘回归
 *   npx --yes tsx scripts/test-canvas-prompt-ai-cancel.ts
 */
import assert from 'node:assert/strict'
import {
  canPersistCanvasPromptAiResult,
  delayWithAbortSignal,
  isCanvasPromptAiAbortError,
  shouldPersistCanvasPromptAiResult,
} from '../src/lib/canvas/canvas-prompt-ai-cancel'

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`✓ ${name}`)
    })
}

/** 对齐 executeCanvasPrompt*Task 落盘前二次门闸 */
function decidePersistAfterLlmReturn(inflight: {
  cancelled: boolean
  abortController: AbortController
}): { shouldPersist: boolean; cancelled: boolean } {
  const signal = inflight.abortController.signal
  if (signal.aborted) inflight.cancelled = true
  const shouldPersist = canPersistCanvasPromptAiResult({
    cancelled: inflight.cancelled,
    signal,
  })
  return { shouldPersist, cancelled: inflight.cancelled }
}

async function main() {
  await test('shouldPersist：未取消可写，取消禁止写', () => {
    assert.equal(shouldPersistCanvasPromptAiResult(false), true)
    assert.equal(shouldPersistCanvasPromptAiResult(true), false)
  })

  await test('canPersist：cancelled 或 aborted 任一成立则禁止写', () => {
    const live = new AbortController()
    assert.equal(canPersistCanvasPromptAiResult({ cancelled: false, signal: live.signal }), true)
    assert.equal(canPersistCanvasPromptAiResult({ cancelled: true, signal: live.signal }), false)

    const aborted = new AbortController()
    aborted.abort()
    assert.equal(canPersistCanvasPromptAiResult({ cancelled: false, signal: aborted.signal }), false)
    assert.equal(canPersistCanvasPromptAiResult({ cancelled: true, signal: aborted.signal }), false)
    assert.equal(canPersistCanvasPromptAiResult({ cancelled: false }), true)
  })

  await test('isCanvasPromptAiAbortError 识别 AbortError / 文案', () => {
    assert.equal(isCanvasPromptAiAbortError(new DOMException('已取消', 'AbortError')), true)
    assert.equal(isCanvasPromptAiAbortError(Object.assign(new Error('aborted'), { name: 'AbortError' })), true)
    assert.equal(isCanvasPromptAiAbortError(new Error('智能分镜已取消')), true)
    assert.equal(isCanvasPromptAiAbortError(new Error('网络超时')), false)
    assert.equal(isCanvasPromptAiAbortError(null), false)
  })

  await test('delayWithAbortSignal：中途 abort 抛 AbortError', async () => {
    const ac = new AbortController()
    const pending = delayWithAbortSignal(5_000, ac.signal)
    ac.abort()
    await assert.rejects(pending, (error: unknown) => isCanvasPromptAiAbortError(error))
  })

  await test('delayWithAbortSignal：已 aborted 则立即拒绝', async () => {
    const ac = new AbortController()
    ac.abort()
    await assert.rejects(delayWithAbortSignal(100, ac.signal), (error: unknown) =>
      isCanvasPromptAiAbortError(error),
    )
  })

  await test('竞态：LLM 已返回后再 cancel/abort → 仍禁止落盘（不覆盖/追加）', () => {
    // 模拟：请求未 abort 标，仅 cancelled 标记（任务面板取消与 abort 竞态）
    const byFlag = {
      cancelled: false,
      abortController: new AbortController(),
    }
    // 「LLM 返回」瞬间用户点了取消
    byFlag.cancelled = true
    const afterFlag = decidePersistAfterLlmReturn(byFlag)
    assert.equal(afterFlag.shouldPersist, false)
    assert.equal(afterFlag.cancelled, true)

    // 模拟：仅 abort（cancelPromptAi 路径）
    const byAbort = {
      cancelled: false,
      abortController: new AbortController(),
    }
    byAbort.abortController.abort()
    const afterAbort = decidePersistAfterLlmReturn(byAbort)
    assert.equal(afterAbort.shouldPersist, false)
    assert.equal(afterAbort.cancelled, true)

    // 未取消：允许落盘
    const ok = {
      cancelled: false,
      abortController: new AbortController(),
    }
    const afterOk = decidePersistAfterLlmReturn(ok)
    assert.equal(afterOk.shouldPersist, true)
    assert.equal(afterOk.cancelled, false)
  })

  console.log('\n全部通过：取消后门闸可阻止迟到结果写入画布')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
