// Copyright (c) Haode AI. All rights reserved.

/** 工坊 / 画布列表区保留段，不可当作项目 id */
const LIST_RESERVED_SEGMENTS = new Set(['recycle'])

export function isListReservedSegment(segment: string | null | undefined): boolean {
  if (!segment) return false
  return LIST_RESERVED_SEGMENTS.has(segment)
}

/** 是否为创作工坊项目详情路径（不含 /workshop、/workshop/recycle） */
export function isWorkshopProjectPath(pathname: string): boolean {
  const match = pathname.match(/^\/workshop\/([^/]+)(?:\/|$)/)
  if (!match?.[1]) return false
  try {
    return !isListReservedSegment(decodeURIComponent(match[1]))
  } catch {
    return !isListReservedSegment(match[1])
  }
}

/** 是否为画布编辑页路径（不含 /canvas、/canvas/recycle） */
export function isCanvasProjectPath(pathname: string): boolean {
  const match = pathname.match(/^\/canvas\/([^/]+)$/)
  if (!match?.[1]) return false
  try {
    return !isListReservedSegment(decodeURIComponent(match[1]))
  } catch {
    return !isListReservedSegment(match[1])
  }
}
