/**
 * 画布三列布局纯函数镜像（与 src/lib/canvas/canvas-prompt-layout.ts 契约对齐，无需 Electron）
 */

export const CANVAS_GRAPH_PROMPT_WIDTH = 280
export const CANVAS_PROMPT_ASSET_NODE_WIDTH = 320
export const CANVAS_PROMPT_COLUMN_GAP = 72
export const CANVAS_PROMPT_ASSET_ROW_GAP = 56
export const CANVAS_GRAPH_NODE_GAP_Y = 28
export const CANVAS_PROMPT_COLUMN_X_TOLERANCE = 48
export const CANVAS_GRAPH_IMAGE_HEIGHT = 26 + Math.round(CANVAS_PROMPT_ASSET_NODE_WIDTH * (16 / 9)) + 12
/** 与 src CANVAS_GRAPH_PREVIEW_MAX_HEIGHT 一致（320 宽 × 9:16 竖屏） */
export const CANVAS_GRAPH_VIDEO_HEIGHT = Math.round(CANVAS_PROMPT_ASSET_NODE_WIDTH * (16 / 9))
/** 分镜列内单镜占用高度（标题 26 + 预览区，与 CANVAS_INLINE_SHOT_GAP_Y - GAP 一致） */
export const CANVAS_GRAPH_VIDEO_STACK_HEIGHT = 26 + CANVAS_GRAPH_VIDEO_HEIGHT

export function resolveCanvasPromptColumnX(sourceX) {
  const characterColX = sourceX + CANVAS_GRAPH_PROMPT_WIDTH + CANVAS_PROMPT_COLUMN_GAP
  const sceneColX = characterColX + CANVAS_PROMPT_ASSET_NODE_WIDTH + CANVAS_PROMPT_COLUMN_GAP
  const storyboardColX = sceneColX + CANVAS_PROMPT_ASSET_NODE_WIDTH + CANVAS_PROMPT_COLUMN_GAP
  return { characterColX, sceneColX, storyboardColX }
}

function collectDirectNeighborNodeIds(sourceNodeId, edges) {
  const ids = new Set()
  for (const edge of edges) {
    if (edge.source === sourceNodeId) ids.add(edge.target)
    if (edge.target === sourceNodeId) ids.add(edge.source)
  }
  return ids
}

export function resolveCanvasPromptColumnAtX(sourceX, nodeX) {
  const { characterColX, sceneColX, storyboardColX } = resolveCanvasPromptColumnX(sourceX)
  const tolerance = CANVAS_PROMPT_COLUMN_X_TOLERANCE
  if (Math.abs(nodeX - characterColX) <= tolerance) return 'character'
  if (Math.abs(nodeX - sceneColX) <= tolerance) return 'scene'
  if (Math.abs(nodeX - storyboardColX) <= tolerance) return 'storyboard'
  return null
}

function resolveNodeBottom(node) {
  const height =
    node.type === 'storyVideo'
      ? CANVAS_GRAPH_VIDEO_STACK_HEIGHT
      : CANVAS_GRAPH_IMAGE_HEIGHT
  return node.position.y + height
}

function nodeMatchesPromptColumn(node, sourceX, column) {
  const col = resolveCanvasPromptColumnAtX(sourceX, node.position.x)
  if (col !== column) return false
  if (column === 'storyboard') return node.type === 'storyVideo'
  return node.type === 'imageNode'
}

/** 镜像 resolveCanvasPromptColumnBottom */
export function resolveCanvasPromptColumnBottom(sourceNode, column, nodes, edges) {
  const connectedIds = collectDirectNeighborNodeIds(sourceNode.id, edges)
  const sourceX = sourceNode.position.x
  let maxBottom = null
  for (const node of nodes) {
    if (!connectedIds.has(node.id)) continue
    if (!nodeMatchesPromptColumn(node, sourceX, column)) continue
    const bottom = resolveNodeBottom(node)
    maxBottom = maxBottom === null ? bottom : Math.max(maxBottom, bottom)
  }
  return maxBottom
}

export function resolveCanvasPromptStoryboardStartY(sourceNode, nodes, edges, gap = CANVAS_GRAPH_NODE_GAP_Y) {
  const baseY = sourceNode.position.y
  const columnBottom = resolveCanvasPromptColumnBottom(sourceNode, 'storyboard', nodes, edges)
  if (columnBottom === null) return baseY
  return columnBottom + gap
}

export function resolveCanvasPromptAssetColumnStartY(
  sourceNode,
  column,
  nodes,
  edges,
  gap = CANVAS_PROMPT_ASSET_ROW_GAP,
) {
  const baseY = sourceNode.position.y
  const columnBottom = resolveCanvasPromptColumnBottom(sourceNode, column, nodes, edges)
  if (columnBottom === null) return baseY
  return columnBottom + gap
}

export function imageAssetNode(id, { role = 'character', name, outputPath = 'images/test.png', x = 0, y = 0 }) {
  return {
    id,
    type: 'imageNode',
    position: { x, y },
    data: {
      assetRole: role,
      entityName: name,
      imageName: name,
      assetRoleConverted: true,
      outputPath,
      label: `${role} · ${name}`,
    },
  }
}

export function storyVideoNode(id, { prompt = '', shotNumber = 1, x = 0, y = 0 } = {}) {
  return {
    id,
    type: 'storyVideo',
    position: { x, y },
    data: { prompt, shotNumber },
  }
}

export function shotPromptNode(id, { x = 0, y = 100 } = {}) {
  return {
    id,
    type: 'shotPrompt',
    position: { x, y },
    data: { prompt: '剧本' },
  }
}

export function textToTargetEdge(sourceId, targetId) {
  return {
    id: `e_${sourceId}_${targetId}`,
    source: sourceId,
    target: targetId,
  }
}
