// Copyright (c) Haode AI. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import { toast } from 'sonner'
import type { CanvasAddNodeConnection } from '@/lib/canvas/canvas-add-node-connection'
import type { AppSettings } from '@/types/settings'
import {
  resolveCanvasPromptExtractErrorMessage,
} from '@/lib/canvas/canvas-prompt-extract-action'
import {
  isCanvasPromptTextNode,
  readCanvasPromptNodeContent,
  resolveCanvasPromptSourceNode,
} from '@/lib/canvas/canvas-prompt-source'
import { resolveCanvasPromptBoundAssetNodeIds } from '@/lib/canvas/canvas-collect-prompt-assets'
import {
  resolveCanvasPromptStoryboardErrorMessage,
} from '@/lib/canvas/canvas-storyboard-action'
import {
  assessStoryboardTemplateLikeness,
} from '@/lib/canvas/canvas-storyboard-template-parse'
import { runCanvasStoryboardTemplateImport } from '@/lib/canvas/canvas-storyboard-template-action'
import { isCanvasPromptAiAbortError } from '@/lib/canvas/canvas-prompt-ai-cancel'
import {
  startCanvasPromptExtractTask,
  startCanvasPromptStoryboardTask,
} from '@/lib/canvas/canvas-prompt-ai-task-service'

export type CanvasPromptAiEditorContext = {
  projectId: string
  nodes: Node[]
  edges: Edge[]
  settings: AppSettings | null | undefined
  appendCanvasGraph: (nodes: Node[], edges: Edge[]) => void
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void
  openPromptConsole: (nodeId: string) => void
  onStoryboardNodesCreated?: (nodeIds: string[]) => void
  promptAiBusy?: PromptAiBusyState | null
  setPromptAiBusy?: (busy: PromptAiBusyState | null) => void
  removeNodesByIds?: (nodeIds: string[], options?: { silent?: boolean }) => void
}

export type CanvasPromptAiActionOptions = {
  /** 文本节点控制台内触发时，固定使用该节点（不依赖选中态） */
  sourceNodeId?: string
  /** 已有绑定资产时，用户已确认清空并重新提取 */
  confirmed?: boolean
}

/** 画布文本提取资产：已有绑定资产时需二次确认 */
export const CANVAS_REPLACE_EXTRACT_ASSETS_CONFIRM = {
  title: '重新提取资产？',
  description:
    '将清空该文本节点已绑定的角色、场景资产节点（含已生图内容），并按当前正文重新提取。此操作不可撤销。',
  confirmLabel: '继续提取',
  cancelLabel: '取消',
} as const

export type CanvasPromptExtractRunResult = boolean | 'needs_confirm'

export type PromptAiBusyKind = 'extract' | 'storyboard' | 'templateImport'

export interface PromptAiBusyState {
  kind: PromptAiBusyKind
  nodeId: string
}

/** 仅单选文本节点，或从文本节点连线拉出添加菜单时展示「从剧本」 */
export function shouldShowCanvasScriptMenuSection(
  nodes: Node[],
  addNodeAnchor?: { connection?: CanvasAddNodeConnection } | null,
): boolean {
  const connNodeId = addNodeAnchor?.connection?.nodeId
  if (connNodeId) {
    const anchorNode = nodes.find((node) => node.id === connNodeId)
    return Boolean(anchorNode && isCanvasPromptTextNode(anchorNode))
  }

  const selectedText = nodes.filter((node) => node.selected && isCanvasPromptTextNode(node))
  return selectedText.length === 1
}

export function isCanvasPromptAiBusy(
  busy: PromptAiBusyState | null | undefined,
): boolean {
  return Boolean(busy)
}

export function isPromptExtractActionDisabled(
  busy: PromptAiBusyState | null | undefined,
): boolean {
  return isCanvasPromptAiBusy(busy)
}

export function isPromptStoryboardActionDisabled(
  busy: PromptAiBusyState | null | undefined,
): boolean {
  return isCanvasPromptAiBusy(busy)
}

export function isPromptTemplateImportActionDisabled(
  busy: PromptAiBusyState | null | undefined,
): boolean {
  return isCanvasPromptAiBusy(busy)
}

