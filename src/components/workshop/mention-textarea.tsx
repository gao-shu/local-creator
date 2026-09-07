import { Mic } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { HoverImagePreviewPortal, useHoverImagePreview } from '@/components/workshop/hover-image-preview'
import { useCanvasImagePreview } from '@/hooks/use-canvas-media-preview'
import { getApprovedCharacterImageReviewSnapshot } from '@/lib/workflow/asset-review-status'
import { resolveMentionPreviewUrl } from '@/lib/workflow/mention-preview'
import { resolveImagePreviewSrc } from '@/lib/storage/fs-service'
import type { WorkflowAsset } from '@/types/workflow'
import {
  filterMentionCandidates,
  hasAnyMentionSyntax,
  insertMentionAt,
  mentionKindClass,
  mentionKindLabel,
  mentionKindTextClass,
  normalizeMentionSource,
  parseMentionSpans,
  type MentionCandidate,
} from '@/lib/workflow/mention-utils'
import {
  CANVAS_NODE_CONSOLE_TEXT,
  CANVAS_NODE_INLINE_INPUT,
  CANVAS_NODE_MENTION_TEXT,
  CANVAS_NODE_MUTED_TEXT,
} from '@/lib/canvas/canvas-node-theme'
import { cn } from '@/lib/utils'

const CANVAS_MENTION_MENU_MAX_WIDTH = 280
const CANVAS_MENTION_MENU_MAX_HEIGHT = 200
const CANVAS_MENTION_MENU_Z_INDEX = 2147483005

interface CanvasMentionMenuStyle {
  left: number
  top: number
  maxHeight: number
}

/** 画镜 @ 菜单右侧类型标签 */
function mentionKindCanvasMenuTag(kind: MentionCandidate['kind']): string {
  if (kind === 'character') return '人物'
  if (kind === 'scene') return '场景'
  if (kind === 'prop') return '物品'
  if (kind === 'voice') return '音色'
  return '图片'
}

function getTextareaCaretClientRect(
  textarea: HTMLTextAreaElement,
  position?: number,
): DOMRect {
  const caret = position ?? textarea.selectionStart ?? textarea.value.length
  const style = window.getComputedStyle(textarea)
  const textareaRect = textarea.getBoundingClientRect()
  const mirror = document.createElement('div')
  mirror.style.position = 'absolute'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.visibility = 'hidden'
  mirror.style.pointerEvents = 'none'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.wordWrap = 'break-word'
  mirror.style.overflowWrap = 'anywhere'
  mirror.style.width = `${textareaRect.width}px`
  mirror.style.boxSizing = style.boxSizing
  mirror.style.font = style.font
  mirror.style.padding = style.padding
  mirror.style.border = style.border
  mirror.style.lineHeight = style.lineHeight
  mirror.style.letterSpacing = style.letterSpacing
  mirror.style.textAlign = style.textAlign
  mirror.style.textIndent = style.textIndent
  mirror.style.wordBreak = style.wordBreak
  mirror.textContent = textarea.value.substring(0, caret)
  const marker = document.createElement('span')
  marker.textContent = textarea.value.substring(caret) || '.'
  mirror.appendChild(marker)
  document.body.appendChild(mirror)
  const mirrorRect = mirror.getBoundingClientRect()
  const markerRect = marker.getBoundingClientRect()
  document.body.removeChild(mirror)
  return new DOMRect(
    textareaRect.left + (markerRect.left - mirrorRect.left),
    textareaRect.top + (markerRect.top - mirrorRect.top),
    markerRect.width,
    Math.max(markerRect.height, parseFloat(style.lineHeight) || 16),
  )
}

function mentionKindCanvasMenuItemClass(
  kind: MentionCandidate['kind'],
  active: boolean,
): string {
  if (kind !== 'scene') {
    return active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.06]'
  }
  return cn(
    'border-l-[3px] border-l-emerald-500',
    active ? 'bg-emerald-500/[0.05]' : 'hover:bg-emerald-500/[0.05]',
  )
}

function mentionKindCanvasMenuTagBadgeClass(kind: MentionCandidate['kind']): string {
  const base = 'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold'
  if (kind === 'scene') return cn(base, 'bg-emerald-500/15 text-emerald-500')
  if (kind === 'character') return cn(base, 'bg-white/[0.08] text-white/70')
  if (kind === 'prop') return cn(base, 'bg-amber-500/15 text-amber-500')
  if (kind === 'voice') return cn(base, 'bg-white/[0.08] text-white/80')
  return cn(base, 'bg-emerald-500/15 text-emerald-500')
}

