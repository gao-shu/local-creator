// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { cn } from '@/lib/utils'
import {
  CANVAS_ADD_NODE_SECTIONS,
  type CanvasAddNodeMenuItem,
  type CanvasAddNodeMenuSection,
  type CanvasAddNodeMenuSubItem,
} from '@/lib/canvas/canvas-add-node-items'
import {
  CANVAS_PROMPT_EXTRACT_ACTION,
  CANVAS_PROMPT_STORYBOARD_ACTION,
  CANVAS_PROMPT_TEMPLATE_IMPORT_ACTION,
  CANVAS_VIDEO_EXTRACT_AUDIO_ACTION,
} from '@/lib/canvas/canvas-menu-actions'
import type { CanvasAddNodeConnection } from '@/lib/canvas/canvas-add-node-connection'
import {
  isPromptExtractActionDisabled,
  isPromptStoryboardActionDisabled,
  isPromptTemplateImportActionDisabled,
  shouldShowCanvasScriptMenuSection,
  type PromptAiBusyState,
} from '@/lib/canvas/canvas-prompt-ai-actions'
import {
  isVideoExtractAudioActionDisabled,
  shouldShowCanvasVideoMenuSection,
} from '@/lib/canvas/canvas-video-extract-audio'

export interface BuildCanvasAddNodeMenuOptions {
  promptAiBusy?: PromptAiBusyState | null
  addNodeAnchor?: { connection?: CanvasAddNodeConnection } | null
  runningNodeIds?: ReadonlySet<string> | null
  /** 左侧全局添加菜单不展示「从剧本」「从视频」 */
  showScriptSection?: boolean
  showVideoSection?: boolean
}

export function buildCanvasAddNodeMenuSections(
  nodes: Node[],
  options?: BuildCanvasAddNodeMenuOptions | null,
): CanvasAddNodeMenuSection[] {
  const resolved = options ?? {}
  const showScript =
    resolved.showScriptSection === false
      ? false
      : shouldShowCanvasScriptMenuSection(nodes, resolved.addNodeAnchor)
  const showVideo =
    resolved.showVideoSection === false
      ? false
      : shouldShowCanvasVideoMenuSection(nodes, resolved.addNodeAnchor)
  return CANVAS_ADD_NODE_SECTIONS.filter((section) => {
    if (section.title === '从剧本') return showScript
    if (section.title === '从视频') return showVideo
    return true
  })
}

function isCanvasAddNodeItemDisabled(
  item: CanvasAddNodeMenuItem,
  options?: {
    promptAiBusy?: PromptAiBusyState | null
    nodes?: Node[]
    addNodeAnchor?: { connection?: CanvasAddNodeConnection } | null
    runningNodeIds?: ReadonlySet<string> | null
  },
): boolean {
  if (item.action === CANVAS_PROMPT_EXTRACT_ACTION) {
    return isPromptExtractActionDisabled(options?.promptAiBusy)
  }
  if (item.action === CANVAS_PROMPT_STORYBOARD_ACTION) {
    return isPromptStoryboardActionDisabled(options?.promptAiBusy)
  }
  if (item.action === CANVAS_PROMPT_TEMPLATE_IMPORT_ACTION) {
    return isPromptTemplateImportActionDisabled(options?.promptAiBusy)
  }
  if (item.action === CANVAS_VIDEO_EXTRACT_AUDIO_ACTION) {
    return isVideoExtractAudioActionDisabled(
      options?.nodes ?? [],
      options?.addNodeAnchor,
      options?.runningNodeIds,
    )
  }
  return false
}

function mergeMenuItemData(
  item: CanvasAddNodeMenuItem,
  submenuItem?: CanvasAddNodeMenuSubItem,
): CanvasAddNodeMenuItem {
  if (!submenuItem) return item
  return {
    ...item,
    data: { ...(item.data ?? {}), ...(submenuItem.data ?? {}) },
  }
}

