/**
 * 主进程 IPC 路径 / URL 边界校验（防目录穿越、任意文件读、SSRF）
 */
import path from 'node:path'
import fs from 'node:fs/promises'
import { app } from 'electron'
import { fromLocalImageUrl, isLocalImageUrl, resolveProjectMediaPath } from '../../src/lib/storage/media-path-resolver'
import { resolveDefaultWorkflowDir } from '../../src/lib/storage/storage-path-utils'
import { readSettingsMerged } from './ipc-settings'

const DRAG_DIR_NAME = 'lc-capcut-drag'

export async function getDataRootPath(): Promise<string> {
  const { data, ctx } = await readSettingsMerged()
  const dataRoot = path.resolve(data.dataRootPath || ctx.dataRoot || '')
  if (!dataRoot) throw new Error('未配置数据根目录')
  return dataRoot
}

export async function assertPathUnderDataRoot(absolutePath: string): Promise<string> {
  const dataRoot = await getDataRootPath()
  const resolved = path.resolve(absolutePath)
  const relative = path.relative(dataRoot, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('路径不在数据目录内')
  }
  return resolved
}

/** 解析项目内媒体路径；绝对路径必须在 dataRoot 下 */
export async function resolveReadableMediaPath(
  input: string,
  options?: { projectRoot?: string },
): Promise<string> {
  const trimmed = String(input || '').trim()
  if (!trimmed) throw new Error('缺少文件路径')

  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    throw new Error('不支持通过 IPC 读取远程 URL')
  }

  let candidate = isLocalImageUrl(trimmed) ? fromLocalImageUrl(trimmed) : trimmed

  if (options?.projectRoot) {
    const resolved = resolveProjectMediaPath(candidate, options.projectRoot)
    if (resolved && resolved !== candidate) {
      candidate = resolved
    }
  }

  if (!path.isAbsolute(candidate)) {
    const { data, ctx } = await readSettingsMerged()
    const dataRoot = data.dataRootPath || ctx.dataRoot
    const projectMatch = candidate.replace(/\\/g, '/').match(/wf_[^/]+/i)
    if (dataRoot && projectMatch) {
      const workflowRoot = resolveDefaultWorkflowDir(dataRoot)
      const projectRoot = path.join(workflowRoot, projectMatch[0])
      const resolved = resolveProjectMediaPath(candidate, projectRoot)
      if (resolved) candidate = resolved
    }
  }

  return assertPathUnderDataRoot(candidate)
}

/** 仅允许 http(s) URL；默认禁止内网（防 SSRF）。本机/内网视频 API 成片下载可显式放开。 */
export function isPrivateHttpHostname(hostname: string): boolean {
  const host = String(hostname || '').trim().toLowerCase()
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  )
}

/** localhost / 127.0.0.1 / ::1 视为同一环回主机（保留端口） */
export function normalizeLoopbackOrigin(originOrUrl: string): string {
  const raw = String(originOrUrl || '').trim()
  if (!raw) return ''
  try {
    const href = raw.includes('://') ? raw : `http://${raw}`
    const parsed = new URL(href)
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      parsed.hostname = '127.0.0.1'
    }
    return parsed.origin
  } catch {
    return raw
  }
}

export function tryParseHttpOrigin(raw: string): string {
  const text = String(raw || '').trim()
  if (!text) return ''
  try {
    const href = text.includes('://') ? text : `https://${text}`
    return new URL(href).origin
  } catch {
    return ''
  }
}

export function assertHttpFetchUrl(
  rawUrl: string,
  options?: {
    allowPrivateNetwork?: boolean
    /** @deprecated 使用 trustedOrigins；保留兼容单值 */
    trustedApiBaseUrl?: string
    trustedOrigins?: string[]
  },
): string {
  const url = String(rawUrl || '').trim()
  if (!url) throw new Error('缺少下载 URL')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('无效的下载 URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('仅支持 http/https 下载地址')
  }
  if (isPrivateHttpHostname(parsed.hostname)) {
    const trustedList = [
      ...(options?.trustedOrigins || []),
      options?.trustedApiBaseUrl || '',
    ]
      .map((item) => normalizeLoopbackOrigin(tryParseHttpOrigin(item) || item))
      .filter(Boolean)
    const target = normalizeLoopbackOrigin(parsed.origin)
    if (!trustedList.includes(target)) {
      throw new Error('不允许访问内网地址')
    }
  }
  return parsed.toString()
}

/** 拖拽文件必须位于 dataRoot 或应用 temp 拖拽缓存目录 */
export async function assertDragFilePath(filePath: string): Promise<string> {
  const resolved = path.resolve(String(filePath || '').trim())
  if (!resolved) throw new Error('缺少拖拽文件路径')

  const dragDir = path.join(app.getPath('temp'), DRAG_DIR_NAME)
  const relDrag = path.relative(dragDir, resolved)
  const inDragDir = relDrag && !relDrag.startsWith('..') && !path.isAbsolute(relDrag)

  if (inDragDir) return resolved
  return assertPathUnderDataRoot(resolved)
}

export async function assertWritableDirUnderDataRoot(dirPath: string): Promise<string> {
  const resolved = await assertPathUnderDataRoot(dirPath)
  await fs.mkdir(resolved, { recursive: true })
  return resolved
}

/** 用户通过系统对话框选择的目标目录（允许数据根目录外） */
export async function assertWritableUserDirectory(dirPath: string): Promise<string> {
  const resolved = path.resolve(String(dirPath || '').trim())
  if (!resolved) throw new Error('缺少目标目录')
  await fs.mkdir(resolved, { recursive: true })
  const stat = await fs.stat(resolved)
  if (!stat.isDirectory()) throw new Error('目标路径不是目录')
  return resolved
}