function MentionMenuItems({
  items,
  activeIndex,
  isCanvas,
  projectRoot,
  canvasProjectId,
  onPick,
}: {
  items: MentionCandidate[]
  activeIndex: number
  isCanvas: boolean
  projectRoot?: string
  canvasProjectId?: string
  onPick: (item: MentionCandidate) => void
}) {
  return (
    <>
      {items.map((item, idx) => (
        <button
          key={item.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            onPick(item)
          }}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors duration-150',
            isCanvas
              ? mentionKindCanvasMenuItemClass(item.kind, idx === activeIndex)
              : idx === activeIndex
                ? 'bg-cyan-500/15'
                : 'hover:bg-muted/60',
          )}
        >
          <MentionAvatar
            item={item}
            projectRoot={projectRoot}
            canvasProjectId={canvasProjectId}
            variant={isCanvas ? 'canvas' : 'default'}
          />
          {isCanvas ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white/92">
                  {item.name}
                </p>
                <p className="truncate text-[11px] text-white/55">
                  @{item.mentionName}
                </p>
              </div>
              <span className={mentionKindCanvasMenuTagBadgeClass(item.kind)}>
                {mentionKindCanvasMenuTag(item.kind)}
              </span>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium">{item.name}</span>
                  <span className={cn('shrink-0 text-[10px]', mentionKindTextClass(item.kind))}>
                    @{item.mentionName}
                  </span>
                  {item.syncedToLibrary ? (
                    <span className="shrink-0 rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-medium text-sky-300">
                      素材库
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {mentionKindLabel(item.kind)}
              </span>
            </>
          )}
        </button>
      ))}
    </>
  )
}

function MentionAvatar({
  item,
  projectRoot,
  canvasProjectId,
  variant = 'default',
}: {
  item: MentionCandidate
  projectRoot?: string
  canvasProjectId?: string
  variant?: 'default' | 'canvas'
}) {
  const { src: canvasPreview } = useCanvasImagePreview(
    canvasProjectId && item.thumbnailPath ? item.thumbnailPath : undefined,
    canvasProjectId,
    item.canvasOwnerKind,
    item.canvasOwnerProjectId,
  )
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (canvasProjectId) {
      setUrl(canvasPreview || null)
      return
    }
    if (!item.thumbnailPath) {
      setUrl(null)
      return
    }
    let active = true
    void resolveImagePreviewSrc(item.thumbnailPath, projectRoot).then((u) => {
      if (active) setUrl(u)
    })
    return () => {
      active = false
    }
  }, [canvasProjectId, canvasPreview, item.thumbnailPath, projectRoot])

  if (item.kind === 'voice') {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center border border-cyan-500/30 bg-cyan-500/10',
          variant === 'canvas' ? 'h-7 w-7 rounded-full' : 'h-8 w-8 rounded-md',
        )}
      >
        <Mic className="h-3.5 w-3.5 text-cyan-400" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden bg-zinc-600 text-[11px] font-semibold text-white',
        variant === 'canvas' ? 'h-7 w-7 rounded-full' : 'h-8 w-8 rounded-md border border-border/40 bg-muted text-muted-foreground text-[10px]',
      )}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : item.name.slice(0, 1)}
    </div>
  )
}

interface MentionHighlightHandlers {
  onMentionEnter: (candidate: MentionCandidate | null, el: HTMLElement) => void
  onMentionLeave: () => void
  onMentionMouseDown: (end: number) => void
}

