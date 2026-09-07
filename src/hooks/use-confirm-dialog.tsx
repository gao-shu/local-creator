/**
 * Promise 式确认弹窗，替代浏览器原生 confirm()，样式与 ConfirmDialog 统一
 */
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export interface AskConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

export function useConfirmDialog() {
  const [request, setRequest] = useState<AskConfirmOptions | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const ask = useCallback((options: AskConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setRequest(options)
    })
  }, [])

  const finish = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed)
    resolverRef.current = null
    setRequest(null)
  }, [])

  const confirmDialog: ReactNode = (
    <ConfirmDialog
      open={Boolean(request)}
      title={request?.title ?? ''}
      description={request?.description}
      confirmLabel={request?.confirmLabel}
      cancelLabel={request?.cancelLabel}
      variant={request?.variant}
      onClose={() => finish(false)}
      onConfirm={() => finish(true)}
    />
  )

  return { ask, confirmDialog }
}
