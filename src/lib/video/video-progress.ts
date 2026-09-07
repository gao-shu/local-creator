/** 生视频轮询进度（所有 provider 共用） */
export interface VideoGenerationProgress {
  message: string
  progress?: number
  status?: string
}

export type VideoProgressCallback = (update: VideoGenerationProgress) => void

const VIDEO_STATUS_LABEL: Record<string, string> = {
  queued: '排队中',
  pending: '排队中',
  queue: '排队中',
  submitting: '提交中',
  processing: '生成中',
  running: '生成中',
  in_progress: '生成中',
  process: '生成中',
  // 轮询 done/100% 只表示远端任务结束，本地还要拉成片；勿用「已完成」以免误以为可播放
  completed: '生成完成',
  success: '生成完成',
  succeeded: '生成完成',
  done: '生成完成',
  failed: '失败',
  fail: '失败',
  error: '失败',
  expired: '已过期',
  cancelled: '已取消',
  canceled: '已取消',
}

export const VIDEO_PROGRESS_CREATING: VideoGenerationProgress = { message: '创建视频任务…' }
export const VIDEO_PROGRESS_UPLOADING: VideoGenerationProgress = { message: '上传参考素材…' }
/**
 * 系统模型等同步/异步代理：已开始请求、尚未返回成片。
 * 不定进度（勿写假 10%）；圆环显示「…」。
 */
export const VIDEO_PROGRESS_SUBMITTING: VideoGenerationProgress = {
  message: '提交中…',
  status: 'submitting',
}
/** 本地/远端并发位已满、尚未占到槽（不定进度，勿写假 %） */
export const VIDEO_PROGRESS_QUEUED: VideoGenerationProgress = {
  message: '排队中…',
  status: 'queued',
}

export function formatVideoQueuedProgress(position: number): VideoGenerationProgress {
  const n = Number.isFinite(position) && position > 0 ? Math.floor(position) : 1
  return {
    message: `排队中（第 ${n} 位）`,
    status: 'queued',
  }
}
/** 重开画布 / 恢复任务前的占位，避免残留「上传参考素材」误导；不定进度用省略号（勿写假 0%） */
export const VIDEO_PROGRESS_REOPEN_PLACEHOLDER: VideoGenerationProgress = {
  message: '生成中…',
  status: 'running',
}
export const VIDEO_PROGRESS_SUBMITTED: VideoGenerationProgress = {
  message: '任务已提交，等待生成…',
  progress: 0,
  status: 'queued',
}
/** 远端轮询结束且已有可下载地址：即将进入本地落盘 */
export const VIDEO_PROGRESS_COMPLETED: VideoGenerationProgress = {
  message: '生成完成，准备下载 100%',
  progress: 100,
  status: 'completed',
}

/** 远端已 done，但成片 URL 尚未就绪（中转偶发滞后） */
export const VIDEO_PROGRESS_WAITING_CONTENT: VideoGenerationProgress = {
  message: '生成完成，等待成片地址 100%',
  progress: 100,
  status: 'waiting_content',
}

/** 正在 GET …/content 并写入本地 */
export const VIDEO_PROGRESS_DOWNLOADING: VideoGenerationProgress = {
  message: '正在下载成片 100%',
  progress: 100,
  status: 'downloading',
}

export function clampVideoProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

/**
 * 将 API 进度规范为 0–100。
 * 兼容 0–1 小数（如 0.42 → 42）；整数 0–100 原样保留（避免把 1% 误乘成 100%）。
 */
export function normalizeVideoProgressPercent(value: number): number | undefined {
  if (!Number.isFinite(value) || value < 0) return undefined
  let pct = value
  if (value > 0 && value <= 1 && !Number.isInteger(value)) {
    pct = value * 100
  }
  return clampVideoProgress(pct)
}

/** 准备阶段文案：重开时不应当成全程进度（由 reopen 路径改写占位） */
export function isMisleadingVideoPrepProgressMessage(message?: string | null): boolean {
  const text = String(message || '').trim()
  if (!text) return true
  if (text.includes('上传参考素材')) return true
  if (text === '创建视频任务…' || text === '创建视频任务') return true
  return false
}

/**
 * running 节点展示用进度文案。
 * 进行中保留「上传参考素材 / 创建视频任务」等真实阶段；空文案才用重开占位。
 * （勿把准备阶段统一改成假「生成中 0%」，否则看起来一直卡在 0%）
 */
export function resolveRunningVideoProgressMessageForUi(
  progressMessage?: string | null,
): string {
  const text = String(progressMessage || '').trim()
  if (!text) return VIDEO_PROGRESS_REOPEN_PLACEHOLDER.message
  // 历史/残留「已完成」在仍 running 时改为等待语义，减少误解
  if (/^已完成\s*100%?$/.test(text) || text === '已完成') {
    return VIDEO_PROGRESS_WAITING_CONTENT.message
  }
  // 轮询 done 的「生成完成 100%」若仍挂在遮罩上，说明尚未进入落盘——勿让用户以为已经可播
  if (/^生成完成\s*100%?$/.test(text) || text === '生成完成') {
    return VIDEO_PROGRESS_COMPLETED.message
  }
  if (text.includes('正在下载成片') && text.includes('生成完成')) {
    return VIDEO_PROGRESS_WAITING_CONTENT.message
  }
  return text
}

