// Copyright (c) local-creator contributors. All rights reserved.

/** 画布节点：浅色用语义 token，深色保留画镜原样式 */

export const CANVAS_NODE_SHELL =
  'rounded-2xl border shadow-xl backdrop-blur-md bg-card/95 border-border/50 text-foreground dark:bg-[#25262b]/96 dark:border-white/10 dark:text-white/88'

export const CANVAS_NODE_SHELL_HEADER =
  'border-b border-border/30 bg-muted/25 dark:border-white/[0.06] dark:bg-transparent'

export const CANVAS_NODE_PREVIEW_FRAME =
  'overflow-hidden rounded-2xl border bg-muted/30 border-border/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:bg-[#121318] dark:border-white/[0.09]'

export const CANVAS_NODE_PREVIEW_HOVER_BORDER = 'hover:border-border/70 dark:hover:border-white/20'

export const CANVAS_NODE_PLACEHOLDER_TEXT = 'text-muted-foreground dark:text-white/35'

/** 输入框/textarea 占位符：浅色 muted；暗色灰白 */
export const CANVAS_INPUT_PLACEHOLDER =
  'placeholder:text-muted-foreground/55 dark:placeholder:text-white/35'

export const CANVAS_NODE_CONSOLE_TEXT =
  `text-foreground/88 dark:text-white/88 ${CANVAS_INPUT_PLACEHOLDER}`

export const CANVAS_NODE_MENTION_TEXT = 'text-foreground dark:text-white/88'

export const CANVAS_NODE_SUBTEXT = 'text-muted-foreground dark:text-white/45'

export const CANVAS_NODE_CONSOLE =
  'overflow-hidden rounded-[18px] border bg-card/95 border-border/40 shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:bg-[#25262b]/96 dark:border-white/[0.06] dark:shadow-[0_8px_32px_rgba(0,0,0,0.32)]'

export const CANVAS_NODE_ICON_BTN =
  'rounded-lg border border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:border-white/10 dark:bg-[#1a1b1f] dark:text-white/70 dark:hover:bg-white/[0.06]'

export const CANVAS_NODE_INPUT =
  `border-border/40 bg-background text-foreground ${CANVAS_INPUT_PLACEHOLDER} dark:border-white/10 dark:bg-[#25262b]/80 dark:text-white/90`

/** 画布控制台内嵌输入区（无独立边框，浅底） */
export const CANVAS_NODE_INLINE_INPUT =
  `border-border/50 bg-muted/25 text-foreground ${CANVAS_INPUT_PLACEHOLDER} dark:border-white/10 dark:bg-black/25 dark:text-white/88`

export const CANVAS_NODE_SOFT_BTN =
  'border border-border/40 bg-muted/30 text-foreground/80 hover:bg-muted/50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/75 dark:hover:bg-white/[0.08]'

export const CANVAS_NODE_PILL_BTN =
  'rounded-full border border-border/35 bg-card/95 text-foreground/85 shadow-lg backdrop-blur-sm hover:bg-muted/40 dark:border-white/15 dark:bg-[#1a1b1f]/95 dark:text-white/85 dark:hover:bg-[#25262b]'

export const CANVAS_NODE_TOOLBAR =
  'rounded-xl border border-border/40 bg-card/95 shadow-lg dark:border-white/10 dark:bg-[#1a1b1f]'

/** 媒体预览区悬浮按钮：实色底、无 backdrop-blur，配合 useCanvasNodeSharpScale 保持清晰 */
export const CANVAS_NODE_OVERLAY_ACTION =
  'canvas-node-sharp-ui flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 bg-[#1c1c1e] text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-colors hover:bg-[#2c2c30]'

export const CANVAS_NODE_OVERLAY_ACTION_TEXT =
  'canvas-node-sharp-ui inline-flex h-8 items-center rounded-lg border border-white/12 bg-[#1c1c1e] px-2.5 text-[11px] font-medium leading-none text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-colors hover:bg-[#2c2c30]'

export const CANVAS_NODE_OVERLAY_ACTION_PRIMARY =
  'canvas-node-sharp-ui flex h-8 w-8 items-center justify-center rounded-lg border border-sky-400/45 bg-sky-500 text-white shadow-[0_2px_8px_rgba(14,165,233,0.35)] transition-colors hover:bg-sky-400'

export const CANVAS_NODE_OVERLAY_ACTION_DANGER =
  'canvas-node-sharp-ui flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 bg-[#1c1c1e] text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-colors hover:border-red-400/50 hover:bg-red-600'

export const CANVAS_NODE_DROPDOWN =
  'rounded-xl border border-border/40 bg-popover py-1 shadow-xl dark:border-white/10 dark:bg-[#1a1b1f]'

export const CANVAS_NODE_DROPDOWN_ITEM =
  'text-foreground/75 hover:bg-muted/60 dark:text-white/65 dark:hover:bg-white/[0.06]'

export const CANVAS_NODE_MUTED_TEXT = 'text-muted-foreground dark:text-white/45'

export const CANVAS_NODE_TITLE_TEXT = 'text-foreground/85 dark:text-white/85'

export const CANVAS_NODE_COMPACT_SELECT =
  'border-0 bg-transparent text-foreground/70 hover:bg-muted/50 dark:text-white/70 dark:hover:bg-white/[0.04]'