function buildMentionHighlightNodes(
  text: string,
  candidates: MentionCandidate[],
  handlers: MentionHighlightHandlers,
): ReactNode[] {
  const source = normalizeMentionSource(text)
  const spans = parseMentionSpans(source, candidates)
  if (spans.length === 0) return [source || '\u00a0']

  const nodes: ReactNode[] = []
  let last = 0
  for (const span of spans) {
    if (span.start > last) nodes.push(source.slice(last, span.start))
    nodes.push(
      <span
        key={`${span.start}-${span.name}`}
        className={cn(
          'mention-tag pointer-events-auto cursor-default rounded-sm hover:opacity-90',
          mentionKindClass(span.candidate?.kind ?? 'unknown'),
        )}
        onMouseEnter={(e) => handlers.onMentionEnter(span.candidate, e.currentTarget)}
        onMouseLeave={handlers.onMentionLeave}
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handlers.onMentionMouseDown(span.end)
        }}
      >
        @{span.name}
      </span>,
    )
    last = span.end
  }
  if (last < source.length) nodes.push(source.slice(last))
  return nodes
}

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  candidates: MentionCandidate[]
  projectRoot?: string
  /** 用于 @ 角色悬停大图显示审核角标 */
  characters?: WorkflowAsset[]
  rows?: number
  placeholder?: string
  className?: string
  disabled?: boolean
  /** 超出后由外层滚动，避免 textarea 内部滚动与 overlay 错位 */
  maxHeight?: number
  /** 固定滚动区高度（不随内容撑开外层卡片） */
  scrollBoxHeight?: number
  /** 画布暗色主题 */
  tone?: 'workshop' | 'canvas'
  canvasProjectId?: string
  emptyHint?: string
  /** 为 false 时不响应 @ 引用（纯文本输入） */
  enableMentions?: boolean
  /** 画布控制台内嵌：无独立边框，与底部操作栏共用一个外框 */
  embedded?: boolean
}

const MIRROR_BASE_CLASS =
  'whitespace-pre-wrap break-words [overflow-wrap:anywhere]'

function resolveMirrorClass(isCanvas: boolean, className?: string): string {
  return cn(
    MIRROR_BASE_CLASS,
    // 工坊分镜卡片：略紧的内边距与行高，避免框内留白过大
    isCanvas ? 'px-0 py-1 text-[14px] leading-relaxed' : 'px-2 py-1.5 text-[12px] leading-snug',
    className,
  )
}

function rowMinHeightPx(rows: number, isCanvas: boolean): number {
  const fontSize = isCanvas ? 14 : 12
  const lineHeight = isCanvas ? 1.625 : 1.375
  const verticalPad = isCanvas ? 8 : 12
  return Math.ceil(rows * fontSize * lineHeight + verticalPad)
}

