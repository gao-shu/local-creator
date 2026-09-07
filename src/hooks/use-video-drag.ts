// Copyright (c) local-creator contributors. All rights reserved.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  beginNativeVideoDragSession,
  endNativeVideoDragSession,
} from '@/lib/canvas/canvas-native-video-drag-guard'
import { revealPathInExplorer } from '@/lib/storage/fs-service'

function hasVideoDragBridge(): boolean {
  return Boolean(
    window.electronAPI?.prepareVideoDragSource && window.electronAPI?.startVideoDrag,
  )
}

export function useVideoDrag(
  storedPath: string,
  options?: { projectRoot?: string; filename?: string },
) {
  const [dragFilePath, setDragFilePath] = useState('')
  const [isPreparing, setIsPreparing] = useState(false)
  const cachedSourceRef = useRef('')

  const sourceKey = useMemo(
    () => `${options?.projectRoot || ''}::${storedPath}`,
    [options?.projectRoot, storedPath],
  )

  const resetCache = useCallback(() => {
    setDragFilePath('')
    cachedSourceRef.current = ''
  }, [])

  useEffect(() => {
    resetCache()
  }, [sourceKey, resetCache])

  const prepareVideoDragFile = useCallback(
    async (prepareOptions?: { silent?: boolean; force?: boolean }) => {
      const silent = prepareOptions?.silent ?? true
      const force = prepareOptions?.force ?? false
      const pathText = String(storedPath || '').trim()
      if (!pathText || pathText.startsWith('preview:')) {
        if (!silent) toast.warning('当前没有可拖拽的视频文件')
        return ''
      }
      if (!hasVideoDragBridge()) {
        if (!silent) toast.warning('当前环境不支持直接拖到剪映')
        return ''
      }
      if (!force && dragFilePath && cachedSourceRef.current === sourceKey) {
        return dragFilePath
      }

      setIsPreparing(true)
      try {
        const result = await window.electronAPI!.prepareVideoDragSource({
          storedPath: pathText,
          projectRoot: options?.projectRoot,
          filename: options?.filename,
        })
        if (!result?.success || !result.filePath) {
          throw new Error(result?.error || '准备拖拽文件失败')
        }
        setDragFilePath(result.filePath)
        cachedSourceRef.current = sourceKey
        return result.filePath
      } catch (error: unknown) {
        resetCache()
        if (!silent) toast.error((error as Error).message || '准备拖拽文件失败')
        return ''
      } finally {
        setIsPreparing(false)
      }
    },
    [dragFilePath, options?.filename, options?.projectRoot, resetCache, sourceKey, storedPath],
  )

  const handleVideoDragStart = useCallback(
    async (event: React.DragEvent) => {
      // 同步取消 HTML5 拖放，避免松手在画布时被当成「导入文件」复制节点
      event.preventDefault()
      event.stopPropagation()
      beginNativeVideoDragSession()
      try {
        const filePath = await prepareVideoDragFile({ silent: false })
        if (!filePath) {
          endNativeVideoDragSession()
          return
        }
        window.electronAPI!.startVideoDrag({ filePath })
      } catch {
        endNativeVideoDragSession()
      }
    },
    [prepareVideoDragFile],
  )

  const revealVideoFile = useCallback(async () => {
    const filePath = await prepareVideoDragFile({ silent: false })
    if (!filePath) return
    const result = await revealPathInExplorer(filePath, { revealFile: true })
    if (!result.success) {
      toast.error(result.error || '打开文件位置失败')
    }
  }, [prepareVideoDragFile])

  return {
    dragFileReady: Boolean(dragFilePath),
    hasVideoDragBridge: hasVideoDragBridge(),
    isPreparingDragFile: isPreparing,
    prepareVideoDragFile,
    handleVideoDragStart,
    revealVideoFile,
  }
}
