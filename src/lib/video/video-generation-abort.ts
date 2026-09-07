// Copyright (c) local-creator contributors. All rights reserved.

/** 用户主动停止工坊/分镜生视频 */
export class VideoGenerationCancelledError extends Error {
  constructor(message = '已停止生成') {
    super(message)
    this.name = 'VideoGenerationCancelledError'
  }
}

export function isVideoGenerationAbortError(error: unknown): boolean {
  if (error instanceof VideoGenerationCancelledError) return true
  return error instanceof DOMException && error.name === 'AbortError'
}

export function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new VideoGenerationCancelledError()
  }
}

export function delayWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new VideoGenerationCancelledError())
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new VideoGenerationCancelledError())
      },
      { once: true },
    )
  })
}

/** 合并用户取消 signal 与单次 fetch 超时 */
export function mergeFetchSignal(userSignal?: AbortSignal, timeoutMs?: number): AbortSignal | undefined {
  const parts: AbortSignal[] = []
  if (userSignal) parts.push(userSignal)
  if (timeoutMs != null && timeoutMs > 0) parts.push(AbortSignal.timeout(timeoutMs))
  if (parts.length === 0) return undefined
  if (parts.length === 1) return parts[0]
  return AbortSignal.any(parts)
}
