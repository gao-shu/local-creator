// Copyright (c) local-creator contributors. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { CanvasFilerobotEditor } from '@/components/canvas/canvas-filerobot-editor'
import {
  loadCanvasImageForEdit,
  resolveCanvasImageEditDefaultName,
  saveCanvasEditedImage,
} from '@/lib/canvas/canvas-image-edit-service'
import type { CanvasMediaOwnerKind } from '@/types/canvas-nodes'
import { cn } from '@/lib/utils'

export interface CanvasImageEditDialogProps {
  open: boolean
  projectId: string
  nodeId: string
  outputPath?: string
  imageName?: string
  outputOwnerKind?: CanvasMediaOwnerKind
  outputOwnerProjectId?: string
  onClose: () => void
  /** 保存成功后回写节点 outputPath */
  onSaved: (newOutputPath: string) => void
}

/** 画布图片节点：Filerobot 就地编辑并回写 outputPath */
export function CanvasImageEditDialog({
  open,
  projectId,
  nodeId,
  outputPath,
  imageName,
  outputOwnerKind,
  outputOwnerProjectId,
  onClose,
  onSaved,
}: CanvasImageEditDialogProps) {
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setSource('')
      setLoading(false)
      setSaving(false)
      setError('')
      return
    }

    const storedPath = String(outputPath || '').trim()
    if (!storedPath) {
      setError('当前节点没有可编辑的图片')
      setSource('')
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    setSource('')

    void loadCanvasImageForEdit({
      projectId,
      nodeId,
      outputPath: storedPath,
      outputOwnerKind,
      outputOwnerProjectId,
    })
      .then(({ dataUrl }) => {
        if (!cancelled) {
          setSource(dataUrl)
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError((loadError as Error).message || '图片加载失败')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [nodeId, open, outputOwnerKind, outputOwnerProjectId, outputPath, projectId])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open, saving])

  const handleSave = useCallback(
    async (dataUrl: string) => {
      setSaving(true)
      try {
        const newOutputPath = await saveCanvasEditedImage({
          projectId,
          nodeId,
          dataUrl,
        })
        onSaved(newOutputPath)
        toast.success('图片编辑已保存')
        onClose()
      } catch (saveError: unknown) {
        const message = (saveError as Error).message || '图片保存失败'
        toast.error(message)
        throw saveError
      } finally {
        setSaving(false)
      }
    },
    [nodeId, onClose, onSaved, projectId],
  )

  if (!open) return null

  const defaultSavedImageName = resolveCanvasImageEditDefaultName({ outputPath, imageName })

  return createPortal(
    <div
      className="fixed inset-0 z-[230] flex flex-col bg-[#121316]"
      data-testid="canvas-image-edit-dialog"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="text-[14px] font-medium text-white">编辑图片</h2>
          <p className="text-[11px] text-white/45">保存后将更新当前节点图片，原文件保留</p>
        </div>
        <button
          type="button"
          aria-label="关闭编辑"
          title="关闭"
          disabled={saving}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/[0.06] hover:text-white',
            saving && 'pointer-events-none opacity-40',
          )}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-white/70">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            <span className="text-sm">正在加载图片…</span>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertCircle className="h-8 w-8 text-red-400/90" />
            <p className="max-w-md text-[13px] leading-relaxed text-white/70">{error}</p>
            <button
              type="button"
              className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/[0.12]"
              onClick={onClose}
            >
              关闭
            </button>
          </div>
        ) : null}

        {!loading && !error && source ? (
          <CanvasFilerobotEditor
            source={source}
            defaultSavedImageName={defaultSavedImageName}
            onSave={handleSave}
            onClose={onClose}
            className="h-full min-h-0"
          />
        ) : null}

        {saving ? (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-[12px] text-white/85 backdrop-blur-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              正在保存…
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
