// Copyright (c) local-creator contributors. All rights reserved.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AtSign,
  Box,
  Check,
  ChevronDown,
  Download,
  FolderDown,
  Loader2,
  Maximize2,
  MoreHorizontal,
  Mountain,
  Pencil,
  Shrink,
  Tag,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import type { CanvasImageAssetRole } from '@/types/canvas-nodes'
import {
  CANVAS_IMAGE_ROLE_MENTION_LABELS,
  CANVAS_IMAGE_ROLE_OPTIONS,
} from '@/lib/canvas/canvas-image-role'
import { downloadImagePreview } from '@/lib/canvas/canvas-image-actions'
import { materialLibrarySyncButtonLabel, materialLibrarySyncButtonTip } from '@/lib/materials/material-library-service'
import {
  CANVAS_NODE_DROPDOWN,
  CANVAS_NODE_DROPDOWN_ITEM,
  CANVAS_NODE_TOOLBAR,
} from '@/lib/canvas/canvas-node-theme'
import { cn } from '@/lib/utils'

interface CanvasImageTopToolbarProps {
  nodeId?: string
  /** 节点是否已有可删除的图片文件（以 outputPath 为准，避免预览缓存误判） */
  hasImage?: boolean
  previewSrc?: string
  assetRole?: CanvasImageAssetRole
  assetRoleConverted?: boolean
  running?: boolean
  uploading?: boolean
  compressing?: boolean
  onUpload: () => void
  onDelete: () => void
  onAssetRoleChange: (role: CanvasImageAssetRole) => void
  onCancelAssetRoleConversion?: () => void
  onEditImage: () => void
  onCompressImage: () => void
  onSaveToMaterialLibrary: () => void
  savingMaterial?: boolean
  syncedToMaterialLibrary?: boolean
}

function ToolbarButton({
  title,
  label,
  icon,
  active,
  disabled,
  onClick,
  testId,
}: {
  title: string
  label?: string
  icon: ReactNode
  active?: boolean
  disabled?: boolean
  onClick: () => void
  testId?: string
}) {
  return (
    <button
      type="button"
      title={title}
      data-testid={testId}
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'nodrag nopan inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5',
        'text-[12px] transition-colors',
        'text-foreground/75 hover:bg-muted/60 hover:text-foreground',
        'dark:text-white/75 dark:hover:bg-white/[0.08] dark:hover:text-white',
        'disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-muted/70 text-foreground dark:bg-white/10 dark:text-white',
      )}
    >
      {icon}
      {label ? <span className="whitespace-nowrap">{label}</span> : null}
    </button>
  )
}

function MenuItemButton({
  className,
  disabled,
  onClick,
  children,
  testId,
}: {
  className?: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  testId?: string
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn('nodrag nopan', className)}
    >
      {children}
    </button>
  )
}

function IconBtn({
  title,
  icon,
  danger,
  disabled,
  onClick,
}: {
  title: string
  icon: ReactNode
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        'nodrag nopan inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
        'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        'dark:text-white/70 dark:hover:bg-white/[0.08] dark:hover:text-white',
        danger && 'hover:bg-red-500/15 hover:text-red-500 dark:hover:bg-red-500/25 dark:hover:text-red-300',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      {icon}
    </button>
  )
}

