// Copyright (c) local-creator contributors. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ImageIcon, Images, Loader2, Sparkles, Upload, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { CanvasCoverCandidate, CanvasCoverChange } from '@/lib/canvas/canvas-cover-utils'
import type { CanvasProjectMeta } from '@/types/canvas'

export interface EditCanvasProjectPayload {
  title: string
  description?: string
  coverChange?: CanvasCoverChange
}

interface EditCanvasProjectDialogProps {
  open: boolean
  project: CanvasProjectMeta | null
  loadingContext?: boolean
  autoPreviewUrls: string[]
  manualPreviewUrl?: string | null
  hasManualCover: boolean
  nodeCandidates: CanvasCoverCandidate[]
  nodePreviewUrls: Record<string, string>
  onClose: () => void
  onSubmit: (payload: EditCanvasProjectPayload) => Promise<void>
  onPickCoverFile: () => Promise<string | null>
}

function CoverPreviewGrid({ urls }: { urls: string[] }) {
  const validUrls = urls.filter(Boolean)

  if (!validUrls.length) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
        <ImageIcon className="h-8 w-8 opacity-30 mb-2" />
        <span className="text-xs opacity-60">暂无节点图，可上传封面</span>
      </div>
    )
  }

  if (validUrls.length === 1) {
    return <img src={validUrls[0]} alt="" className="absolute inset-0 h-full w-full object-cover" />
  }

  const gridClass =
    validUrls.length === 2
      ? 'grid-cols-2 grid-rows-1'
      : validUrls.length === 3
        ? 'grid-cols-2 grid-rows-2'
        : 'grid-cols-2 grid-rows-2'

  return (
    <div className={cn('absolute inset-0 grid gap-px bg-border/20', gridClass)}>
      {validUrls.slice(0, 4).map((url, index) => (
        <div
          key={`${url}-${index}`}
          className={cn(
            'relative overflow-hidden bg-muted/10',
            validUrls.length === 3 && index === 0 && 'row-span-2',
          )}
        >
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  )
}

function CoverModeBadge({ manual }: { manual: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium border',
        manual
          ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
          : 'border-border/40 bg-muted/30 text-muted-foreground',
      )}
    >
      {manual ? <ImageIcon className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
      {manual ? '手动封面' : '自动拼图'}
    </span>
  )
}

export function EditCanvasProjectDialog({
  open,
  project,
  loadingContext = false,
  autoPreviewUrls,
  manualPreviewUrl,
  hasManualCover,
  nodeCandidates,
  nodePreviewUrls,
  onClose,
  onSubmit,
  onPickCoverFile,
}: EditCanvasProjectDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverMode, setCoverMode] = useState<'auto' | 'manual'>('auto')
  const [draftManualPreview, setDraftManualPreview] = useState<string | null>(null)
  const [draftNodePath, setDraftNodePath] = useState<string | null>(null)
  const [draftUploadDataUrl, setDraftUploadDataUrl] = useState<string | null>(null)
  const [coverDirty, setCoverDirty] = useState(false)
  const [showNodePicker, setShowNodePicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !project) return
    setTitle(project.title)
    setDescription(project.description || '')
    setCoverMode(hasManualCover ? 'manual' : 'auto')
    setDraftManualPreview(manualPreviewUrl ?? null)
    setDraftNodePath(hasManualCover ? project.coverImagePath ?? null : null)
    setDraftUploadDataUrl(null)
    setCoverDirty(false)
    setShowNodePicker(false)
    setError('')
  }, [open, project, hasManualCover, manualPreviewUrl])

  const previewManual = coverMode === 'manual'
  const previewUrls = useMemo(() => {
    if (previewManual) {
      return draftManualPreview ? [draftManualPreview] : []
    }
    return autoPreviewUrls
  }, [autoPreviewUrls, draftManualPreview, previewManual])

  const handleClose = useCallback(() => {
    setError('')
    onClose()
  }, [onClose])

  const handlePickCoverFile = async () => {
    setPicking(true)
    try {
      const dataUrl = await onPickCoverFile()
      if (!dataUrl) return
      setDraftManualPreview(dataUrl)
      setDraftUploadDataUrl(dataUrl)
      setDraftNodePath(null)
      setCoverMode('manual')
      setCoverDirty(true)
      setShowNodePicker(false)
    } finally {
      setPicking(false)
    }
  }

  const handleSelectNode = (candidate: CanvasCoverCandidate) => {
    const preview = nodePreviewUrls[candidate.path]
    if (!preview) return
    setDraftManualPreview(preview)
    setDraftNodePath(candidate.path)
    setDraftUploadDataUrl(null)
    setCoverMode('manual')
    setCoverDirty(true)
    setShowNodePicker(false)
  }

  const handleRestoreAuto = () => {
    setCoverMode('auto')
    setDraftManualPreview(null)
    setDraftNodePath(null)
    setDraftUploadDataUrl(null)
    setCoverDirty(true)
    setShowNodePicker(false)
  }

  const buildCoverChange = (): CanvasCoverChange => {
    if (!coverDirty) return 'keep'
    if (coverMode === 'auto') return 'auto'
    if (draftUploadDataUrl) return { source: 'upload', dataUrl: draftUploadDataUrl }
    if (draftNodePath) return { source: 'asset', path: draftNodePath }
    return 'auto'
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('请输入项目名称')
      return
    }
    setLoading(true)
    setError('')
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        coverChange: buildCoverChange(),
      })
      handleClose()
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || '保存失败')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && project ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto w-full max-w-lg max-h-[90vh] flex flex-col"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div
                data-testid="canvas-edit-dialog"
                className="rounded-2xl border border-border/40 bg-card shadow-2xl shadow-black/20 flex flex-col overflow-hidden max-h-[90vh]"
              >
                <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
                  <h2 className="text-lg font-semibold">编辑画布项目</h2>
                  <button type="button" onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="px-6 space-y-4 pb-2 overflow-y-auto min-h-0">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      项目名称 <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      data-testid="canvas-edit-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className={cn(
                        'w-full px-3.5 py-2.5 rounded-xl text-sm',
                        'bg-muted/50 border border-border/40',
                        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
                      )}
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">项目描述</label>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={3}
                      className={cn(
                        'w-full px-3.5 py-2.5 rounded-xl text-sm resize-none',
                        'bg-muted/50 border border-border/40',
                        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
                      )}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <label className="text-sm font-medium">项目封面</label>
                      <CoverModeBadge manual={previewManual} />
                    </div>
                    <div className="relative aspect-[4/3] rounded-xl border border-border/40 overflow-hidden bg-muted/20">
                      {loadingContext ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <CoverPreviewGrid urls={previewUrls} />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                      {previewManual
                        ? '当前使用手动封面；移除后将恢复为节点图自动拼图。'
                        : '未设置手动封面时，将随画布节点图自动更新。'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <button
                        type="button"
                        disabled={picking || loadingContext}
                        onClick={() => void handlePickCoverFile()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border/40 hover:bg-muted/40 transition-colors"
                      >
                        {picking ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Upload className="h-3.5 w-3.5" />
                        )}
                        上传本地图片
                      </button>
                      <button
                        type="button"
                        disabled={loadingContext || nodeCandidates.length === 0}
                        onClick={() => setShowNodePicker((value) => !value)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border/40 hover:bg-muted/40 transition-colors disabled:opacity-50"
                      >
                        <Images className="h-3.5 w-3.5" />
                        从节点图选择
                      </button>
                      {(previewManual || hasManualCover) && coverMode === 'manual' ? (
                        <button
                          type="button"
                          onClick={handleRestoreAuto}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border/40 hover:bg-muted/40 transition-colors"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          恢复自动拼图
                        </button>
                      ) : null}
                    </div>

                    {showNodePicker ? (
                      <div className="mt-3 rounded-xl border border-border/40 bg-muted/10 p-2.5 max-h-52 overflow-y-auto">
                        {nodeCandidates.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            画布中暂无可选的节点图
                          </p>
                        ) : (
                          <NodeCoverPicker
                            items={nodeCandidates}
                            nodePreviewUrls={nodePreviewUrls}
                            selectedPath={draftNodePath}
                            onSelect={handleSelectNode}
                          />
                        )}
                      </div>
                    ) : null}
                  </div>

                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/20 mt-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    data-testid="canvas-edit-submit"
                    onClick={() => void handleSubmit()}
                    disabled={loading || loadingContext}
                    className={cn(
                      'px-5 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground',
                      'hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        保存中…
                      </span>
                    ) : (
                      '保存'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

function NodeCoverPicker({
  items,
  nodePreviewUrls,
  selectedPath,
  onSelect,
}: {
  items: CanvasCoverCandidate[]
  nodePreviewUrls: Record<string, string>
  selectedPath: string | null
  onSelect: (candidate: CanvasCoverCandidate) => void
}) {
  return (
    <div>
      <p className="text-[10px] font-medium text-muted-foreground mb-1.5 px-0.5">节点图</p>
      <div className="grid grid-cols-4 gap-1.5">
        {items.map((item) => {
          const preview = nodePreviewUrls[item.path]
          const selected = selectedPath === item.path
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              onClick={() => onSelect(item)}
              className={cn(
                'relative aspect-square rounded-md overflow-hidden border transition-all',
                selected
                  ? 'border-cyan-500 ring-2 ring-cyan-500/40'
                  : 'border-border/40 hover:border-border/70',
              )}
            >
              {preview ? (
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-muted/30">
                  <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
