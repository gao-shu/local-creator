import {
  joinPathSegments,
  pathSeparator,
  trimTrailingSeparators,
} from '@/lib/storage/storage-path-utils'

const PROJECT_MEDIA_DIR_PATTERN = /(?:^|[\\/])(Roles|Scenes|Items|pictures|videos)[\\/][^\\/]+$/i
const PROJECT_MEDIA_PREFIX = /^(?:Roles|Scenes|Items|pictures|videos)(?:[\\/]|$)/i
const VOICES_MEDIA_PREFIX = /^voices(?:[\\/]|$)/i
const VOICES_MEDIA_DIR_PATTERN = /(?:^|[\\/])voices[\\/].+$/i
const CANVAS_MEDIA_PREFIX = /^assets\/(?:references|images|videos)(?:[\\/]|$)/i
const CANVAS_MEDIA_DIR_PATTERN = /(?:^|[\\/])assets\/(?:references|images|videos)[\\/][^\\/]+$/i
const FALSE_HTTP_PROJECT_MEDIA = /^https?:\/\/((?:roles|scenes|items|pictures|videos)\/.+)$/i
const FALSE_HTTP_VOICES_MEDIA = /^https?:\/\/(voices\/.+)$/i
const FALSE_HTTP_CANVAS_MEDIA = /^https?:\/\/(assets\/.+)$/i

export function isCanvasRelativeMediaPath(value: string): boolean {
  const text = String(value || '').trim().replace(/\\/g, '/')
  return CANVAS_MEDIA_PREFIX.test(text)
}

export function isProjectRelativeVoicePath(value: string): boolean {
  const text = String(value || '').trim().replace(/\\/g, '/')
  return VOICES_MEDIA_PREFIX.test(text)
}

export function isProjectRelativeMediaPath(value: string): boolean {
  const text = String(value || '').trim().replace(/\\/g, '/')
  return (
    PROJECT_MEDIA_PREFIX.test(text) ||
    isCanvasRelativeMediaPath(text) ||
    isProjectRelativeVoicePath(text)
  )
}

/** 修正项目媒体目录大小写（Roles/Scenes/Items/...） */
export function restoreProjectMediaFolderCase(relativePath: string): string {
  return relativePath.replace(/^(roles|scenes|items|pictures|videos)(?=\/)/i, (seg) => {
    const key = seg.toLowerCase()
    if (key === 'roles') return 'Roles'
    if (key === 'scenes') return 'Scenes'
    if (key === 'items') return 'Items'
    if (key === 'pictures') return 'pictures'
    if (key === 'videos') return 'videos'
    return seg
  })
}

/**
 * 规范化项目内存储的媒体路径：
 * - 修复误识别为 http://roles/... 的本地相对路径
 * - 去掉多余的前导 /
 */
export function normalizeStoredMediaPath(value: string): string {
  let text = String(value || '').trim()
  if (!text) return ''

  const falseHttp = text.match(FALSE_HTTP_PROJECT_MEDIA)
  if (falseHttp) {
    text = restoreProjectMediaFolderCase(falseHttp[1].replace(/\\/g, '/'))
  }

  const falseHttpCanvas = text.match(FALSE_HTTP_CANVAS_MEDIA)
  if (falseHttpCanvas) {
    text = falseHttpCanvas[1].replace(/\\/g, '/')
  }

  const falseHttpVoices = text.match(FALSE_HTTP_VOICES_MEDIA)
  if (falseHttpVoices) {
    text = falseHttpVoices[1].replace(/\\/g, '/')
  }

  const slashTrimmed = text.replace(/^\/+/, '').replace(/\\/g, '/')
  if (isProjectRelativeMediaPath(slashTrimmed)) {
    return isCanvasRelativeMediaPath(slashTrimmed)
      ? slashTrimmed
      : restoreProjectMediaFolderCase(slashTrimmed)
  }

  return text
}