export function MentionTextarea({
  value,
  onChange,
  candidates,
  projectRoot,
  characters = [],
  rows = 6,
  placeholder,
  className,
  disabled,
  maxHeight = 420,
  scrollBoxHeight,
  tone = 'workshop',
  canvasProjectId,
  emptyHint,
  enableMentions = true,
  embedded = false,
}: MentionTextareaProps) {
  const isCanvas = tone === 'canvas'
  const rootRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollBoxRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const isComposingRef = useRef(false)
  const { preview, show: showHoverPreview, hide: hideHoverPreview } = useHoverImagePreview()
  const [draftValue, setDraftValue] = useState(value)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [atIndex, setAtIndex] = useState(-1)
  const [activeIndex, setActiveIndex] = useState(0)
  const [canvasMenuStyle, setCanvasMenuStyle] = useState<CanvasMentionMenuStyle | null>(null)

  const filtered = useMemo(
    () => filterMentionCandidates(candidates, query),
    [candidates, query],
  )

  useEffect(() => {
    if (isComposingRef.current) return
    if (value === draftValue) return
    const normalizedValue = normalizeMentionSource(value)
    const normalizedDraft = normalizeMentionSource(draftValue)
    if (normalizedValue === normalizedDraft) return

    const textareaFocused = document.activeElement === textareaRef.current
    if (
      textareaFocused &&
      !hasAnyMentionSyntax(normalizedDraft) &&
      hasAnyMentionSyntax(normalizedValue)
    ) {
      // 外部自动注入 @ 后需同步 draft，否则高亮层不显示
      setDraftValue(value)
      return
    }
    if (textareaFocused) return
    setDraftValue(value)
  }, [draftValue, value])

  const closeMenu = useCallback(() => {
    setOpen(false)
    setQuery('')
    setAtIndex(-1)
    setActiveIndex(0)
  }, [])

  const detectMention = useCallback((text: string, cursor: number) => {
    const before = text.slice(0, cursor)
    const at = before.lastIndexOf('@')
    if (at < 0) return null
    const segment = before.slice(at + 1)
    if (/[\s@]/.test(segment)) return null
    return { at, query: segment }
  }, [])

  const collapseAccidentalDuplicateAt = useCallback((text: string, cursor: number) => {
    if (cursor >= 2 && text[cursor - 1] === '@' && text[cursor - 2] === '@') {
      return {
        text: text.slice(0, cursor - 1) + text.slice(cursor),
        cursor: cursor - 1,
      }
    }
    return { text, cursor }
  }, [])

  const handleChange = useCallback(
    (rawText: string, options?: { deferMention?: boolean }) => {
      const el = textareaRef.current
      const cursor = el?.selectionStart ?? rawText.length
      const normalized = normalizeMentionSource(rawText)
      const collapsed = options?.deferMention
        ? { text: normalized, cursor }
        : collapseAccidentalDuplicateAt(normalized, cursor)
      const text = collapsed.text

      setDraftValue(text)
      onChange(text)
      if (!enableMentions || options?.deferMention) {
        closeMenu()
        return
      }
      if (!el) return
      if (collapsed.cursor !== cursor) {
        requestAnimationFrame(() => {
          el.setSelectionRange(collapsed.cursor, collapsed.cursor)
        })
      }
      const hit = detectMention(text, collapsed.cursor)
      if (hit) {
        setOpen(true)
        setAtIndex(hit.at)
        setQuery(hit.query)
        setActiveIndex(0)
      } else {
        closeMenu()
      }
    },
    [closeMenu, collapseAccidentalDuplicateAt, detectMention, enableMentions, onChange],
  )

  const pickMention = useCallback(
    (candidate: MentionCandidate) => {
      const el = textareaRef.current
      const scrollBox = scrollBoxRef.current
      if (!el || atIndex < 0) return
      const scrollTop = scrollBox?.scrollTop ?? 0
      const { value: next, cursor } = insertMentionAt(
        el.value,
        el.selectionStart,
        atIndex,
        candidate.mentionName,
      )
      setDraftValue(next)
      onChange(next)
      closeMenu()
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(cursor, cursor)
        if (scrollBox) scrollBox.scrollTop = scrollTop
      })
    },
    [atIndex, closeMenu, onChange],
  )

  const updateCanvasMenuPosition = useCallback(() => {
    const textarea = textareaRef.current
    const scrollBox = scrollBoxRef.current
    if (!textarea || !scrollBox) return
    const caretIndex = textarea.selectionStart ?? textarea.value.length
    const caretRect = getTextareaCaretClientRect(textarea, caretIndex)
    const boxRect = scrollBox.getBoundingClientRect()
    const gap = 4
    const top = caretRect.bottom + gap
    const maxHeight = Math.min(
      CANVAS_MENTION_MENU_MAX_HEIGHT,
      Math.max(64, window.innerHeight - top - 12),
    )
    setCanvasMenuStyle({
      left: Math.max(boxRect.left, caretRect.left),
      top,
      maxHeight,
    })
  }, [])

  const clampCanvasMenuPosition = useCallback(() => {
    const menu = menuRef.current
    const scrollBox = scrollBoxRef.current
    const textarea = textareaRef.current
    if (!menu || !scrollBox || !textarea || !canvasMenuStyle) return

    const menuRect = menu.getBoundingClientRect()
    const boxRect = scrollBox.getBoundingClientRect()
    const margin = 4
    const gap = 4
    const caretRect = getTextareaCaretClientRect(
      textarea,
      textarea.selectionStart ?? textarea.value.length,
    )

    let left = canvasMenuStyle.left
    let top = canvasMenuStyle.top

    if (left + menuRect.width > boxRect.right - margin) {
      left = Math.max(boxRect.left + margin, boxRect.right - margin - menuRect.width)
    }
    if (left < boxRect.left + margin) {
      left = boxRect.left + margin
    }
    if (top + menuRect.height > window.innerHeight - margin) {
      top = Math.max(margin, caretRect.top - menuRect.height - gap)
    }

    if (left !== canvasMenuStyle.left || top !== canvasMenuStyle.top) {
      setCanvasMenuStyle((prev) => (prev ? { ...prev, left, top } : null))
    }
  }, [canvasMenuStyle])

  useEffect(() => {
    if (!open) {
      setCanvasMenuStyle(null)
      return
    }
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      closeMenu()
    }
    document.addEventListener('mousedown', onDoc)
    if (isCanvas) {
      updateCanvasMenuPosition()
      const onLayout = () => updateCanvasMenuPosition()
      const scrollBox = scrollBoxRef.current
      window.addEventListener('resize', onLayout)
      window.addEventListener('scroll', onLayout, true)
      scrollBox?.addEventListener('scroll', onLayout, { passive: true })
      return () => {
        document.removeEventListener('mousedown', onDoc)
        window.removeEventListener('resize', onLayout)
        window.removeEventListener('scroll', onLayout, true)
        scrollBox?.removeEventListener('scroll', onLayout)
      }
    }
    return () => document.removeEventListener('mousedown', onDoc)
  }, [closeMenu, isCanvas, open, updateCanvasMenuPosition])

  useEffect(() => {
    if (!open || !isCanvas) return
    updateCanvasMenuPosition()
  }, [filtered.length, isCanvas, open, updateCanvasMenuPosition])

  useLayoutEffect(() => {
    if (!open || !isCanvas) return
    updateCanvasMenuPosition()
  }, [activeIndex, isCanvas, open, updateCanvasMenuPosition, draftValue])

  useLayoutEffect(() => {
    if (!open || !isCanvas || !canvasMenuStyle) return
    clampCanvasMenuPosition()
  }, [canvasMenuStyle, clampCanvasMenuPosition, filtered.length, isCanvas, open])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    if (!open) return
    if (filtered.length === 0) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMenu()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      pickMention(filtered[activeIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeMenu()
    }
  }

  const handleMentionEnter = useCallback(
    (candidate: MentionCandidate | null, el: HTMLElement) => {
      if (!candidate) return
      void (async () => {
        const url = await resolveMentionPreviewUrl(candidate, {
          projectRoot,
          canvasProjectId,
        })
        if (!url) return
        const path = (candidate.thumbnailPath || candidate.previewPaths?.[0])?.trim()
        const snapshot =
          candidate.kind === 'character' && path
            ? getApprovedCharacterImageReviewSnapshot(path, characters)
            : null
        showHoverPreview(
          url,
          el.getBoundingClientRect(),
          snapshot
            ? { reviewTitle: snapshot.title, reviewLabel: snapshot.badgeLabel }
            : undefined,
        )
      })()
    },
    [canvasProjectId, characters, projectRoot, showHoverPreview],
  )

  const handleMentionMouseDown = useCallback((end: number) => {
    const el = textareaRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(end, end)
  }, [])

  const highlightHandlers = useMemo(
    () => ({
      onMentionEnter: handleMentionEnter,
      onMentionLeave: hideHoverPreview,
      onMentionMouseDown: handleMentionMouseDown,
    }),
    [handleMentionEnter, hideHoverPreview, handleMentionMouseDown],
  )

  const highlightNodes = useMemo(
    () => buildMentionHighlightNodes(draftValue, candidates, highlightHandlers),
    [draftValue, candidates, highlightHandlers],
  )

  const hasMentions = enableMentions && hasAnyMentionSyntax(draftValue)
  const mirrorClass = resolveMirrorClass(isCanvas, className)
  const minHeightPx = rowMinHeightPx(rows, isCanvas)
  // 固定滚动区时 textarea 需撑满可视高度，否则下半段空白无法点击
  const contentMinHeightPx = scrollBoxHeight ?? minHeightPx

  // textarea 撑开高度，overlay 绝对定位对齐；外层滚动，避免内部滚动与 overlay 错位
  useLayoutEffect(() => {
    const ta = textareaRef.current
    const scrollBox = scrollBoxRef.current
    if (!ta || isComposingRef.current) return
    const selectionStart = ta.selectionStart
    const selectionEnd = ta.selectionEnd
    const scrollTop = scrollBox?.scrollTop ?? 0
    ta.style.height = '0px'
    ta.style.height = `${Math.max(ta.scrollHeight, contentMinHeightPx)}px`
    if (scrollBox) scrollBox.scrollTop = scrollTop
    if (document.activeElement === ta) {
      try {
        ta.setSelectionRange(selectionStart, selectionEnd)
      } catch {
        // ignore invalid range during rapid updates
      }
    }
  }, [draftValue, contentMinHeightPx])

  const scrollBoxStyle = scrollBoxHeight
    ? { height: scrollBoxHeight, maxHeight: scrollBoxHeight }
    : { maxHeight }

  const showCanvasMentionMenu = isCanvas && open && canvasMenuStyle && enableMentions

  const canvasMentionMenu = showCanvasMentionMenu
      ? createPortal(
          <div
            ref={menuRef}
            data-canvas-console-aux=""
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            className={cn(
              'nodrag nopan fixed w-max overflow-y-auto rounded-lg border border-white/10',
              'bg-[#1c1c1f] p-1 shadow-[0_4px_16px_rgba(0,0,0,0.35)]',
            )}
            style={{
              left: canvasMenuStyle.left,
              top: canvasMenuStyle.top,
              maxWidth: CANVAS_MENTION_MENU_MAX_WIDTH,
              maxHeight: canvasMenuStyle.maxHeight,
              zIndex: CANVAS_MENTION_MENU_Z_INDEX,
            }}
          >
            {filtered.length > 0 ? (
              <MentionMenuItems
                items={filtered}
                activeIndex={activeIndex}
                isCanvas={isCanvas}
                projectRoot={projectRoot}
                canvasProjectId={canvasProjectId}
                onPick={pickMention}
              />
            ) : (
              <p className="px-4 py-3 text-center text-xs text-white/45">
                {candidates.length === 0
                  ? emptyHint ||
                    '请先在 Step3 创建角色/场景/物品，或在本分镜上传音色'
                  : '未找到匹配的人物/场景/物品/素材'}
              </p>
            )}
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={rootRef} className="relative">
      <div
        ref={scrollBoxRef}
        className={cn(
          'relative overflow-y-auto',
          !embedded && 'rounded-lg border',
          !embedded && (isCanvas ? CANVAS_NODE_INLINE_INPUT : 'rounded-md border-border/60 bg-muted/30'),
          embedded && 'bg-transparent',
          disabled && 'opacity-60',
        )}
        style={scrollBoxStyle}
      >
        <div className="relative" style={{ minHeight: contentMinHeightPx }}>
          {hasMentions ? (
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-0 z-20 select-none',
                isCanvas ? CANVAS_NODE_MENTION_TEXT : 'text-foreground',
              )}
            >
              <div
                className={cn(
                  mirrorClass,
                  isCanvas ? CANVAS_NODE_MENTION_TEXT : 'text-foreground',
                )}
              >
                {highlightNodes}
              </div>
            </div>
          ) : null}
          <textarea
            ref={textareaRef}
            value={draftValue}
            disabled={disabled}
            rows={1}
            placeholder={placeholder}
            onCompositionStart={() => {
              isComposingRef.current = true
            }}
            onCompositionEnd={(event) => {
              isComposingRef.current = false
              handleChange(event.currentTarget.value)
            }}
            onChange={(event) => {
              handleChange(event.target.value, {
                deferMention: event.nativeEvent.isComposing || isComposingRef.current,
              })
            }}
            onKeyDown={handleKeyDown}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              if (!enableMentions) return
              const el = textareaRef.current
              if (!el) return
              const hit = detectMention(draftValue, el.selectionStart)
              if (hit) {
                setOpen(true)
                setAtIndex(hit.at)
                setQuery(hit.query)
              } else {
                closeMenu()
              }
            }}
            className={cn(
              'relative z-10 block w-full bg-transparent',
              mirrorClass,
              'overflow-hidden outline-none resize-none',
              isCanvas
                ? 'focus-visible:ring-1 focus-visible:ring-border/60 dark:focus-visible:ring-white/20'
                : 'focus-visible:ring-1 focus-visible:ring-cyan-500/40',
              hasMentions
                ? isCanvas
                  ? 'text-transparent caret-foreground selection:bg-cyan-500/25 selection:text-foreground dark:caret-white/90 dark:selection:text-white'
                  : 'text-transparent caret-foreground selection:bg-cyan-500/25 selection:text-foreground'
                : isCanvas
                  ? CANVAS_NODE_CONSOLE_TEXT
                  : 'text-foreground',
              isCanvas
                ? 'placeholder:text-muted-foreground/45 dark:placeholder:text-white/30'
                : 'placeholder:text-muted-foreground/50',
            )}
          />
        </div>
      </div>

      {enableMentions && open && filtered.length > 0 && !isCanvas ? (
        <div
          className={cn(
            'absolute left-0 right-0 z-[80] mt-1 max-h-52 overflow-y-auto shadow-xl',
            'top-full rounded-lg border border-border/60 bg-popover',
          )}
        >
          <MentionMenuItems
            items={filtered}
            activeIndex={activeIndex}
            isCanvas={false}
            projectRoot={projectRoot}
            canvasProjectId={canvasProjectId}
            onPick={pickMention}
          />
        </div>
      ) : enableMentions && open && candidates.length === 0 && !isCanvas ? (
        <div
          className={cn(
            'absolute left-0 right-0 top-full z-[80] mt-1 px-3 py-2 text-[11px] shadow-xl',
            'rounded-lg border border-border/60 bg-popover text-muted-foreground',
          )}
        >
          {emptyHint ||
            '请先在 Step3 创建角色/场景/物品，或在本分镜上传音色'}
        </div>
      ) : null}
      {canvasMentionMenu}
      <HoverImagePreviewPortal preview={preview} />
    </div>
  )
}
