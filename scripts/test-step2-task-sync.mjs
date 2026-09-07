/**
 * 分集页任务状态同步逻辑自测（无需启动 Electron）
 *   node scripts/test-step2-task-sync.mjs
 */
import assert from 'node:assert/strict'

function getActiveExtractTaskInline(tasks, sessionId = null) {
  const running = tasks.filter(
    (t) => t.type === 'extract' && (t.status === 'pending' || t.status === 'running'),
  )
  if (!running.length) return null
  if (!sessionId) return null
  return running.find((t) => t.id === sessionId) ?? null
}

function resolveStep2TaskUiStateInline(tasks, prev, sessionId = null) {
  const activeExtract = getActiveExtractTaskInline(tasks, sessionId)
  const extracting = Boolean(activeExtract)
  return {
    extracting,
    extractJustFinished: prev.extractWasActive && !extracting,
  }
}

function test(name, fn) {
  fn()
  console.log(`✓ ${name}`)
}

const now = Date.now()

test('无 session 时遗留 running 不算进行中', () => {
  const tasks = [
    { id: 'old', type: 'extract', status: 'running', createdAt: now, updatedAt: now },
  ]
  assert.equal(getActiveExtractTaskInline(tasks, null), null)
  const state = resolveStep2TaskUiStateInline(tasks, { extractWasActive: false }, null)
  assert.equal(state.extracting, false)
})

test('有 session 且任务 running 时算进行中', () => {
  const tasks = [
    { id: 't1', type: 'extract', status: 'running', createdAt: now, updatedAt: now },
  ]
  const state = resolveStep2TaskUiStateInline(tasks, { extractWasActive: false }, 't1')
  assert.equal(state.extracting, true)
})

test('任务 completed 后应恢复可点击', () => {
  const tasks = [
    { id: 't1', type: 'extract', status: 'completed', createdAt: now, updatedAt: now },
  ]
  const state = resolveStep2TaskUiStateInline(tasks, { extractWasActive: true }, 't1')
  assert.equal(state.extracting, false)
  assert.equal(state.extractJustFinished, true)
})

test('分集内容可作为剧本来源', () => {
  const text = ['', [{ content: '第一集内容' }, { content: '第二集' }]]
    .flat()
    .toString()
  assert.ok(typeof text === 'string')
  const merged = [{ content: '第一集内容' }, { content: '第二集' }]
    .map((ep) => ep.content.trim())
    .filter(Boolean)
    .join('\n\n')
  assert.equal(merged, '第一集内容\n\n第二集')
})

console.log('\n全部 step2 任务同步测试通过')
