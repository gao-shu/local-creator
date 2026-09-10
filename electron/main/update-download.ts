/**
 * 应用内更新下载：走 Chromium 下载栈（与浏览器同源多连接），替代 electron-updater 单连接 Node 下载。
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { app, session, type DownloadItem } from 'electron'
import type { PendingUpdateFile } from './update-download-resolve'

export type { PendingUpdateFile } from './update-download-resolve'
export { pickPendingUpdateFile, resolveUpdateFileUrl } from './update-download-resolve'

export type UpdateDownloadProgress = {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

async function hashFileSha512Base64(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha512')
    createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('base64')))
      .on('error', reject)
  })
}

/** 规范化下载 URL（中文文件名等），避免 Chromium 下载栈解析失败或降速 */
function normalizeDownloadUrl(raw: string): string {
  try {
    return new URL(raw).href
  } catch {
    return raw
  }
}

function urlsRoughlyMatch(a: string, b: string): boolean {
  try {
    const left = new URL(a)
    const right = new URL(b)
    return decodeURIComponent(left.pathname) === decodeURIComponent(right.pathname)
  } catch {
    return a === b
  }
}

/** 使用 Chromium 下载管理器拉取安装包（多连接 / HTTP2，速度接近浏览器） */
export async function downloadUpdateViaSession(
  file: PendingUpdateFile,
  onProgress: (progress: UpdateDownloadProgress) => void,
): Promise<string> {
  const saveDir = path.join(app.getPath('temp'), 'lc-updates')
  mkdirSync(saveDir, { recursive: true })
  const savePath = path.join(saveDir, file.fileName)

  return new Promise((resolve, reject) => {
    let settled = false
    let activeItem: DownloadItem | null = null

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      session.defaultSession.removeListener('will-download', onWillDownload)
      if (activeItem) {
        activeItem.removeAllListeners('updated')
        activeItem.removeAllListeners('done')
      }
      if (error) reject(error)
    }

    const onWillDownload = (_event: Electron.Event, item: DownloadItem) => {
      if (settled) return
      if (!urlsRoughlyMatch(item.getURL(), file.url)) return

      activeItem = item
      item.setSavePath(savePath)

      item.on('updated', (_evt, state) => {
        if (state !== 'progressing') return
        const total = item.getTotalBytes()
        const transferred = item.getReceivedBytes()
        onProgress({
          percent: total > 0 ? (transferred / total) * 100 : 0,
          transferred,
          total,
          bytesPerSecond: item.getCurrentBytesPerSecond(),
        })
      })

      item.once('done', (_evt, state) => {
        if (state !== 'completed') {
          finish(new Error(state === 'cancelled' ? '下载已取消' : '下载失败'))
          return
        }
        void (async () => {
          try {
            const actual = await hashFileSha512Base64(savePath)
            if (actual !== file.sha512) {
              finish(new Error('安装包校验失败，请稍后重试或从官网下载'))
              return
            }
            settled = true
            session.defaultSession.removeListener('will-download', onWillDownload)
            resolve(savePath)
          } catch (error) {
            finish(error instanceof Error ? error : new Error(String(error)))
          }
        })()
      })
    }

    const downloadUrl = normalizeDownloadUrl(file.url)
    session.defaultSession.on('will-download', onWillDownload)
    session.defaultSession.downloadURL(downloadUrl)

    setTimeout(() => {
      if (!settled && !activeItem) {
        finish(new Error('下载未启动，请检查网络后重试'))
      }
    }, 30_000)
  })
}