function resolvePromptSource(
  ctx: CanvasPromptAiEditorContext,
  options?: CanvasPromptAiActionOptions,
) {
  let sourceNode = null as ReturnType<typeof resolveCanvasPromptSourceNode>['node']
  const preferredId = options?.sourceNodeId?.trim()
  if (preferredId) {
    const node = ctx.nodes.find((item) => item.id === preferredId)
    if (!node || !isCanvasPromptTextNode(node)) {
      toast.error('文本节点不存在')
      return null
    }
    sourceNode = node
  } else {
    const resolved = resolveCanvasPromptSourceNode(ctx.nodes)
    if (!resolved.node) {
      toast.error(resolved.hint || '未找到文本节点')
      return null
    }
    sourceNode = resolved.node
  }

  const content = readCanvasPromptNodeContent(sourceNode)
  if (!content) {
    toast.error('请先在文本节点输入小说或剧本内容')
    return null
  }
  if (!ctx.settings) {
    toast.error('设置未加载，请稍后重试')
    return null
  }
  return { sourceNode, content }
}

/** 智能分镜：与底部 AI 栏 / 文本节点控制台行为一致 */
export async function runCanvasEditorPromptStoryboard(
  ctx: CanvasPromptAiEditorContext,
  options?: CanvasPromptAiActionOptions,
): Promise<boolean> {
  if (isCanvasPromptAiBusy(ctx.promptAiBusy)) return false

  const source = resolvePromptSource(ctx, options)
  if (!source) return false

  const templateLikeness = assessStoryboardTemplateLikeness(source.content)
  if (templateLikeness.strong) {
    toast.message(
      `正文含 ${templateLikeness.shotBoundaryCount} 个镜头号分段，更建议改用「导入分镜稿」（本地解析，不耗 LLM）`,
      { duration: 5200 },
    )
  }

  ctx.setPromptAiBusy?.({ kind: 'storyboard', nodeId: source.sourceNode.id })
  ctx.openPromptConsole(source.sourceNode.id)

  const { promise } = startCanvasPromptStoryboardTask({
    projectId: ctx.projectId,
    sourceNode: source.sourceNode,
    content: source.content,
    settings: ctx.settings!,
    existingNodes: ctx.nodes,
    existingEdges: ctx.edges,
  })

  toast.info('智能分镜已在后台继续，可切换其他页面')

  try {
    const result = await promise
    // 用户取消：不落盘、不 toast 成功（取消提示由 cancelPromptAi 即时给出）
    if (result.cancelled) return false
    if (result.appliedToUi) {
      ctx.updateNodeData(source.sourceNode.id, {
        lastStoryboardSummary: result.summary,
      })
      if (result.createdNodeIds?.length) {
        ctx.onStoryboardNodesCreated?.(result.createdNodeIds)
      }
      toast.success(
        result.summary
          ? `已在右侧生成分镜：${result.summary}`
          : '智能分镜已完成',
      )
    }
    return true
  } catch (error) {
    if (isCanvasPromptAiAbortError(error)) return false
    toast.error(resolveCanvasPromptStoryboardErrorMessage(error))
    return false
  } finally {
    ctx.setPromptAiBusy?.(null)
  }
}

