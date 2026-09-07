// Copyright (c) Haode AI. All rights reserved.

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { CanvasNodeShell } from '@/components/canvas/canvas-node-shell'
import { CanvasImageRolePicker } from '@/components/canvas/nodes/canvas-image-role-picker'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'
import type { CanvasReferenceImageNodeData } from '@/types/canvas-nodes'
import { useCanvasImagePreview } from '@/hooks/use-canvas-media-preview'
import { useAdaptiveImageFrame } from '@/hooks/use-adaptive-image-frame'
import { pickCanvasLocalImage } from '@/lib/canvas/canvas-media-save'
import { resolveCanvasImageTitle } from '@/lib/canvas/canvas-image-role'
import { CANVAS_GRAPH_SHOT_REF_WIDTH } from '@/lib/canvas/canvas-graph-layout'
import { cn } from '@/lib/utils'

function CanvasReferenceImageNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as CanvasReferenceImageNodeData
  const { projectId, updateNodeData } = useCanvasEditor()
  const [uploading, setUploading] = useState(false)
  const isShotRefStrip = Boolean(nodeData.exportShotRefStrip)
  const { src: previewSrc } = useCanvasImagePreview(
    nodeData.imagePath,
    projectId,
    nodeData.mediaOwnerKind,
    nodeData.mediaOwnerProjectId,
  )
  const { frameStyle, onImageLoad } = useAdaptiveImageFrame(previewSrc)
  const assetRole = nodeData.assetRole ?? 'character'
  const titleMeta = resolveCanvasImageTitle({ assetRole })
  const title = nodeData.label?.trim() || titleMeta.label
  const nodeWidthPx = isShotRefStrip ? CANVAS_GRAPH_SHOT_REF_WIDTH : 280
  const widthClass = isShotRefStrip ? `w-[${CANVAS_GRAPH_SHOT_REF_WIDTH}px]` : 'w-[280px]'

  const handleUpload = useCallback(async () => {
    if (uploading) return
    setUploading(true)
    try {
      const imagePath = await pickCanvasLocalImage({
        projectId,
        nodeId: id,
        kind: 'reference',
      })
      if (!imagePath) return
      updateNodeData(id, {
        imagePath,
        mediaOwnerKind: 'canvas',
        mediaOwnerProjectId: projectId,
        status: 'success',
        error: undefined,
        pickOnMount: false,
      })
      toast.success('图片已上传')
    } catch (error: unknown) {
      toast.error((error as Error).message || '上传图片失败')
    } finally {
      setUploading(false)
    }
  }, [uploading, projectId, id, updateNodeData])

  const pickStartedRef = useRef(false)
  useEffect(() => {
    if (!nodeData.pickOnMount || pickStartedRef.current || previewSrc) return
    pickStartedRef.current = true
    void handleUpload()
  }, [nodeData.pickOnMount, previewSrc, handleUpload])

  return (
    <CanvasNodeShell
      nodeId={id}
      nodeWidthPx={nodeWidthPx}
      widthClass={widthClass}
      title={title}
      accentClass={titleMeta.colorClass}
      selected={selected}
      status={nodeData.status}
      error={nodeData.error}
    >
      {!isShotRefStrip ? (
        <CanvasImageRolePicker
          value={assetRole}
          onChange={(role) => updateNodeData(id, { assetRole: role })}
          className="mb-2 w-full justify-center"
          compact
        />
      ) : null}
      <button
        type="button"
        disabled={uploading}
        onClick={() => void handleUpload()}
        className={cn(
          'w-full rounded-xl border border-dashed border-border/40 overflow-hidden',
          'flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground',
          'hover:bg-muted/30 transition-colors disabled:opacity-60',
          previewSrc ? 'border-solid border-border/40' : 'aspect-[4/3]',
        )}
        style={previewSrc ? frameStyle : undefined}
      >
        {previewSrc ? (
          <img
            src={previewSrc}
            alt=""
            className="h-full w-full object-contain"
            onLoad={onImageLoad}
          />
        ) : uploading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin opacity-60" />
            上传中…
          </>
        ) : (
          <>
            <ImagePlus className="h-5 w-5 opacity-60" />
            点击上传图片
          </>
        )}
      </button>
      {!previewSrc && !isShotRefStrip ? (
        <p className="text-[10px] text-muted-foreground">作为{titleMeta.label}参考连接到生图节点</p>
      ) : null}
    </CanvasNodeShell>
  )
}

export const CanvasReferenceImageNode = memo(CanvasReferenceImageNodeComponent)
