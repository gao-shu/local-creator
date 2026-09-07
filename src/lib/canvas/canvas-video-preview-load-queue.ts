// Copyright (c) Haode AI. All rights reserved.

/**
 * 画布视频节点 `<video>` 预览加载限流。
 * 打开大画布时避免同时解码过多本地 mp4 导致后半段永远黑块。
 */

/** 同时开始挂 src 的视频路数（拿到元数据后会尽快释放，不长期占满） */
export const CANVAS_VIDEO_PREVIEW_LOAD_CONCURRENCY = 3

/** 单路加载超时（超时释放名额并提示重试） */
export const CANVAS_VIDEO_PREVIEW_LOAD_TIMEOUT_MS = 20_000

/** 挂上 src 后最迟多久释放名额，避免慢解码卡住整队 */
export const CANVAS_VIDEO_PREVIEW_SLOT_SOFT_RELEASE_MS = 1_200

type Waiter = {
  id: string
  priority: number
  seq: number
  resolvers: Array<() => void>
}

const activeIds = new Set<string>()
const waiters: Waiter[] = []
let seqCounter = 0

function sortWaiters() {
  waiters.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return a.seq - b.seq
  })
}

function resolveWaiter(waiter: Waiter) {
  for (const resolve of waiter.resolvers) resolve()
  waiter.resolvers = []
}

function pumpQueue() {
  while (activeIds.size < CANVAS_VIDEO_PREVIEW_LOAD_CONCURRENCY && waiters.length > 0) {
    sortWaiters()
    const next = waiters.shift()
    if (!next) break
    if (activeIds.has(next.id)) {
      resolveWaiter(next)
      continue
    }
    activeIds.add(next.id)
    resolveWaiter(next)
  }
}

/** 申请加载名额；已在 active 中则立即返回 */
export function requestCanvasVideoPreviewLoadSlot(
  id: string,
  priority = 0,
): Promise<void> {
  const key = String(id || '').trim()
  if (!key) return Promise.resolve()
  if (activeIds.has(key)) return Promise.resolve()

  const existing = waiters.find((item) => item.id === key)
  if (existing) {
    if (priority > existing.priority) existing.priority = priority
    return new Promise<void>((resolve) => {
      existing.resolvers.push(resolve)
      pumpQueue()
    })
  }

  if (activeIds.size < CANVAS_VIDEO_PREVIEW_LOAD_CONCURRENCY) {
    activeIds.add(key)
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    waiters.push({
      id: key,
      priority,
      seq: ++seqCounter,
      resolvers: [resolve],
    })
    pumpQueue()
  })
}

/** 释放名额（加载完成 / 失败 / 卸载时调用） */
export function releaseCanvasVideoPreviewLoadSlot(id: string): void {
  const key = String(id || '').trim()
  if (!key) return

  const waitingIdx = waiters.findIndex((item) => item.id === key)
  if (waitingIdx >= 0) {
    const [removed] = waiters.splice(waitingIdx, 1)
    if (removed) resolveWaiter(removed)
  }

  if (activeIds.delete(key)) {
    pumpQueue()
  }
}

/** 提升排队优先级（例如节点进入视口 / 用户点击） */
export function bumpCanvasVideoPreviewLoadPriority(id: string, priority: number): void {
  const key = String(id || '').trim()
  if (!key) return
  const waiter = waiters.find((item) => item.id === key)
  if (!waiter) return
  if (priority > waiter.priority) {
    waiter.priority = priority
    pumpQueue()
  }
}

/** 测试 / 调试：清空队列状态 */
export function resetCanvasVideoPreviewLoadQueueForTests(): void {
  activeIds.clear()
  waiters.length = 0
  seqCounter = 0
}
