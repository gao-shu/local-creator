// Copyright (c) local-creator contributors. All rights reserved.

import { useCallback, useState } from 'react'
import { ArrowDown, ArrowUp, Film, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { exportClipsToCapcutDraft } from '@/lib/capcut/capcut-export-service'
import { resolveToolboxVideoPath } from '@/lib/toolbox/toolbox-media-import'
import { selectLocalVideos } from '@/lib/storage/fs-service'
import { useSettingsStore } from '@/stores/settings-store'
import { cn } from '@/lib/utils'

interface MergeClipItem {
  id: string
  label: string
  sourcePath: string
  absolutePath: string
}

function basename(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || filePath
}

export function VideoMergeTool() {
  const appDataDir = useSettingsStore((s) => s.appDataDir)
  const [projectName, setProjectName] = useState('工具箱视频合并')
  const [clips, setClips] = useState<MergeClipItem[]>([])
  const [busy, setBusy] = useState(false)

  const handleAddVideos = useCallback(async () => {
    if (!appDataDir) {
      toast.error('请先在设置中配置数据根目录')
      return
    }
    const picked = await selectLocalVideos()
    if (picked.canceled || !picked.filePaths?.length) return
    if (!picked.success) {
      toast.error(picked.error || '选择视频失败')
      return
    }

    setBusy(true)
    try {
      const nextItems: MergeClipItem[] = []
      for (const sourcePath of picked.filePaths) {
        const absolutePath = await resolveToolboxVideoPath(sourcePath, appDataDir)
        nextItems.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          label: basename(sourcePath),
          sourcePath,
          absolutePath,
        })
      }
      setClips((prev) => [...prev, ...nextItems])
      toast.success(`已添加 ${nextItems.length} 个视频`)
    } catch (error: unknown) {
      const err = error as Error
      toast.error(err.message || '导入视频失败')
    } finally {
      setBusy(false)
    }
  }, [appDataDir])

  const moveClip = (index: number, direction: -1 | 1) => {
    setClips((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  const handleExport = useCallback(async () => {
    if (!clips.length) {
      toast.error('请先添加至少一个视频')
      return
    }
    setBusy(true)
    try {
      const result = await exportClipsToCapcutDraft({
        projectName: projectName.trim() || '工具箱视频合并',
        clips: clips.map((clip, index) => ({
          label: `#${index + 1} ${clip.label}`,
          absolutePath: clip.absolutePath,
        })),
      })
      if (!result.success) return
    } finally {
      setBusy(false)
    }
  }, [clips, projectName])

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground leading-relaxed">
        将多个本地视频按顺序合并到<strong className="font-medium text-foreground/90">剪映草稿</strong>
        时间轴，在剪映中继续剪辑并导出成片。当前版本不直接输出单个 MP4 文件。
      </p>

      <label className="block space-y-1.5">
        <span className="text-xs text-muted-foreground">草稿名称</span>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className={cn(
            'w-full rounded-xl px-3 py-2 text-sm',
            'bg-muted/40 border border-border/40 outline-none focus:ring-2 focus:ring-primary/20',
          )}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleAddVideos()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-xs hover:bg-muted/40 transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          添加视频
        </button>
        <button
          type="button"
          disabled={busy || clips.length === 0}
          onClick={() => void handleExport()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs text-white hover:bg-violet-500 transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}
          导出到剪映草稿
        </button>
      </div>

      {clips.length ? (
        <ul className="space-y-2">
          {clips.map((clip, index) => (
            <li
              key={clip.id}
              className="flex items-center gap-2 rounded-xl border border-border/30 bg-muted/20 px-3 py-2"
            >
              <span className="w-6 shrink-0 text-xs font-semibold text-muted-foreground">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm" title={clip.sourcePath}>
                {clip.label}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveClip(index, -1)}
                  className="rounded p-1 hover:bg-muted/60 disabled:opacity-30"
                  title="上移"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={index === clips.length - 1}
                  onClick={() => moveClip(index, 1)}
                  className="rounded p-1 hover:bg-muted/60 disabled:opacity-30"
                  title="下移"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setClips((prev) => prev.filter((item) => item.id !== clip.id))}
                  className="rounded p-1 hover:bg-destructive/10 text-destructive/80"
                  title="移除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">添加 2 个及以上视频后，可导出为剪映草稿进行合并剪辑。</p>
      )}
    </div>
  )
}