function normalizeStatusKey(status: string): string {
  return status.trim().toLowerCase().replace(/-/g, '_')
}

export function isVideoTaskSuccess(status: string): boolean {
  const s = normalizeStatusKey(status)
  return s === 'completed' || s === 'success' || s === 'succeeded' || s === 'done'
}

export function isVideoTaskFailed(status: string): boolean {
  const s = normalizeStatusKey(status)
  return (
    s === 'failed' ||
    s === 'fail' ||
    s === 'cancelled' ||
    s === 'canceled' ||
    s === 'error' ||
    s === 'expired'
  )
}

/** 从轮询 JSON 解析 status / progress / error（兼容微视、智谱、OpenAI 兼容、Agnes 格式） */
export function parseVideoPollPayload(payload: Record<string, unknown>): {
  status: string
  progress?: number
  error?: string
} {
  // data 非对象时不当嵌套状态读（避免误读非标准信封）
  const nested =
    payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
      ? (payload.data as Record<string, unknown>)
      : undefined
  const status = String(
    payload.status ??
      nested?.status ??
      payload.task_status ??
      nested?.task_status ??
      '',
  ).trim()
  // Agnes：顶层 status 偶发仍为 queued，但 internal_status 已是 completed
  const internalStatus = String(
    payload.internal_status ?? nested?.internal_status ?? '',
  ).trim()
  const effectiveStatus =
    isVideoTaskSuccess(internalStatus) && !isVideoTaskSuccess(status)
      ? internalStatus
      : status || internalStatus

  const topProgress = Number(
    payload.progress ?? nested?.progress ?? payload.percent ?? nested?.percent,
  )
  const internalProgress = Number(
    payload.internal_progress ?? nested?.internal_progress,
  )
  // 顶层 progress=0 且 internal 已完成时，取 internal_progress
  let rawProgress = topProgress
  if (
    isVideoTaskSuccess(effectiveStatus) &&
    (!Number.isFinite(topProgress) || topProgress < 100) &&
    Number.isFinite(internalProgress)
  ) {
    rawProgress = internalProgress
  } else if (!Number.isFinite(topProgress) && Number.isFinite(internalProgress)) {
    rawProgress = internalProgress
  }

  const errObj = (payload.error ?? nested?.error) as
    | { message?: string; code?: string }
    | string
    | undefined
  return {
    status: effectiveStatus,
    progress: Number.isFinite(rawProgress) ? normalizeVideoProgressPercent(rawProgress) : undefined,
    error:
      typeof errObj === 'string'
        ? errObj
        : String(errObj?.message ?? payload.message ?? nested?.message ?? '').trim() ||
          undefined,
  }
}

/** 解析 API 返回的进度；无真实进度时不造假（智谱等仅返回 task_status） */
export function resolveVideoPollProgress(
  status: string,
  explicit?: number,
  _pollRound = 0,
): number | undefined {
  if (explicit != null && Number.isFinite(explicit)) {
    return normalizeVideoProgressPercent(explicit)
  }
  if (isVideoTaskSuccess(status)) return 100
  if (isVideoTaskFailed(status)) return 100
  return undefined
}

/** 将任务 status + progress 格式化为用户可读中文 */
export function formatVideoTaskProgress(
  status: string,
  progress?: number,
  pollRound = 0,
): VideoGenerationProgress {
  const resolved = resolveVideoPollProgress(status, progress, pollRound)
  // 仅在远端任务成功时提示收尾语义；真正下载由上层 VIDEO_PROGRESS_DOWNLOADING 覆盖
  if (isVideoTaskSuccess(status)) {
    return { ...VIDEO_PROGRESS_COMPLETED, progress: 100, status: status || 'completed' }
  }
  const key = normalizeStatusKey(status)
  const label = VIDEO_STATUS_LABEL[key] || (status ? status : '生成中')
  const message = resolved != null ? `${label} ${Math.round(resolved)}%` : `${label}…`
  return {
    message,
    progress: resolved,
    status: status || undefined,
  }
}

/** 拆分「镜号 N：状态」类进度文案，避免 UI 单行堆叠重叠 */
export function splitVideoProgressMessage(message: string): {
  shotLabel?: string
  statusText: string
} {
  const trimmed = message.trim()
  if (!trimmed) return { statusText: '视频生成中…' }
  const colonMatch = trimmed.match(/^镜号\s*(\d+)\s*[：:]\s*(.+)$/)
  if (colonMatch) {
    return { shotLabel: `镜号 ${colonMatch[1]}`, statusText: colonMatch[2].trim() }
  }
  const spaceMatch = trimmed.match(/^镜号\s*(\d+)\s+(.+)$/)
  if (spaceMatch) {
    return { shotLabel: `镜号 ${spaceMatch[1]}`, statusText: spaceMatch[2].trim() }
  }
  return { statusText: trimmed }
}