function MenuItemButton({
  item,
  disabled,
  onSelect,
}: {
  item: CanvasAddNodeMenuItem
  disabled?: boolean
  onSelect: (item: CanvasAddNodeMenuItem) => void
}) {
  const Icon = item.icon
  const hasSubmenu = Boolean(item.submenu?.length) && !disabled
  const [submenuOpen, setSubmenuOpen] = useState(false)
  const closeTimerRef = useRef<number | null>(null)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const openSubmenu = useCallback(() => {
    if (!hasSubmenu) return
    clearCloseTimer()
    setSubmenuOpen(true)
  }, [clearCloseTimer, hasSubmenu])

  const scheduleCloseSubmenu = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setSubmenuOpen(false)
      closeTimerRef.current = null
    }, 120)
  }, [clearCloseTimer])

  const handleSelectSubmenu = (submenuItem: CanvasAddNodeMenuSubItem) => {
    clearCloseTimer()
    setSubmenuOpen(false)
    onSelect(mergeMenuItemData(item, submenuItem))
  }

  return (
    <div
      className="relative"
      onMouseEnter={openSubmenu}
      onMouseLeave={scheduleCloseSubmenu}
    >
      <button
        type="button"
        data-testid={`canvas-add-node-${item.type}`}
        disabled={disabled}
        onClick={() => onSelect(item)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left',
          'hover:bg-white/[0.06] transition-colors',
          disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
          hasSubmenu && submenuOpen && 'bg-white/[0.06]',
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/70">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-white/90">{item.label}</span>
          {item.description ? (
            <span className="mt-0.5 block truncate text-[11px] text-white/40">{item.description}</span>
          ) : null}
        </span>
        {hasSubmenu ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-white/35" strokeWidth={1.8} />
        ) : null}
      </button>

      {hasSubmenu && submenuOpen ? (
        <div
          className={cn(
            'absolute left-full top-0 z-10 ml-1 min-w-[132px] rounded-xl border border-white/10',
            'bg-[#1a1b1f]/96 p-1 shadow-2xl backdrop-blur-md',
          )}
          onMouseEnter={openSubmenu}
          onMouseLeave={scheduleCloseSubmenu}
        >
          {item.submenu!.map((submenuItem) => (
            <button
              key={submenuItem.key}
              type="button"
              data-testid={`canvas-add-node-${item.type}-${submenuItem.key}`}
              onClick={() => handleSelectSubmenu(submenuItem)}
              className={cn(
                'flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px]',
                'font-medium text-white/90 hover:bg-white/[0.08] transition-colors',
              )}
            >
              {submenuItem.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

interface CanvasAddNodeMenuPanelProps {
  sections?: CanvasAddNodeMenuSection[]
  nodes?: Node[]
  promptAiBusy?: PromptAiBusyState | null
  addNodeAnchor?: { connection?: CanvasAddNodeConnection } | null
  runningNodeIds?: ReadonlySet<string> | null
  onSelect: (item: CanvasAddNodeMenuItem) => void
  className?: string
}

/** 对齐 weifan Sora2 画布工坊：添加节点 / 添加资源 分组菜单 */
export function CanvasAddNodeMenuPanel({
  sections,
  nodes = [],
  promptAiBusy = null,
  addNodeAnchor = null,
  runningNodeIds = null,
  onSelect,
  className,
}: CanvasAddNodeMenuPanelProps) {
  const resolvedSections = sections ?? CANVAS_ADD_NODE_SECTIONS

  return (
    <div className={cn('w-[248px] p-1.5', className)}>
      {resolvedSections.map((section, sectionIndex) => (
        <div key={section.title}>
          {sectionIndex > 0 ? <div className="my-1 border-t border-white/10" /> : null}
          <p className="px-2 py-1.5 text-[11px] font-medium text-white/45">{section.title}</p>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <MenuItemButton
                key={`${section.title}-${item.type}-${item.label}`}
                item={item}
                disabled={isCanvasAddNodeItemDisabled(item, {
                  promptAiBusy,
                  nodes,
                  addNodeAnchor,
                  runningNodeIds,
                })}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export type { CanvasAddNodeMenuItem, LucideIcon }
