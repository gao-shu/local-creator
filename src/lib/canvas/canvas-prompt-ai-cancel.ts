// Copyright (c) local-creator contributors. All rights reserved.

/** 取消后是否允许把智能分镜/提取资产结果写入画布（落盘与 UI） */
export function shouldPersistCanvasPromptAiResult(cancelled: boolean): boolean {
  return !cancelled
}

/** 落盘前总门闸：用户取消或 AbortSignal 任一成立则禁止写入 */
export function canPersistCanvasPromptAiResult(input: {
  cancelled: boolean
  signal?: AbortSignal
}): boolean {
  if (input.cancelled) return false
  if (input.signal?.aborted) return false
  return true
}

export function isCanvasPromptAiAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (error instanceof Error && (error.name === 'AbortError' || /aborted|已取消/i.test(error.message))) {
    return true
  }
  return false
}

/** 可中断的延迟（用于本地 mock 分镜等） */
export function delayWithAbortSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('已取消', 'AbortError'))
      return
    }
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('已取消', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