/** 绝对磁盘路径 → local-image://（对齐 haode-ai-client / 画境） */
export function toLocalImageUrl(absolutePath: string): string {
  const text = String(absolutePath || '').trim()
  if (!text) return ''
  if (text.startsWith('local-image:')) return text
  if (text.startsWith('data:') || text.startsWith('preview:')) return text
  if (/^https?:\/\//i.test(text)) return text

  const normalized = text.replace(/\\/g, '/')
  const urlPath = normalized.replace(/^([A-Za-z]):\//, '/$1/')
  return `local-image:${urlPath}`
}

export function isLocalImageUrl(value: string): boolean {
  return String(value || '').trim().startsWith('local-image:')
}

/** local-image: 协议 URL → 磁盘绝对路径（与 electron local-image-protocol 对齐） */
export function fromLocalImageUrl(value: string): string {
  const text = String(value || '').trim()
  if (!isLocalImageUrl(text)) return text

  const payload = text.slice('local-image:'.length)
  if (/^\\?[A-Za-z]:[\\/]/.test(payload)) {
    return payload.replace(/\//g, '\\')
  }

  const normalized = payload.replace(/^\/\//, '').replace(/\\/g, '/')

  const driveFromSlash = normalized.match(/^\/([A-Za-z])(\/.*)$/)
  if (driveFromSlash) {
    return `${driveFromSlash[1].toUpperCase()}:${driveFromSlash[2].replace(/\//g, '\\')}`
  }

  const driveDirect = normalized.match(/^([A-Za-z]):\/(.*)$/)
  if (driveDirect) {
    return `${driveDirect[1].toUpperCase()}:\\${driveDirect[2].replace(/\//g, '\\')}`
  }

  if (payload.startsWith('//')) {
    try {
      const url = new URL(text.replace(/^local-image:/, 'file:'))
      const host = url.hostname
      const pathname = url.pathname
      if (host.length === 1) {
        return `${host.toUpperCase()}:${pathname.replace(/\//g, '\\')}`
      }
      return `/${host}${pathname}`
    } catch {
      /* fall through */
    }
  }

  return payload
}

export function isAbsoluteMediaPath(inputPath: string): boolean {
  const text = String(inputPath || '').trim()
  return /^[a-zA-Z]:[\\/]/.test(text) || text.startsWith('/')
}

/** 远程/公网图片地址（含无 scheme 的 host/path），不应按本地相对路径截断 */
export function isRemoteMediaReference(value: string): boolean {
  const text = normalizeStoredMediaPath(value)
  if (!text) return false
  if (text.startsWith('data:') || text.startsWith('preview:')) return true
  if (isLocalImageUrl(text)) return false
  if (/^https?:\/\//i.test(text)) return true
  if (text.startsWith('//')) return true
  if (/^[a-zA-Z]:[\\/]/.test(text)) return false
  if (isProjectRelativeMediaPath(text.replace(/\\/g, '/'))) return false
  if (/^[a-zA-Z0-9.-]+(?::\d+)?\/.+/.test(text)) return true
  return false
}

/** 规范化为可直接用于 img/video 的完整 URL */
export function normalizeRemoteMediaUrl(value: string): string {
  const text = normalizeStoredMediaPath(value)
  if (!text) return ''
  if (text.startsWith('data:') || text.startsWith('preview:')) return text
  if (isLocalImageUrl(text)) return text
  if (/^https?:\/\//i.test(text)) return text
  if (text.startsWith('//')) return `https:${text}`
  if (isProjectRelativeMediaPath(text.replace(/\\/g, '/'))) return text
  if (/^[a-zA-Z0-9.-]+(?::\d+)?\/.+/.test(text) && !/^[a-zA-Z]:\\/.test(text)) {
    return `http://${text.replace(/^\/+/, '')}`
  }
  return text
}

/** 将磁盘上的绝对路径转为项目内相对路径，便于便携迁移 */
export function toProjectRelativeMediaPath(
  storedPath: string,
  projectRoot: string,
): string {
  const trimmed = normalizeStoredMediaPath(storedPath)
  if (!trimmed) return ''
  if (isRemoteMediaReference(trimmed)) {
    return normalizeRemoteMediaUrl(trimmed)
  }

  const root = trimTrailingSeparators(projectRoot).replace(/\\/g, '/')
  const normalized = trimmed.replace(/\\/g, '/')
  const rootKey = root.toLowerCase()
  const pathKey = normalized.toLowerCase()

  if (pathKey.startsWith(`${rootKey}/`)) {
    return normalized.slice(root.length + 1)
  }

  if (!isAbsoluteMediaPath(trimmed)) return trimmed

  const projectId = root.split('/').pop() || ''
  if (projectId) {
    const marker = `/${projectId}/`
    const idx = pathKey.indexOf(marker.toLowerCase())
    if (idx >= 0) {
      return normalized.slice(idx + marker.length)
    }
  }

  if (isAbsoluteMediaPath(trimmed)) {
    const mediaMatch = normalized.match(PROJECT_MEDIA_DIR_PATTERN)
    if (mediaMatch) {
      return mediaMatch[0].replace(/^[\\/]/, '')
    }
    const canvasMatch = normalized.match(CANVAS_MEDIA_DIR_PATTERN)
    if (canvasMatch) {
      return canvasMatch[0].replace(/^[\\/]/, '')
    }
    const voicesMatch = normalized.match(VOICES_MEDIA_DIR_PATTERN)
    if (voicesMatch) {
      return voicesMatch[0].replace(/^[\\/]/, '')
    }
  }

  return trimmed
}

/** 将存储路径解析为当前项目目录下的可读绝对路径 */
export function resolveProjectMediaPath(
  storedPath: string,
  projectRoot: string,
): string {
  const trimmed = normalizeStoredMediaPath(storedPath)
  if (!trimmed) return ''
  if (isRemoteMediaReference(trimmed)) {
    return normalizeRemoteMediaUrl(trimmed)
  }

  const root = trimTrailingSeparators(projectRoot)
  const sep = pathSeparator(root)

  if (!isAbsoluteMediaPath(trimmed)) {
    return joinPathSegments(root, trimmed)
  }

  const normalized = trimmed.replace(/\\/g, '/')
  const projectId = root.split(/[\\/]/).pop() || ''
  if (projectId) {
    const marker = `/${projectId}/`
    const idx = normalized.toLowerCase().indexOf(marker.toLowerCase())
    if (idx >= 0) {
      const suffix = normalized.slice(idx + marker.length)
      return joinPathSegments(root, suffix.replace(/\//g, sep))
    }
  }

  if (isAbsoluteMediaPath(trimmed)) {
    const mediaMatch = normalized.match(PROJECT_MEDIA_DIR_PATTERN)
    if (mediaMatch) {
      const suffix = mediaMatch[0].replace(/^[\\/]/, '').replace(/\//g, sep)
      return joinPathSegments(root, suffix)
    }
    const canvasMatch = normalized.match(CANVAS_MEDIA_DIR_PATTERN)
    if (canvasMatch) {
      const suffix = canvasMatch[0].replace(/^[\\/]/, '').replace(/\//g, sep)
      return joinPathSegments(root, suffix)
    }
    const voicesMatch = normalized.match(VOICES_MEDIA_DIR_PATTERN)
    if (voicesMatch) {
      const suffix = voicesMatch[0].replace(/^[\\/]/, '').replace(/\//g, sep)
      return joinPathSegments(root, suffix)
    }
  }

  return trimmed
}
