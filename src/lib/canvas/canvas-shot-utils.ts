// Copyright (c) Haode AI. All rights reserved.

import type { Node } from '@xyflow/react'
import { hasCanvasVideoLocalOutput } from '@/lib/canvas/canvas-video-drag-items'
import { formatCanvasVideoNodeName, resolveCanvasVideoDisplayName, stripCanvasVideoNamePrefix } from '@/lib/canvas/canvas-video-naming'
import {
  CANVAS_NODE_TYPES,
  type CanvasNodeStatus,
  type CanvasVideoNodeData,
} from '@/types/canvas-nodes'

/** 分镜节点标题阶段（UI 文案，与 CanvasNodeStatus 映射） */
export type StoryboardShotTitlePhase = 'draft' | 'generating' | 'ready' | 'failed' | 'needs-update'

const STORYBOARD_SHOT_TITLE_SUFFIX: Record<StoryboardShotTitlePhase, string> = {
  draft: '待生成',
  generating: '生成中',
  ready: '已生成',
  failed: '生成失败',
  'needs-update': '待更新',
}

function readCanvasVideoNodeData(node: Node): CanvasVideoNodeData {
  return (node.data ?? {}) as CanvasVideoNodeData
}

/** 镜号：优先 shotNumber，兼容旧 importShotNumber */
export function resolveStoryboardShotNumber(data: CanvasVideoNodeData): number | undefined {
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

export function isStoryboardShotNode(node: Node): boolean {
  if (node.type !== CANVAS_NODE_TYPES.storyVideo) return false
  return resolveStoryboardShotNumber(readCanvasVideoNodeData(node)) != null
}

function compareStoryboardShotNodes(a: Node, b: Node): number {
  const aNum = resolveStoryboardShotNumber(readCanvasVideoNodeData(a)) ?? 9999
  const bNum = resolveStoryboardShotNumber(readCanvasVideoNodeData(b)) ?? 9999
  if (aNum !== bNum) return aNum - bNum
  return a.position.y - b.position.y || a.position.x - b.position.x || a.id.localeCompare(b.id)
}

/** 按镜号排序节点（无镜号排末尾，再按画布位置） */
export function compareNodesByStoryboardShot(a: Node, b: Node): number {
  return compareStoryboardShotNodes(a, b)
}

/** 删除分镜镜时的 toast 文案；无镜号时返回 null */
export function formatDeletedStoryboardShotsToast(shotNumbers: readonly number[]): string | null {
  const unique = [...new Set(shotNumbers.filter((n) => Number.isFinite(n) && n > 0))].sort(
    (a, b) => a - b,
  )
  if (!unique.length) return null
  if (unique.length === 1) return `已删除镜 ${unique[0]}`
  if (unique.length <= 4) return `已删除镜 ${unique.join('、镜 ')}`
  return `已删除 ${unique.length} 镜（镜 ${unique.slice(0, 3).join('、镜 ')} 等）`
}

export function collectStoryboardShotNumbersFromNodes(
  nodes: Node[],
  nodeIds: Iterable<string>,
): number[] {
  const idSet = new Set(nodeIds)
  const numbers: number[] = []
  for (const node of nodes) {
    if (!idSet.has(node.id) || !isStoryboardShotNode(node)) continue
    const shotNumber = resolveStoryboardShotNumber(readCanvasVideoNodeData(node))
    if (shotNumber != null) numbers.push(shotNumber)
  }
  return numbers
}

export function formatStoryboardShotsDeleteConfirmDescription(shotNumbers: readonly number[]): string {
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

/** 画布上所有智能分镜视频节点，按镜号排序 */
export function collectStoryboardShotNodes(nodes: Node[]): Node[] {
  return nodes.filter(isStoryboardShotNode).sort(compareStoryboardShotNodes)
}

export function resolveStoryboardShotTitlePhase(data: CanvasVideoNodeData): StoryboardShotTitlePhase {
  if (data.needsRegen && hasCanvasVideoLocalOutput(data)) return 'needs-update'
  if (data.status === 'running') return 'generating'
  if (data.status === 'error') return 'failed'
  if (data.status === 'success' && hasCanvasVideoLocalOutput(data)) return 'ready'
  return 'draft'
}

/** 节点标题展示阶段（含运行中遮罩等 UI 态） */
export function resolveStoryboardShotDisplayPhase(
  data: CanvasVideoNodeData,
  options?: { running?: boolean },
): StoryboardShotTitlePhase {
  if (options?.running) return 'generating'
  return resolveStoryboardShotTitlePhase(data)
}

/** 成片后修改 prompt 时标记待重生成 */
export function shouldMarkStoryboardShotNeedsRegen(
  data: CanvasVideoNodeData,
  nextPrompt: string,
): boolean {
  const shotNumber = resolveStoryboardShotNumber(data)
  if (shotNumber == null) return false
  if (!hasCanvasVideoLocalOutput(data)) return false
  return nextPrompt !== String(data.prompt || '')
}

/** 编辑本镜描述保存补丁 */
export function buildStoryboardShotDescriptionSavePatch(
  data: CanvasVideoNodeData,
  next: { prompt: string; dialogue: string },
): Partial<CanvasVideoNodeData> {
  const prompt = next.prompt
  const dialogue = next.dialogue.trim()
  const patch: Partial<CanvasVideoNodeData> = {
    prompt,
    dialogue: dialogue || undefined,
  }
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

/** 控制台内联改 prompt（分镜节点同步 needsRegen 规则） */
export function buildStoryboardShotPromptPatch(
  data: CanvasVideoNodeData,
  nextPrompt: string,
): Partial<CanvasVideoNodeData> {
  return buildStoryboardShotDescriptionSavePatch(data, {
    prompt: nextPrompt,
    dialogue: String(data.dialogue || ''),
  })
}

export function formatStoryboardShotTitle(options: {
  shotNumber: number
  dialogue?: string
  phase?: StoryboardShotTitlePhase
  status?: CanvasNodeStatus
  needsRegen?: boolean
  hasOutput?: boolean
}): string {
  const phase =
    options.phase ??
    (options.needsRegen && options.hasOutput
      ? 'needs-update'
      : options.status === 'running'
        ? 'generating'
        : options.status === 'error'
          ? 'failed'
          : options.status === 'success' && options.hasOutput
            ? 'ready'
            : 'draft')

  const suffix = STORYBOARD_SHOT_TITLE_SUFFIX[phase]
  const dialogue = String(options.dialogue || '').trim()
  const head = `镜 ${options.shotNumber} · ${suffix}`
  return dialogue ? `${head} · ${dialogue}` : head
}

/** 是否尚未出片（无有效 outputPath） */
export function isStoryboardShotWithoutOutput(data: CanvasVideoNodeData): boolean {
  return !hasCanvasVideoLocalOutput(data)
}

/** 是否应纳入「全部生成」默认范围（含手动添加的视频节点） */
export function isPendingCanvasVideoNode(node: Node): boolean {
  if (node.type !== CANVAS_NODE_TYPES.storyVideo) return false
  const data = readCanvasVideoNodeData(node)
  if (data.status === 'running') return false
  if (data.needsRegen) return true
  if (data.status === 'error') return true
  return isStoryboardShotWithoutOutput(data)
}

/** 是否应纳入「全部生成」默认范围（仅智能分镜镜号节点） */
export function isPendingStoryboardShotNode(node: Node): boolean {
  if (!isStoryboardShotNode(node)) return false
  return isPendingCanvasVideoNode(node)
}

function comparePendingCanvasVideoNodes(a: Node, b: Node): number {
  const aIsStoryboard = isStoryboardShotNode(a)
  const bIsStoryboard = isStoryboardShotNode(b)
  if (aIsStoryboard && bIsStoryboard) return compareStoryboardShotNodes(a, b)
  if (aIsStoryboard !== bIsStoryboard) return aIsStoryboard ? -1 : 1
  return a.position.y - b.position.y || a.position.x - b.position.x || a.id.localeCompare(b.id)
}

/** 待生成 / 待更新 / 失败待重试的视频节点（分镜镜号优先排序） */
export function collectPendingCanvasVideos(nodes: Node[]): Node[] {
  return nodes.filter(isPendingCanvasVideoNode).sort(comparePendingCanvasVideoNodes)
}

/** 待生成 / 待更新 / 失败待重试的分镜节点，按镜号排序 */
export function collectPendingStoryboardShots(nodes: Node[]): Node[] {
  return collectPendingCanvasVideos(nodes)
}

/** 「全部生成」待处理镜号列表（按镜号升序） */
export function collectPendingStoryboardShotNumbers(nodes: Node[]): number[] {
  return collectPendingStoryboardShots(nodes)
    .map((node) => resolveStoryboardShotNumber(readCanvasVideoNodeData(node)))
    .filter((shotNumber): shotNumber is number => shotNumber != null)
}

export interface PendingStoryboardShotItem {
  nodeId: string
  /** 智能分镜镜号；手动视频节点无镜号 */
  shotNumber?: number
  /** 镜号后的名称（台词 / 节点名 / 描述摘要） */
  name: string
  /** 列表展示（含台词 / 提示词摘要） */
  label: string
  /** 仅镜头名称（镜号或视频节点名） */
  title: string
}

const STORYBOARD_STATUS_TOKENS = new Set(Object.values(STORYBOARD_SHOT_TITLE_SUFFIX))

function normalizeStoryboardLabelSeparators(text: string): string {
  return text.replace(/[\u00B7·•]/g, '·').replace(/\s+/g, ' ').trim()
}

function splitStoryboardLabelSegments(text: string): string[] {
  return normalizeStoryboardLabelSeparators(text)
    .split(/[·\-—]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function resolvePendingStoryboardShotName(data: CanvasVideoNodeData): string {
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

export function formatPendingStoryboardShotLabel(shotNumber: number, name: string): string {
  const trimmed = name.trim()
  return trimmed ? `镜 ${shotNumber} · ${trimmed}` : `镜 ${shotNumber}`
}

export function formatPendingCanvasVideoItemLabel(data: CanvasVideoNodeData): string {
  const shotNumber = resolveStoryboardShotNumber(data)
  const name = resolvePendingStoryboardShotName(data)
  if (shotNumber != null) {
    return formatPendingStoryboardShotLabel(shotNumber, name)
  }
  const title = resolveCanvasVideoDisplayName({ videoName: data.videoName }).label.trim()
  return name ? `${title} · ${name}` : title
}

/** 待生成列表仅展示镜头名称（不含台词 / 提示词） */
export function formatPendingCanvasVideoItemTitle(data: CanvasVideoNodeData): string {
  const shotNumber = resolveStoryboardShotNumber(data)
  if (shotNumber != null) {
    return `镜 ${shotNumber}`
  }
  return resolveCanvasVideoDisplayName({ videoName: data.videoName }).label.trim() || '视频'
}

/** 「全部生成」确认弹窗：待处理视频条目（含 nodeId） */
export function collectPendingStoryboardShotItems(nodes: Node[]): PendingStoryboardShotItem[] {
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

/** 批量生成：待处理视频且已有提示词 */
export function collectBatchStoryboardShotTargets(nodes: Node[]): Node[] {
  return collectPendingCanvasVideos(nodes).filter((node) => {
    const prompt = String(readCanvasVideoNodeData(node).prompt || '').trim()
    return Boolean(prompt)
  })
}

export const STORYBOARD_VIDEO_GENERATED_LABEL = '视频生成完成'
export const STORYBOARD_VIDEO_FAILED_LABEL = '视频生成失败'

function withGenerationToastErrorDetail(base: string, errorMessage?: string): string {
  const detail = errorMessage?.trim()
  if (!detail || detail === base || base.endsWith(`：${detail}`)) return base
  return `${base}（${detail}）`
}

function formatStoryboardVideoSubject(
  data: Pick<CanvasVideoNodeData, 'shotNumber' | 'importShotNumber' | 'videoName'>,
): string {
  const shotNumber = resolveStoryboardShotNumber(data as CanvasVideoNodeData)
  if (shotNumber != null) return `镜号 ${shotNumber}`
  const name = resolveCanvasVideoDisplayName({ videoName: data.videoName }).label.trim()
  return name || '视频'
}

/** 画布/分镜视频生成成功 toast */
export function formatStoryboardVideoGeneratedToast(
  data: Pick<CanvasVideoNodeData, 'shotNumber' | 'importShotNumber' | 'videoName'>,
): string {
  const shotNumber = resolveStoryboardShotNumber(data as CanvasVideoNodeData)
  if (shotNumber != null) {
    return `镜号 ${shotNumber}：${STORYBOARD_VIDEO_GENERATED_LABEL}`
  }
  const name = resolveCanvasVideoDisplayName({ videoName: data.videoName }).label.trim()
  return name ? `${name}：${STORYBOARD_VIDEO_GENERATED_LABEL}` : STORYBOARD_VIDEO_GENERATED_LABEL
}

/** 画布/分镜视频生成失败 toast */
export function formatStoryboardVideoFailedToast(
  data: Pick<CanvasVideoNodeData, 'shotNumber' | 'importShotNumber' | 'videoName'>,
  errorMessage?: string,
): string {
  const base = `${formatStoryboardVideoSubject(data)}：${STORYBOARD_VIDEO_FAILED_LABEL}`
  return withGenerationToastErrorDetail(base, errorMessage)
}

export function formatCanvasShotNumberList(
  items: Array<Pick<CanvasVideoNodeData, 'shotNumber' | 'importShotNumber' | 'videoName'>>,
  maxNames = 4,
): string {
  if (!items.length) return ''
  const labels = items.map((data) => {
    const shotNumber = resolveStoryboardShotNumber(data as CanvasVideoNodeData)
    if (shotNumber != null) return `镜号 ${shotNumber}`
    const name = resolveCanvasVideoDisplayName({ videoName: data.videoName }).label.trim()
    return name || '视频'
  })
  if (labels.length === 1) return labels[0]!
  if (labels.length <= maxNames) return labels.join('、')
  return `${labels.slice(0, maxNames).join('、')} 等 ${labels.length} 个`
}

export function formatBatchStoryboardVideoToast(
  successItems: Array<Pick<CanvasVideoNodeData, 'shotNumber' | 'importShotNumber' | 'videoName'>>,
  failedItems: Array<Pick<CanvasVideoNodeData, 'shotNumber' | 'importShotNumber' | 'videoName'>>,
): string {
  const prefix = '批量生成视频完成'
  if (failedItems.length === 0) {
    return `${prefix}：${formatCanvasShotNumberList(successItems)}`
  }
  if (successItems.length > 0) {
    return `${prefix}：成功 ${formatCanvasShotNumberList(successItems)}，失败 ${formatCanvasShotNumberList(failedItems)}`
  }
  return `批量生成视频失败：${formatCanvasShotNumberList(failedItems)}`
}
