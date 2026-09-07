// Copyright (c) local-creator contributors. All rights reserved.

import { lazy, Suspense, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Filerobot 编辑器中文文案（关闭后端翻译，避免外网依赖） */
const CANVAS_FILEROBOT_ZH: Record<string, string> = {
  name: '名称',
  save: '保存',
  saveAs: '另存为',
  back: '返回',
  loading: '加载中…',
  resetOperations: '重置全部操作',
  changesLoseWarningHint: '重置后将丢失当前修改，是否继续？',
  discardChangesWarningHint: '关闭后未保存的修改将丢失。',
  cancel: '取消',
  apply: '应用',
  warning: '提示',
  confirm: '确认',
  discardChanges: '放弃修改',
  undoTitle: '撤销',
  redoTitle: '重做',
  showImageTitle: '查看原图',
  zoomInTitle: '放大',
  zoomOutTitle: '缩小',
  toggleZoomMenuTitle: '缩放菜单',
  adjustTab: '调整',
  finetuneTab: '微调',
  filtersTab: '滤镜',
  annotateTabLabel: '标注',
  resizeTab: '尺寸',
  cropTool: '裁剪',
  original: '原始',
  custom: '自定义',
  rotateTool: '旋转',
  textTool: '文字',
  brightnessTool: '亮度',
  contrastTool: '对比度',
  blurTool: '模糊',
  warmthTool: '色温',
  hsvTool: '色相',
  penTool: '画笔',
  lineTool: '直线',
  arrowTool: '箭头',
  rectangleTool: '矩形',
  ellipseTool: '椭圆',
  polygonTool: '多边形',
  imageTool: '图片',
  flipX: '水平翻转',
  flipY: '垂直翻转',
  unFlipX: '取消水平翻转',
  unFlipY: '取消垂直翻转',
  saveAsModalTitle: '保存为',
  extension: '格式',
  format: '格式',
  nameIsRequired: '请输入文件名',
  quality: '质量',
  imageName: '图片名称',
  invalidImageError: '无效的图片',
  uploadImageError: '图片加载失败',
}

export interface CanvasFilerobotEditorProps {
  /** 可编辑图片 dataURL */
  source: string
  /** 保存对话框默认文件名（不含扩展名） */
  defaultSavedImageName?: string
  onSave: (dataUrl: string) => void | Promise<void>
  onClose: () => void
  className?: string
}

function normalizeEditedImageDataUrl(saved: {
  imageBase64?: string
  mimeType?: string
}): string {
  const raw = String(saved.imageBase64 || '').trim()
  if (!raw) {
    throw new Error('编辑结果为空')
  }
  if (raw.startsWith('data:')) {
    return raw
  }
  const mimeType = saved.mimeType || 'image/png'
  return `data:${mimeType};base64,${raw}`
}

const LazyFilerobotEditor = lazy(() =>
  import('react-filerobot-image-editor').then((mod) => ({
    default: function CanvasFilerobotEditorInner({
      source,
      defaultSavedImageName = 'canvas-edit',
      onSave,
      onClose,
    }: Omit<CanvasFilerobotEditorProps, 'className'>) {
      const FilerobotImageEditor = mod.default
      const { TABS, TOOLS } = mod

      const handleSave = useCallback(
        async (savedImageData: { imageBase64?: string; mimeType?: string }) => {
          const dataUrl = normalizeEditedImageDataUrl(savedImageData)
          await onSave(dataUrl)
        },
        [onSave],
      )

      return (
        <FilerobotImageEditor
          source={source}
          tabsIds={[TABS.ADJUST, TABS.FINETUNE, TABS.FILTERS, TABS.ANNOTATE]}
          defaultTabId={TABS.ADJUST}
          defaultToolId={TOOLS.CROP}
          closeAfterSave
          useBackendTranslations={false}
          translations={CANVAS_FILEROBOT_ZH}
          defaultSavedImageName={defaultSavedImageName}
          defaultSavedImageType="png"
          defaultSavedImageQuality={0.92}
          savingPixelRatio={4}
          previewPixelRatio={2}
          observePluginContainerSize
          showBackButton
          onSave={handleSave}
          onClose={() => onClose()}
        />
      )
    },
  })),
)

function CanvasFilerobotEditorFallback() {
  return (
    <div className="flex h-full min-h-[480px] w-full items-center justify-center bg-[#121316] text-white/70">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      <span className="text-sm">正在加载图片编辑器…</span>
    </div>
  )
}

/** 画布图片编辑：lazy 加载 Filerobot，避免拖慢主包 */
export function CanvasFilerobotEditor({
  className,
  ...props
}: CanvasFilerobotEditorProps) {
  return (
    <div className={cn('relative h-full min-h-[480px] w-full overflow-hidden bg-[#121316]', className)}>
      <Suspense fallback={<CanvasFilerobotEditorFallback />}>
        <LazyFilerobotEditor {...props} />
      </Suspense>
    </div>
  )
}
