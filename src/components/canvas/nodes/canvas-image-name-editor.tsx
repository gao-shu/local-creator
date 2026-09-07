// Copyright (c) local-creator contributors. All rights reserved.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { PencilLine } from 'lucide-react'
import { CANVAS_IMAGE_DEFAULT_NAME_COLOR } from '@/lib/canvas/canvas-image-role'
import { CANVAS_INPUT_PLACEHOLDER, CANVAS_NODE_INPUT, CANVAS_NODE_MUTED_TEXT } from '@/lib/canvas/canvas-node-theme'
import { cn } from '@/lib/utils'

interface CanvasImageNameEditorProps {
  value: string
  colorClass?: string
  /** 固定类型前缀（人物/场景/道具），编辑时不可改 */
  fixedPrefix?: string
  fixedPrefixColorClass?: string
  onSave: (name: string) => void
  className?: string
  /** above：图片上方标题栏；overlay：叠在图片角上 */
  placement?: 'above' | 'overlay'
  placeholder?: string
  titlePrefix?: string
}

/** 铅笔修改图片名称 */
export function CanvasImageNameEditor({
  value,
  colorClass = CANVAS_IMAGE_DEFAULT_NAME_COLOR,
  fixedPrefix,
  fixedPrefixColorClass,
  onSave,
  className,
  placement = 'overlay',
  placeholder = '图片名称',
  titlePrefix = '修改名称',
}: CanvasImageNameEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [editing, value])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = useCallback(() => {
    const next = draft.trim()
    onSave(next)
    setEditing(false)
  }, [draft, onSave])

  const cancel = useCallback(() => {
    setDraft(value)
    setEditing(false)
  }, [value])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation()
      if (event.key === 'Enter') {
        event.preventDefault()
        commit()
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        cancel()
      }
    },
    [cancel, commit],
  )

  const isAbove = placement === 'above'
  const prefixColor = fixedPrefixColorClass ?? colorClass
  const displayTitle = fixedPrefix
    ? value
      ? `${titlePrefix}：${fixedPrefix} ${value}`
      : `${titlePrefix}：${fixedPrefix}`
    : value
      ? `${titlePrefix}：${value}`
      : placeholder

  if (editing) {
    return (
      <div
        className={cn(
          'nodrag nopan flex w-full max-w-[280px] items-center',
          isAbove
            ? cn('rounded-md border px-2 py-1', CANVAS_NODE_INPUT)
            : 'max-w-[calc(100%-16px)] rounded-lg bg-black/70 p-1 backdrop-blur-sm',
          className,
        )}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {fixedPrefix ? (
          <span className={cn('shrink-0 text-[12px]', isAbove ? prefixColor : 'text-white/90')}>
            {fixedPrefix}&nbsp;
          </span>
        ) : null}
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={cn(
            'min-w-0 flex-1 bg-transparent outline-none',
            CANVAS_INPUT_PLACEHOLDER,
            isAbove ? 'text-[12px] text-foreground dark:text-white/90' : 'px-1.5 py-0.5 text-[11px] text-white',
          )}
          placeholder={placeholder}
          maxLength={48}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      title={displayTitle}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        setEditing(true)
      }}
      className={cn(
        'nodrag nopan inline-flex max-w-full items-center gap-1 transition-colors',
        isAbove
          ? cn('justify-end text-[12px] leading-none hover:opacity-90', !fixedPrefix && colorClass)
          : cn(
              'max-w-[calc(100%-16px)] rounded-lg bg-black/55 px-2 py-1 text-[11px] backdrop-blur-sm hover:bg-black/70',
              !fixedPrefix && colorClass,
            ),
        className,
      )}
    >
      {fixedPrefix ? (
        <>
          <span className={cn('shrink-0', isAbove ? prefixColor : 'text-white/90')}>{fixedPrefix}</span>
          <span className={cn('shrink-0', isAbove ? CANVAS_NODE_MUTED_TEXT : 'text-white/50')}>&nbsp;</span>
          <span className={cn('truncate', isAbove ? 'max-w-[200px]' : 'max-w-[100px]', colorClass)}>
            {value}
          </span>
        </>
      ) : (
        <span className={cn('truncate', isAbove ? 'max-w-[240px]' : 'max-w-[120px]')}>{value}</span>
      )}
      <PencilLine className={cn('shrink-0', isAbove ? cn('h-3 w-3', CANVAS_NODE_MUTED_TEXT) : 'h-3 w-3 text-white/70')} />
    </button>
  )
}
