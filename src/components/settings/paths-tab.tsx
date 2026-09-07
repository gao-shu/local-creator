import { useMemo, useState } from 'react'

import { Database, FolderOpen, Loader2, Package, Upload } from 'lucide-react'

import { toast } from 'sonner'

import { cn } from '@/lib/utils'

import { hasChinesePath } from '@/lib/storage/path-utils'

import {
  assembleDataPaths,
  formatStorageRootHint,
  normalizeStorageRoot,
} from '@/lib/storage/data-layout'

import { formatPortableDataLayoutPreview } from '@/lib/storage/project-paths'

import { exportDataRootPackage, selectDirectory } from '@/lib/storage/settings-service'

import { useSettingsStore } from '@/stores/settings-store'

import { Button } from '@/components/ui/button'

import { Input } from '@/components/ui/input'

import { Label } from '@/components/ui/label'

export function PathsTab() {
  const [exporting, setExporting] = useState(false)
  const settings = useSettingsStore((s) => s.settings)
  const dataRoot = useSettingsStore((s) => s.dataRoot)
  const launcherDir = useSettingsStore((s) => s.launcherDir)
  const saving = useSettingsStore((s) => s.saving)
  const dirty = useSettingsStore((s) => s.dirty)
  const save = useSettingsStore((s) => s.save)
  const updateDataRootPath = useSettingsStore((s) => s.updateDataRootPath)
  const importExistingDataRoot = useSettingsStore((s) => s.importExistingDataRoot)

  const pathBase = settings?.dataRootPath?.trim() || dataRoot || ''

  const assembled = useMemo(() => {
    if (!settings) return null
    return assembleDataPaths(settings, pathBase)
  }, [settings, pathBase])

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        加载设置中…
      </div>
    )
  }

  const rootValue = settings.dataRootPath?.trim() || ''
  const chineseError = hasChinesePath(rootValue)
  const defaultHint = formatStorageRootHint()
  const canSave = Boolean(rootValue) && !chineseError && !saving

  const applyAndSaveDataRoot = async (nextPath: string) => {
    const normalized = normalizeStorageRoot(nextPath)
    if (!normalized) {
      toast.error('无效的数据目录')
      return false
    }
    if (hasChinesePath(normalized)) {
      toast.error('路径不能包含中文字符')
      return false
    }
    const previous = normalizeStorageRoot(rootValue || dataRoot || '')
    if (previous && previous !== normalized) {
      toast.message('已切换数据根目录', {
        description: '不会自动迁移原目录中的项目与文件；若新路径为空，将看不到旧数据。',
      })
    }
    updateDataRootPath(normalized)
    return save({ successMessage: '已保存并初始化目录' })
  }

  const handleBrowse = async () => {
    const res = await selectDirectory({
      defaultPath: rootValue || dataRoot || undefined,
    })
    if (res.canceled) return
    if (!res.success) {
      toast.error(res.error || '选择目录失败')
      return
    }
    if (!res.path) {
      toast.error('未获取到目录路径')
      return
    }
    await applyAndSaveDataRoot(res.path)
  }

  const handleSave = async () => {
    if (!rootValue) {
      toast.error('请先选择数据根目录')
      return
    }
    const next = normalizeStorageRoot(rootValue)
    const previous = normalizeStorageRoot(dataRoot || '')
    if (previous && next && previous !== next) {
      toast.message('即将按新数据根目录初始化', {
        description: '不会自动迁移原目录中的项目与文件；确认路径无误后再继续使用。',
      })
    }
    await save({ successMessage: '已保存并初始化目录' })
  }

  const handleImportExisting = async () => {
    const res = await selectDirectory({
      defaultPath: rootValue || dataRoot || undefined,
    })
    if (!res.success) {
      toast.error(res.error || '选择目录失败')
      return
    }
    if (!res.path) return
    await importExistingDataRoot(normalizeStorageRoot(res.path))
  }

  const handleExportPackage = async () => {
    if (dirty) {
      const ok = await save()
      if (!ok) return
    }
    if (!assembled?.dataRoot) {
      toast.error('请先选择并保存数据根目录')
      return
    }

    setExporting(true)
    try {
      const res = await exportDataRootPackage()
      if (res.canceled) return
      if (!res.success) {
        toast.error(res.error || '打包失败')
        return
      }
      toast.success(`已导出：${res.filePath}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">便携数据目录</h2>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          选择一个文件夹作为唯一数据根目录，配置、项目、素材与生成文件均保存在此。点击「选择」后会自动保存并初始化目录结构；手动改路径后请点「保存」。
        </p>
        <p className="text-xs text-amber-700/90 dark:text-amber-300/90 mt-2 leading-relaxed rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2">
          更换数据根目录不会自动迁移已有项目与文件。若指向空目录或新路径，应用将按新根初始化，原先数据不会自动出现；请先用「打包导出」或自行复制后再切换，或用「指向已有目录」接回旧根。
        </p>
      </div>

      <section className="rounded-xl border border-border/30 bg-card/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">数据根目录</Label>
        </div>

        <div className="flex gap-2">
          <Input
            data-testid="settings-portable-data-root-input"
            value={rootValue}
            onChange={(e) => updateDataRootPath(e.target.value)}
            placeholder={defaultHint}
            className={cn(chineseError && 'border-destructive/50')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSave) void handleSave()
            }}
          />
          <Button type="button" variant="outline" className="shrink-0" onClick={() => void handleBrowse()}>
            <FolderOpen className="h-4 w-4" />
            选择
          </Button>
          <Button
            type="button"
            className="shrink-0 min-w-[72px] gap-1.5"
            disabled={!canSave}
            onClick={() => void handleSave()}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            保存
          </Button>
        </div>

        {chineseError ? <p className="text-xs text-destructive">路径不能包含中文字符</p> : null}
        {dirty && rootValue && !chineseError ? (
          <p className="text-xs text-amber-600/90 dark:text-amber-300/90">路径已修改，请点击「保存」完成初始化</p>
        ) : null}

        {launcherDir ? (
          <p className="text-xs text-muted-foreground">
            启动器指针：{launcherDir}\storage-root.json
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={exporting || !assembled?.dataRoot}
            onClick={() => void handleExportPackage()}
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Package className="h-3.5 w-3.5" />
            )}
            打包导出
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void handleImportExisting()}
          >
            <Upload className="h-3.5 w-3.5" />
            指向已有目录
          </Button>
        </div>
      </section>

      {assembled?.dataRoot ? (
        <section
          data-testid="settings-portable-layout-preview"
          className="rounded-xl border border-border/30 bg-card/20 p-4 space-y-3"
        >
          <Label className="text-sm font-medium">目录结构预览</Label>
          <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all">
            {formatPortableDataLayoutPreview(assembled.dataRoot)}
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            settings.json：模型、提示词、系统参数 · materials.json / voice-library.json：跨项目素材与音色索引（媒体仍在各项目目录内） · data.json：剧本/资产/分镜 · tasks.json：后台任务状态
          </p>
        </section>
      ) : null}
    </div>
  )
}
