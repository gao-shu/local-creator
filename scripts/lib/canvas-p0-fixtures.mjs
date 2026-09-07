/** P0 回归：画布 data.json 归一化 + projectId 校验（与 src 契约对齐，无需 Electron） */

import path from 'node:path'

/** 镜像 src/lib/canvas/canvas-project-settings.ts：忽略已废弃字段 */
function normalizeCanvasProjectSettings(_raw) {
  return {}
}

const CANVAS_PROJECT_ID_PATTERN = /^cv_[a-zA-Z0-9_-]+$/i

export function isCanvasProjectDirName(name) {
  const id = String(name || '').trim()
  if (!id || id.includes('..')) return false
  return CANVAS_PROJECT_ID_PATTERN.test(id)
}

export function resolveSafeCanvasProjectDir(canvasRoot, projectId) {
  if (!isCanvasProjectDirName(projectId)) {
    throw new Error('无效的画布项目 ID')
  }
  const rootResolved = path.resolve(canvasRoot)
  const dir = path.resolve(path.join(rootResolved, projectId))
  const rootPrefix = rootResolved.endsWith(path.sep) ? rootResolved : `${rootResolved}${path.sep}`
  if (dir !== rootResolved && !dir.startsWith(rootPrefix)) {
    throw new Error('无效的画布项目路径')
  }
  return dir
}

export function normalizeCanvasProjectDataFromDisk(raw) {
  const empty = {
    version: 1,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 0.9 },
    settings: normalizeCanvasProjectSettings(undefined),
  }
  if (!raw || typeof raw !== 'object') return empty
  const record = raw
  const viewportRaw = record.viewport
  const stripNode = (node) => {
    if (!node || typeof node !== 'object') return node
    const data = node.data && typeof node.data === 'object' ? { ...node.data } : {}
    if (node.type === 'shotPrompt') delete data.llmModelId
    if (node.type === 'imageNode') delete data.imageModelId
    return { ...node, data }
  }
  return {
    version: 1,
    nodes: Array.isArray(record.nodes) ? record.nodes.map(stripNode) : [],
    edges: Array.isArray(record.edges) ? record.edges : [],
    viewport: {
      x: Number(viewportRaw?.x) || 0,
      y: Number(viewportRaw?.y) || 0,
      zoom: Number(viewportRaw?.zoom) || 0.9,
    },
    settings: normalizeCanvasProjectSettings(
      record.settings && typeof record.settings === 'object' ? record.settings : undefined,
    ),
  }
}

export function mergeCanvasProjectDataForPersist(disk, memory) {
  return {
    version: 1,
    nodes: memory.nodes,
    edges: memory.edges,
    viewport: memory.viewport,
    settings: normalizeCanvasProjectSettings(memory.settings ?? disk.settings),
  }
}
