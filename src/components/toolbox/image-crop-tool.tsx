// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Crop, Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  CROP_ASPECT_PRESETS,
  cropImageDataUrl,
} from '@/lib/toolbox/image-crop'
import { getToolboxImportDir } from '@/lib/toolbox/toolbox-media-import'
import {
  revealPathInExplorer,
  saveDataUrlImage,
  selectReferenceImage,
} from '@/lib/storage/fs-service'
import { useSettingsStore } from '@/stores/settings-store'
import { cn } from '@/lib/utils'

export function ImageCropTool() {
  const appDataDir = useSettingsStore((s) => s.appDataDir)
  const [sourceDataUrl, setSourceDataUrl] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [aspectId, setAspectId] = useState(CROP_ASPECT_PRESETS[0].id)
  const [coverage, setCoverage] = useState(1)
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [savedPath, setSavedPath] = useState('')

  const aspect = useMemo(
    () => CROP_ASPECT_PRESETS.find((item) => item.id === aspectId) ?? CROP_ASPECT_PRESETS[0],
    [aspectId],
  )

  useEffect(() => {
    if (!sourceDataUrl) {
      setPreviewUrl('')
      return
    }
    let active = true
    void cropImageDataUrl(sourceDataUrl, aspect.w, aspect.h, coverage)
      .then((next) => {
        if (active) setPreviewUrl(next)
      })
      .catch(() => {
        if (active) setPreviewUrl('')
      })
    return () => {
      active = false
    }
  }, [aspect.h, aspect.w, coverage, sourceDataUrl])

  const handlePickImage = useCallback(async () => {
    const picked = await selectReferenceImage({ includeDataUrl: true })
    if (picked.canceled || !picked.dataUrl) return
    if (!picked.success) {
      toast.error(picked.error || '选择图片失败')
      return
    }
    setSourceDataUrl(picked.dataUrl)
    setSourceName(picked.filePath ? picked.filePath.split(/[/\\]/).pop() || '图片' : '图片')
    setSavedPath('')
  }, [])

  const handleSave = useCallback(async () => {
    if (!sourceDataUrl || !previewUrl) {
      toast.error('请先选择图片')
      return
    }
    if (!appDataDir) {
      toast.error('请先在设置中配置数据根目录')
      return
    }

    setBusy(true)
    try {
      const cropped = await cropImageDataUrl(sourceDataUrl, aspect.w, aspect.h, coverage, 'image/png')
      const targetDir = getToolboxImportDir(appDataDir, 'image')
      const base = sourceName.replace(/\.[^.]+$/, '') || 'crop'
      const saved = await saveDataUrlImage(cropped, {
        targetDir,
        filename: `${base}_${aspect.id.replace(':', 'x')}.png`,
      })
      if (!saved.success || !saved.filePath) {
        throw new Error(saved.error || '保存失败')
      }
      setSavedPath(saved.filePath)
      toast.success('裁剪图片已保存')
    } catch (error: unknown) {
      const err = error as Error
      toast.error(err.message || '保存失败')
    } finally {
      setBusy(false)
    }
  }, [appDataDir, aspect.h, aspect.id, aspect.w, coverage, previewUrl, sourceDataUrl, sourceName])

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        按常用画幅比例居中裁剪图片，适合分镜参考图、封面与发布物料。保存后可在本地文件夹中查看。
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handlePickImage()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-xs hover:bg-muted/40 transition-colors"
        >
          <Crop className="h-3.5 w-3.5" />
          选择图片
        </button>
        <button
          type="button"
          disabled={busy || !previewUrl}
          onClick={() => void handleSave()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          保存裁剪结果
        </button>
        {savedPath ? (
          <button
            type="button"
            onClick={() => void revealPathInExplorer(savedPath, { revealFile: true })}
            className="rounded-lg border border-border/40 px-3 py-1.5 text-xs hover:bg-muted/40 transition-colors"
          >
            打开文件位置
          </button>
        ) : null}
      </div>

      {sourceDataUrl ? (
        <>
          <div className="flex flex-wrap gap-2">
            {CROP_ASPECT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setAspectId(preset.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs border transition-colors',
                  aspectId === preset.id
                    ? 'border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-300'
                    : 'border-border/40 text-muted-foreground hover:bg-muted/40',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs text-muted-foreground">
              裁剪范围 {Math.round(coverage * 100)}%（越小越聚焦中心）
            </span>
            <input
              type="range"
              min={0.35}
              max={1}
              step={0.05}
              value={coverage}
              onChange={(e) => setCoverage(Number(e.target.value))}
              className="w-full"
            />
          </label>

          {previewUrl ? (
            <div className="rounded-xl border border-border/30 bg-muted/20 p-3">
              <p className="mb-2 text-xs text-muted-foreground">预览</p>
              <img
                src={previewUrl}
                alt="裁剪预览"
                className="mx-auto max-h-[320px] w-auto max-w-full rounded-lg object-contain"
              />
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">选择一张本地图片开始裁剪。</p>
      )}
    </div>
  )
}
