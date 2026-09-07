/**
 * 画布智能分镜 shot utils 纯函数镜像（与 src/lib/canvas/canvas-shot-utils.ts 契约对齐）
 * 供 node scripts/test-canvas-shot-utils.mjs 使用，无需 Electron / dev server。
 */

export const CANVAS_NODE_TYPES = { storyVideo: 'storyVideo' }

function hasCanvasVideoLocalOutput(data) {
  const raw = String(data.outputPath || '').trim()
  return Boolean(raw && !raw.startsWith('preview:'))
}

function formatCanvasVideoNodeName(name) {
  const body = String(name || '')
    .trim()
    .replace(/^视频\s*/, '')
    .trimStart()
  if (!body) return '视频'
  return `视频  ${body}`
}

function readCanvasVideoNodeData(node) {
  return node?.data ?? {}
}

export function resolveStoryboardShotNumber(data) {
  if (typeof data.shotNumber === 'number' && Number.isFinite(data.shotNumber) && data.shotNumber > 0) {
    return Math.trunc(data.shotNumber)
  }
  if (
    typeof data.importShotNumber === 'number' &&
    Number.isFinite(data.importShotNumber) &&
    data.importShotNumber > 0
  ) {
    return Math.trunc(data.importShotNumber)
  }
  return undefined
}

export function isStoryboardShotNode(node) {
  if (node?.type !== CANVAS_NODE_TYPES.storyVideo) return false
  return resolveStoryboardShotNumber(readCanvasVideoNodeData(node)) != null
}

function compareStoryboardShotNodes(a, b) {
  const aNum = resolveStoryboardShotNumber(readCanvasVideoNodeData(a)) ?? 9999
  const bNum = resolveStoryboardShotNumber(readCanvasVideoNodeData(b)) ?? 9999
  if (aNum !== bNum) return aNum - bNum
  return a.position.y - b.position.y || a.position.x - b.position.x || a.id.localeCompare(b.id)
}

export function compareNodesByStoryboardShot(a, b) {
  return compareStoryboardShotNodes(a, b)
}

export function formatDeletedStoryboardShotsToast(shotNumbers) {
  const unique = [...new Set(shotNumbers.filter((n) => Number.isFinite(n) && n > 0))].sort(
    (a, b) => a - b,
  )
  if (!unique.length) return null
  if (unique.length === 1) return `已删除镜 ${unique[0]}`
  if (unique.length <= 4) return `已删除镜 ${unique.join('、镜 ')}`
  return `已删除 ${unique.length} 镜（镜 ${unique.slice(0, 3).join('、镜 ')} 等）`
}

export function collectStoryboardShotNumbersFromNodes(nodes, nodeIds) {
  const idSet = new Set(nodeIds)
  const numbers = []
  for (const node of nodes) {
    if (!idSet.has(node.id) || !isStoryboardShotNode(node)) continue
    const shotNumber = resolveStoryboardShotNumber(readCanvasVideoNodeData(node))
    if (shotNumber != null) numbers.push(shotNumber)
  }
  return numbers
}

export function formatStoryboardShotsDeleteConfirmDescription(shotNumbers) {
  const unique = [...new Set(shotNumbers.filter((n) => Number.isFinite(n) && n > 0))].sort(
    (a, b) => a - b,
  )
  if (!unique.length) return '删除后不可恢复。'
  if (unique.length === 1) return `确定删除镜 ${unique[0]} 吗？删除后不可恢复。`
  if (unique.length <= 4) {
    return `确定删除镜 ${unique.join('、镜 ')} 吗？删除后不可恢复。`
  }
  return `确定删除 ${unique.length} 镜（镜 ${unique.slice(0, 3).join('、镜 ')} 等）吗？删除后不可恢复。`
}

export function isStoryboardShotWithoutOutput(data) {
  return !hasCanvasVideoLocalOutput(data)
}

export function isPendingCanvasVideoNode(node) {
  if (node?.type !== CANVAS_NODE_TYPES.storyVideo) return false
  const data = readCanvasVideoNodeData(node)
  if (data.status === 'running') return false
  if (data.needsRegen) return true
  if (data.status === 'error') return true
  return isStoryboardShotWithoutOutput(data)
}

export function isPendingStoryboardShotNode(node) {
  if (!isStoryboardShotNode(node)) return false
  return isPendingCanvasVideoNode(node)
}

function comparePendingCanvasVideoNodes(a, b) {
  const aIsStoryboard = isStoryboardShotNode(a)
  const bIsStoryboard = isStoryboardShotNode(b)
  if (aIsStoryboard && bIsStoryboard) return compareStoryboardShotNodes(a, b)
  if (aIsStoryboard !== bIsStoryboard) return aIsStoryboard ? -1 : 1
  return a.position.y - b.position.y || a.position.x - b.position.x || a.id.localeCompare(b.id)
}

