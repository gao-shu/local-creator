// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  beginNativeVideoDragSession,
  endNativeVideoDragSession,
} from '@/lib/canvas/canvas-native-video-drag-guard'

export interface MultiVideoDragItem {
  storedPath: string
  projectRoot?: string
  filename?: string
}

function hasMultiVideoDragBridge(): boolean {
  return Boolean(
    window.electronAPI?.isElectron
    && window.electronAPI?.prepareVideoDragSources
    && window.electronAPI?.startVideoDrag,
  )
}

function buildItemsKey(items: MultiVideoDragItem[]): string {
  return items
    .map((item) => `${item.projectRoot || ''}::${item.storedPath}::${item.filename || ''}`)
    .join('|')
}

export function useMultiVideoDrag(items: MultiVideoDragItem[]) {
  const [dragFilePaths, setDragFilePaths] = useState<string[]>([])
  const [isPreparing, setIsPreparing] = useState(false)
  const cachedItemsKeyRef = useRef('')

  const draggableItems = useMemo(
    () =>
      items.filter((item) => {
        const pathText = String(item.storedPath || '').trim()
        return Boolean(pathText) && !pathText.startsWith('preview:')
      }),
    [items],
  )

  const itemsKey = useMemo(() => buildItemsKey(draggableItems), [draggableItems])

  const resetCache = useCallback(() => {
    setDragFilePaths([])
    cachedItemsKeyRef.current = ''
  }, [])

  useEffect(() => {
    resetCache()
  }, [itemsKey, resetCache])

  const prepareVideoDragFiles = useCallback(
    async (prepareOptions?: { silent?: boolean; force?: boolean }) => {
      const silent = prepareOptions?.silent ?? true
      const force = prepareOptions?.force ?? false

      if (draggableItems.length === 0) {
        if (!silent) toast.warning('当前没有可拖拽的视频文件')
        return [] as string[]
      }
      if (!hasMultiVideoDragBridge()) {
        if (!silent) toast.warning('当前环境不支持直接拖到剪映')
        return [] as string[]
      }
      if (!force && dragFilePaths.length > 0 && cachedItemsKeyRef.current === itemsKey) {
        return dragFilePaths
      }

      setIsPreparing(true)
      try {
        const result = await window.electronAPI!.prepareVideoDragSources({
          items: draggableItems,
        })
        if (!result?.success || !result.filePaths?.length) {
          throw new Error(result?.error || '准备拖拽文件失败')
        }
        setDragFilePaths(result.filePaths)
        cachedItemsKeyRef.current = itemsKey
        return result.filePaths
      } catch (error: unknown) {
        resetCache()
        if (!silent) toast.error((error as Error).message || '准备拖拽文件失败')
        return [] as string[]
      } finally {
        setIsPreparing(false)
      }
    },
    [dragFilePaths, draggableItems, itemsKey, resetCache],
  )

  const handleVideoDragStart = useCallback(
    async (event: React.DragEvent) => {
      // 同步取消 HTML5 拖放，避免松手在画布时被当成「导入文件」复制节点
      event.preventDefault()
      event.stopPropagation()
      beginNativeVideoDragSession()
      try {
        const filePaths = await prepareVideoDragFiles({ silent: false })
        if (filePaths.length === 0) {
          endNativeVideoDragSession()
          return
        }
        window.electronAPI!.startVideoDrag({ filePaths })
      } catch {
        endNativeVideoDragSession()
      }
    },
    [prepareVideoDragFiles],
  )

  return {
    dragFileReady: dragFilePaths.length > 0,
    draggableCount: draggableItems.length,
    hasVideoDragBridge: hasMultiVideoDragBridge(),
    isPreparingDragFile: isPreparing,
    prepareVideoDragFiles,
    handleVideoDragStart,
  }
}