/** 提取资产：与底部 AI 栏 / 文本节点控制台行为一致 */
export async function runCanvasEditorPromptExtract(
  ctx: CanvasPromptAiEditorContext,
  options?: CanvasPromptAiActionOptions,
): Promise<CanvasPromptExtractRunResult> {
  if (isCanvasPromptAiBusy(ctx.promptAiBusy)) return false

  const source = resolvePromptSource(ctx, options)
  if (!source) return false

  const boundAssetIds = resolveCanvasPromptBoundAssetNodeIds(
    source.sourceNode.id,
    ctx.nodes,
    ctx.edges,
  )
  if (boundAssetIds.length && !options?.confirmed) {
    return 'needs_confirm'
  }

  const assetIdSet = new Set(boundAssetIds)
  const nodesAfterClear = ctx.nodes.filter((node) => !assetIdSet.has(node.id))
  const edgesAfterClear = ctx.edges.filter(
    (edge) => !assetIdSet.has(edge.source) && !assetIdSet.has(edge.target),
  )

  ctx.setPromptAiBusy?.({ kind: 'extract', nodeId: source.sourceNode.id })
  ctx.openPromptConsole(source.sourceNode.id)

  const { promise } = startCanvasPromptExtractTask({
    projectId: ctx.projectId,
    sourceNode: source.sourceNode,
    content: source.content,
    settings: ctx.settings!,
    existingNodes: nodesAfterClear,
    existingEdges: edgesAfterClear,
    boundAssetIds,
  })

  toast.info('资产提取已在后台继续，可切换其他页面')

  try {
    const result = await promise
    // 用户取消：不落盘、不 toast 成功（取消提示由 cancelPromptAi 即时给出）
    if (result.cancelled) return false
    if (result.appliedToUi) {
      ctx.updateNodeData(source.sourceNode.id, { lastExtractSummary: result.summary })
      toast.success(
        result.summary ? `已提取资产：${result.summary}` : '资产提取已完成',
      )
    }
    return true
  } catch (error) {
    if (isCanvasPromptAiAbortError(error)) return false
    toast.error(resolveCanvasPromptExtractErrorMessage(error))
    return false
  } finally {
    ctx.setPromptAiBusy?.(null)
  }
}

export type CanvasPromptTemplateImportOptions = {
  createShotPromptNodes?: boolean
  createVideoNodes?: boolean
}

/** 导入分镜稿：本地规则解析，同步落盘（与智能分镜互斥 busy） */
export function runCanvasEditorPromptTemplateImport(
  ctx: CanvasPromptAiEditorContext,
  options?: CanvasPromptAiActionOptions & CanvasPromptTemplateImportOptions,
): boolean {
  if (isCanvasPromptAiBusy(ctx.promptAiBusy)) return false

  let sourceNode = null as ReturnType<typeof resolveCanvasPromptSourceNode>['node']
  const preferredId = options?.sourceNodeId?.trim()
  if (preferredId) {
    const node = ctx.nodes.find((item) => item.id === preferredId)
    if (!node || !isCanvasPromptTextNode(node)) {
      toast.error('文本节点不存在')
      return false
    }
    sourceNode = node
  } else {
    const resolved = resolveCanvasPromptSourceNode(ctx.nodes)
    if (!resolved.node) {
      toast.error(resolved.hint || '未找到文本节点')
      return false
    }
    sourceNode = resolved.node
  }

  const content = readCanvasPromptNodeContent(sourceNode)
  if (!content) {
    toast.error('请先在文本节点粘贴分镜稿')
    return false
  }

  ctx.setPromptAiBusy?.({ kind: 'templateImport', nodeId: sourceNode.id })
  ctx.openPromptConsole(sourceNode.id)

  try {
    const result = runCanvasStoryboardTemplateImport({
      sourceNode,
      content,
      canvasProjectId: ctx.projectId,
      existingNodes: ctx.nodes,
      existingEdges: ctx.edges,
      options: {
        createShotPromptNodes: options?.createShotPromptNodes,
        createVideoNodes: options?.createVideoNodes,
      },
    })

    if (!result.nodes.length) {
      toast.error('未生成可导入的分镜节点')
      return false
    }

    ctx.appendCanvasGraph(result.nodes, result.edges)
    ctx.updateNodeData(sourceNode.id, {
      lastStoryboardSummary: result.summary,
    })
    if (result.nodes.length) {
      ctx.onStoryboardNodesCreated?.(result.nodes.map((node) => node.id))
    }

    const warnHint =
      result.warnings.length > 0
        ? `（${result.warnings.slice(0, 2).join('；')}${result.warnings.length > 2 ? '…' : ''}）`
        : ''
    toast.success(`${result.summary}${warnHint}`)
    if (result.warnings.length > 2) {
      toast.message(result.warnings.slice(2, 6).join('；'), { duration: 6000 })
    }
    return true
  } catch (error) {
    toast.error((error as Error)?.message || '导入分镜稿失败')
    return false
  } finally {
    ctx.setPromptAiBusy?.(null)
  }
}
