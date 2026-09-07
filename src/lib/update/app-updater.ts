export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'uptodate'
  | 'error'

export type UpdateDownloadMode = 'interactive' | 'background'

export interface UpdateProgress {
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
}

export interface CheckUpdatesResult {
  success: boolean
  error?: string
  /** macOS 仅手动 dmg 更新 */
  manualUpdateOnly?: boolean
  message?: string
  updateInfo?: { version?: string } | null
}

export interface UpdateStatusResult {
  success?: boolean
  checking?: boolean
  updateInfo?: { version?: string } | null
  error?: string | null
  checkedAt?: number
  currentVersion?: string
}

export function isElectronApp(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.isElectron)
}

/** 解析 x.y.z（忽略 v 前缀与 -prerelease），用于判断是否有可升级版本 */
function parseVersionParts(version: string): number[] {
  const core = version.trim().replace(/^v/i, '').split('-')[0] || ''
  return core.split('.').map((part) => Number.parseInt(part, 10) || 0)
}

/** 远程版本是否严格新于本地（相等或更旧均视为无更新） */
export function isRemoteVersionNewer(remote: string, local: string): boolean {
  if (!remote?.trim() || !local?.trim()) return false
  const remoteParts = parseVersionParts(remote)
  const localParts = parseVersionParts(local)
  const len = Math.max(remoteParts.length, localParts.length)
  for (let i = 0; i < len; i += 1) {
    const diff = (remoteParts[i] || 0) - (localParts[i] || 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, index)
  return `${value.toFixed(2)} ${units[index]}`
}