export function collectPendingCanvasVideos(nodes) {
  return nodes.filter(isPendingCanvasVideoNode).sort(comparePendingCanvasVideoNodes)
}

export function collectPendingStoryboardShots(nodes) {
  return collectPendingCanvasVideos(nodes)
}

const STORYBOARD_STATUS_TOKENS = new Set(['待生成', '生成中', '已生成', '生成失败', '待更新'])

function normalizeStoryboardLabelSeparators(text) {
  return String(text || '')
    .replace(/[\u00B7·•]/g, '·')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitStoryboardLabelSegments(text) {
  return normalizeStoryboardLabelSeparators(text)
    .split(/[·\-—]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function stripCanvasVideoNamePrefix(name) {
  return String(name || '')
    .trim()
    .replace(/^视频\s*/, '')
    .trimStart()
}

function resolvePendingStoryboardShotName(data) {
  const dialogue = String(data.dialogue || '').trim()
  if (dialogue) return dialogue

  const shotNumber = resolveStoryboardShotNumber(data)
  const body = normalizeStoryboardLabelSeparators(stripCanvasVideoNamePrefix(data.videoName))
  if (body && shotNumber != null) {
    const shotHead = `镜 ${shotNumber}`
    if (body.startsWith(shotHead)) {
      const rest = body.slice(shotHead.length).replace(/^[·\-—]\s*/, '').trim()
      if (rest) {
        const nameParts = splitStoryboardLabelSegments(rest).filter(
          (part) => !STORYBOARD_STATUS_TOKENS.has(part),
        )
        if (nameParts.length) return nameParts.join(' · ')
      }
    }
  }

  const promptLine =
    String(data.prompt || '')
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) || ''
  if (!promptLine) return ''
  return promptLine.length > 48 ? `${promptLine.slice(0, 48)}…` : promptLine
}

export function formatPendingStoryboardShotLabel(shotNumber, name) {
  const trimmed = String(name || '').trim()
  return trimmed ? `镜 ${shotNumber} · ${trimmed}` : `镜 ${shotNumber}`
}

function resolveCanvasVideoDisplayName(options) {
  const raw = String(options.videoName || '').trim()
  const label = formatCanvasVideoNodeName(raw || undefined)
  return { label }
}

export function formatPendingCanvasVideoItemLabel(data) {
  const shotNumber = resolveStoryboardShotNumber(data)
  const name = resolvePendingStoryboardShotName(data)
  if (shotNumber != null) {
    return formatPendingStoryboardShotLabel(shotNumber, name)
  }
  const title = resolveCanvasVideoDisplayName({ videoName: data.videoName }).label.trim()
  return name ? `${title} · ${name}` : title
}

export function formatPendingCanvasVideoItemTitle(data) {
  const shotNumber = resolveStoryboardShotNumber(data)
  if (shotNumber != null) {
    return `镜 ${shotNumber}`
  }
  return resolveCanvasVideoDisplayName({ videoName: data.videoName }).label.trim() || '视频'
}

export function collectPendingStoryboardShotItems(nodes) {
  return collectPendingCanvasVideos(nodes).map((node) => {
    const data = readCanvasVideoNodeData(node)
    const shotNumber = resolveStoryboardShotNumber(data)
    const name = resolvePendingStoryboardShotName(data)
    return {
      nodeId: node.id,
      ...(shotNumber != null ? { shotNumber } : {}),
      name,
      label: formatPendingCanvasVideoItemLabel(data),
      title: formatPendingCanvasVideoItemTitle(data),
    }
  })
}

export function shouldMarkStoryboardShotNeedsRegen(data, nextPrompt) {
  const shotNumber = resolveStoryboardShotNumber(data)
  if (shotNumber == null) return false
  if (!hasCanvasVideoLocalOutput(data)) return false
  return nextPrompt !== String(data.prompt || '')
}

export function buildStoryboardShotDescriptionSavePatch(data, next) {
  const prompt = next.prompt
  const dialogue = next.dialogue.trim()
  const patch = { prompt, dialogue: dialogue || undefined }
  const shotNumber = resolveStoryboardShotNumber(data)
  if (shotNumber != null) {
    const label = `镜 ${shotNumber}${dialogue ? ` · ${dialogue}` : ''}`
    patch.videoName = formatCanvasVideoNodeName(label)
    if (hasCanvasVideoLocalOutput(data)) {
      const promptChanged = prompt !== String(data.prompt || '')
      const dialogueChanged = dialogue !== String(data.dialogue || '').trim()
      if (promptChanged || dialogueChanged) {
        patch.needsRegen = true
      }
    }
  }
  return patch
}

export function storyVideoNode(id, shotNumber, data = {}) {
  return {
    id,
    type: CANVAS_NODE_TYPES.storyVideo,
    position: { x: 0, y: 0 },
    data: { shotNumber, ...data },
  }
}
