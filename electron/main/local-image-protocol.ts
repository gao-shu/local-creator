import fs from 'node:fs/promises'

import fsSync from 'node:fs'

import path from 'node:path'

import { protocol } from 'electron'



const MIME_TYPES: Record<string, string> = {

  '.jpg': 'image/jpeg',

  '.jpeg': 'image/jpeg',

  '.png': 'image/png',

  '.gif': 'image/gif',

  '.webp': 'image/webp',

  '.bmp': 'image/bmp',

  '.svg': 'image/svg+xml',

  '.mp4': 'video/mp4',

  '.webm': 'video/webm',

  '.mov': 'video/quicktime',

  '.mp3': 'audio/mpeg',

  '.wav': 'audio/wav',

  '.ogg': 'audio/ogg',

  '.flac': 'audio/flac',

  '.aac': 'audio/aac',

  '.m4a': 'audio/mp4',

}



const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov'])
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'])
const RANGE_EXTENSIONS = new Set([...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS])



/** 与上游实现对齐：local-image://e/huajing/pictures/xxx.png */

function extractLocalImagePath(sourceUrl: string): string {

  const url = new URL(sourceUrl)

  let pathname = url.pathname

  try {

    pathname = decodeURIComponent(pathname)

  } catch {

    /* keep raw */

  }

  const hostPart =

    process.platform === 'darwin' && url.host.toLowerCase() === 'users' ? 'Users' : url.host



  if (process.platform === 'win32') {

    if (hostPart && hostPart.length === 1) {

      return `${hostPart.toUpperCase()}:${pathname.replace(/\//g, '\\')}`

    }

    if (/^\/[A-Za-z]:/.test(pathname)) {

      return pathname.slice(1).replace(/\//g, '\\')

    }

    return `${hostPart}:${pathname.replace(/\//g, '\\')}`

  }



  return `/${hostPart}${pathname}`

}



function buildMediaHeaders(

  mimeType: string,

  fileSize: number,

  ext: string,

  extra?: Record<string, string>,

): Record<string, string> {

  const headers: Record<string, string> = {

    'Content-Type': mimeType,

    'Content-Length': fileSize.toString(),

    ...extra,

  }

  if (RANGE_EXTENSIONS.has(ext)) {

    headers['Accept-Ranges'] = 'bytes'

  }

  return headers

}



/** Range 流：客户端取消时销毁底层 fs 流，避免向已关闭 controller enqueue */

function createSafeRangeStream(filePath: string, start: number, end: number): ReadableStream<Uint8Array> {

  const nodeStream = fsSync.createReadStream(filePath, { start, end })

  let closed = false



  const shutdown = () => {

    if (closed) return

    closed = true

    nodeStream.destroy()

  }



  return new ReadableStream({

    start(controller) {

      nodeStream.on('data', (chunk: Buffer) => {

        if (closed) return

        try {

          controller.enqueue(new Uint8Array(chunk))

        } catch {

          shutdown()

        }

      })

      nodeStream.on('end', () => {

        if (closed) return

        closed = true

        try {

          controller.close()

        } catch {

          /* ignore */

        }

      })

      nodeStream.on('error', (err) => {

        if (closed) return

        closed = true

        try {

          controller.error(err)

        } catch {

          /* ignore */

        }

      })

    },

    cancel() {

      shutdown()

    },

  })

}



export function registerLocalImageScheme() {

  protocol.registerSchemesAsPrivileged([

    {

      scheme: 'local-image',

      privileges: {

        standard: true,

        secure: true,

        supportFetchAPI: true,

        corsEnabled: true,

        stream: true,

      },

    },

  ])

}



export function registerLocalImageProtocol() {

  protocol.handle('local-image', async (request) => {

    const filePath = extractLocalImagePath(request.url)

    const ext = path.extname(filePath).toLowerCase()

    const mimeType = MIME_TYPES[ext] || 'application/octet-stream'



    try {

      const stat = fsSync.statSync(filePath)

      const fileSize = stat.size

      const rangeHeader = request.headers.get('range')



      if (request.method === 'HEAD') {

        return new Response(null, {

          status: 200,

          headers: buildMediaHeaders(mimeType, fileSize, ext),

        })

      }



      if (rangeHeader) {

        const rangeMatch = rangeHeader.replace(/bytes=/, '').split(',')[0].trim()

        const [startStr, endStr] = rangeMatch.split('-')

        const start = Number.parseInt(startStr, 10)

        const end = endStr ? Number.parseInt(endStr, 10) : fileSize - 1

        const chunkSize = end - start + 1

        const webStream = createSafeRangeStream(filePath, start, end)

        return new Response(webStream, {

          status: 206,

          headers: buildMediaHeaders(mimeType, chunkSize, ext, {

            'Content-Range': `bytes ${start}-${end}/${fileSize}`,

          }),

        })

      }



      // 音视频 / 大文件无 Range 时流式读盘，避免整文件进内存拖垮多路预览
      if (RANGE_EXTENSIONS.has(ext) || fileSize > 512 * 1024) {
        const webStream = createSafeRangeStream(filePath, 0, fileSize - 1)
        return new Response(webStream, {
          status: 200,
          headers: buildMediaHeaders(mimeType, fileSize, ext),
        })
      }

      const fileBuffer = await fs.readFile(filePath)

      return new Response(new Uint8Array(fileBuffer), {

        status: 200,

        headers: buildMediaHeaders(mimeType, fileBuffer.length, ext),

      })

    } catch {

      return new Response('File not found', { status: 404 })

    }

  })

}