/** 画镜画布工坊：图片展开工具栏后，预览区正上方操作条 */
export function CanvasImageTopToolbar({
  nodeId,
  hasImage = false,
  previewSrc,
  assetRole = 'character',
  assetRoleConverted = false,
  running = false,
  uploading = false,
  compressing = false,
  onUpload,
  onDelete,
  onAssetRoleChange,
  onCancelAssetRoleConversion,
  onEditImage,
  onCompressImage,
  onSaveToMaterialLibrary,
  savingMaterial = false,
  syncedToMaterialLibrary = false,
}: CanvasImageTopToolbarProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [markOpen, setMarkOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const markRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)

  const imageActionsDisabled =
    !hasImage || !previewSrc || running || uploading || compressing
  /** 就地编辑只依赖 outputPath，不等待预览 dataURL */
  const imageEditDisabled = !hasImage || running || uploading || compressing
  const materialSaveDisabled =
    imageActionsDisabled || savingMaterial || !assetRoleConverted
  const materialSaveTip = materialLibrarySyncButtonTip({
    synced: syncedToMaterialLibrary,
    hasMedia: Boolean(hasImage && previewSrc),
    needsAssetRoleMark: !assetRoleConverted,
  })

  useEffect(() => {
    if (!markOpen && !moreOpen) return
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node
      if (markOpen && markRef.current && !markRef.current.contains(target)) setMarkOpen(false)
      if (moreOpen && moreRef.current && !moreRef.current.contains(target)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [markOpen, moreOpen])

  const roleLabel = CANVAS_IMAGE_ROLE_MENTION_LABELS[assetRole]

  const roleMenuIcon = (role: CanvasImageAssetRole) => {
    if (role === 'character') return <UserRound className="h-3.5 w-3.5 shrink-0" />
    if (role === 'scene') return <Mountain className="h-3.5 w-3.5 shrink-0" />
    return <Box className="h-3.5 w-3.5 shrink-0" />
  }

  return (
    <>
      <div
        className={cn('nodrag nopan flex w-full items-center gap-1 px-1.5 py-1', CANVAS_NODE_TOOLBAR)}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
          <ToolbarButton
            title="上传图片"
            label={uploading ? '上传中…' : '上传'}
            disabled={running || uploading || compressing}
            icon={
              uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" strokeWidth={2} />
              )
            }
            onClick={onUpload}
          />

          <div ref={markRef} className="relative shrink-0">
            <ToolbarButton
              title={assetRoleConverted ? `已标记为 @${roleLabel}` : '标记为人物/场景/道具'}
              label={assetRoleConverted ? `@${roleLabel}` : '标记'}
              icon={
                assetRoleConverted ? (
                  <>
                    <AtSign className="h-3.5 w-3.5" />
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </>
                ) : (
                  <>
                    <Tag className="h-4 w-4" strokeWidth={2} />
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </>
                )
              }
              active={markOpen}
              disabled={running || uploading || compressing}
              onClick={() => {
                setMoreOpen(false)
                setMarkOpen((open) => !open)
              }}
            />
            {markOpen ? (
              <div className={cn('nodrag nopan absolute left-0 top-full z-30 mt-1 min-w-[148px] overflow-hidden', CANVAS_NODE_DROPDOWN)}>
                {CANVAS_IMAGE_ROLE_OPTIONS.map((role) => (
                  <MenuItemButton
                    key={role}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors',
                      CANVAS_NODE_DROPDOWN_ITEM,
                      assetRoleConverted && role === assetRole && 'text-foreground dark:text-white',
                    )}
                    onClick={() => {
                      onAssetRoleChange(role)
                      setMarkOpen(false)
                    }}
                  >
                    {roleMenuIcon(role)}
                    <span className="min-w-0 flex-1">
                      {assetRoleConverted
                        ? CANVAS_IMAGE_ROLE_MENTION_LABELS[role]
                        : `标记为${CANVAS_IMAGE_ROLE_MENTION_LABELS[role]}`}
                    </span>
                    {assetRoleConverted && role === assetRole ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    ) : null}
                  </MenuItemButton>
                ))}
                {assetRoleConverted ? (
                  <>
                    <div className="my-1 border-t border-border/40 dark:border-white/10" />
                    <MenuItemButton
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-red-400 transition-colors hover:bg-red-500/10"
                      onClick={() => {
                        onCancelAssetRoleConversion?.()
                        setMarkOpen(false)
                      }}
                    >
                      <X className="h-3.5 w-3.5 shrink-0" />
                      取消转换
                    </MenuItemButton>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <ToolbarButton
            title={materialSaveTip}
            label={materialLibrarySyncButtonLabel(syncedToMaterialLibrary)}
            testId={nodeId ? `canvas-node-${nodeId}-save-material` : undefined}
            disabled={materialSaveDisabled}
            icon={
              savingMaterial ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderDown className="h-4 w-4" strokeWidth={2} />
              )
            }
            onClick={onSaveToMaterialLibrary}
          />

          <ToolbarButton
            title="编辑图片"
            label="编辑"
            testId={nodeId ? `canvas-node-${nodeId}-edit-image` : undefined}
            disabled={imageEditDisabled}
            icon={<Pencil className="h-4 w-4" strokeWidth={2} />}
            onClick={onEditImage}
          />

          <div ref={moreRef} className="relative shrink-0">
            <ToolbarButton
              title="更多"
              testId={nodeId ? `canvas-node-${nodeId}-more` : undefined}
              active={moreOpen}
              disabled={running || uploading || compressing}
              icon={<MoreHorizontal className="h-4 w-4" strokeWidth={2} />}
              onClick={() => {
                setMarkOpen(false)
                setMoreOpen((open) => !open)
              }}
            />
            {moreOpen ? (
              <div
                className={cn(
                  'nodrag nopan absolute left-0 top-full z-30 mt-1 min-w-[160px] overflow-hidden',
                  CANVAS_NODE_DROPDOWN,
                )}
              >
                <MenuItemButton
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px]',
                    CANVAS_NODE_DROPDOWN_ITEM,
                  )}
                  testId={nodeId ? `canvas-node-${nodeId}-compress-image` : undefined}
                  disabled={imageActionsDisabled}
                  onClick={() => {
                    setMoreOpen(false)
                    onCompressImage()
                  }}
                >
                  {compressing ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <Shrink className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {compressing ? '压缩中…' : '压缩到5MB'}
                </MenuItemButton>
              </div>
            ) : null}
          </div>
        </div>

        {hasImage ? (
          <>
            <div className="mx-0.5 h-5 w-px shrink-0 bg-border/45" />
            <div className="flex shrink-0 items-center gap-0.5">
              <IconBtn
                title="下载"
                disabled={imageActionsDisabled}
                icon={<Download className="h-4 w-4" strokeWidth={2} />}
                onClick={() => {
                  if (imageActionsDisabled || !previewSrc) return
                  try {
                    downloadImagePreview(previewSrc)
                  } catch {
                    toast.error('下载失败')
                  }
                }}
              />
              <IconBtn
                title="放大预览"
                disabled={imageActionsDisabled}
                icon={<Maximize2 className="h-4 w-4" strokeWidth={2} />}
                onClick={() => {
                  if (imageActionsDisabled || !previewSrc) return
                  setPreviewOpen(true)
                }}
              />
              <IconBtn
                title="删除图片"
                danger
                disabled={imageActionsDisabled}
                icon={<Trash2 className="h-4 w-4" strokeWidth={2} />}
                onClick={() => {
                  if (imageActionsDisabled) return
                  onDelete()
                }}
              />
            </div>
          </>
        ) : null}
      </div>

      {previewOpen && previewSrc
        ? createPortal(
            <button
              type="button"
              aria-label="关闭预览"
              className="fixed inset-0 z-[220] flex items-center justify-center bg-black/88 p-6"
              onClick={() => setPreviewOpen(false)}
            >
              <img
                src={previewSrc}
                alt=""
                className="max-h-[92vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              />
            </button>,
            document.body,
          )
        : null}
    </>
  )
}
