// Copyright (c) Haode AI. All rights reserved.

/** F5 / HMR 后内存 inflight 丢失，用 sessionStorage 防止重复恢复轮询 */
const RESUME_LOCK_PREFIX = 'haode:video:resume-lock:'
const RESUME_LOCK_TTL_MS = 10 * 60 * 1000

function lockKey(source: 'workflow' | 'canvas', projectId: string, entityId: string): string {
  return `${RESUME_LOCK_PREFIX}${source}:${projectId}:${entityId}`
}

function readLockTs(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const ts = Number(raw)
    if (!Number.isFinite(ts)) return null
    if (Date.now() - ts > RESUME_LOCK_TTL_MS) {
      sessionStorage.removeItem(key)
      return null
    }
    return ts
  } catch {
    return null
  }
}

export function tryAcquireVideoResumeLock(
  source: 'workflow' | 'canvas',
  projectId: string,
  entityId: string,
): boolean {
  const key = lockKey(source, projectId, entityId)
  if (readLockTs(key) != null) return false
  try {
    sessionStorage.setItem(key, String(Date.now()))
    return true
  } catch {
    return true
  }
}

export function releaseVideoResumeLock(
  source: 'workflow' | 'canvas',
  projectId: string,
  entityId: string,
): void {
  try {
    sessionStorage.removeItem(lockKey(source, projectId, entityId))
  } catch {
    /* ignore */
  }
}

export function hasVideoResumeLock(
  source: 'workflow' | 'canvas',
  projectId: string,
  entityId: string,
): boolean {
  return readLockTs(lockKey(source, projectId, entityId)) != null
}
