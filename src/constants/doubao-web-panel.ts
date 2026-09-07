// Copyright (c) 2025 好的AI. All rights reserved.

/**
 * 画布顶栏「豆包」网页侧栏常量（阶段 2.1；会话约定见 1.2）。
 *
 * Session 策略（仅豆包，不做多厂商 / DeepSeek）：
 * - 固定 Electron partition：`persist:aiweb-doubao`
 * - 关闭侧栏：hide BrowserView，**不** destroy、**不**换 partition，避免丢 Cookie / 登录态
 * - 进程退出再启动：同一 persist 名复用用户数据目录下的分区存储，登录应仍在
 * - 勿用临时 `persist:xxx-${Date.now()}`，也勿与设置页 API Key / 模型配置混用
 *
 * 加载实测（1.1）：`https://www.doubao.com/chat/` 可在 BrowserView 内渲染。
 * Session 实测（1.2）：同 partition 下销毁再建 View、以及完整退出再启进程，
 * 持久 Cookie 均仍在（见 `scripts/probe-doubao-session.mjs`）。
 */

/** 豆包官网聊天入口（内嵌 / 外开共用） */
export const DOUBAO_CHAT_URL = 'https://www.doubao.com/chat/'

/**
 * Electron session partition。`persist:` 前缀表示落盘，跨启动保留。
 * @see https://www.electronjs.org/docs/latest/api/session#sessionfrompartitionpartition-options
 */
export const DOUBAO_WEB_PARTITION = 'persist:aiweb-doubao'

/** 顶栏 / 侧栏展示文案（勿改成多厂商切换文案） */
export const DOUBAO_WEB_PANEL_LABEL = '豆包'

/**
 * 侧栏弱提示（阶段 4.1）：声明为第三方官网嵌入，
 * 避免与设置页「豆包/火山」API Key · 模型配置混淆。
 */
export const DOUBAO_WEB_PANEL_HINT =
  '第三方网页 · 非应用内 API 通话，与设置中的模型配置无关'

/** 宿主区加载占位（BrowserView 盖住前可见） */
export const DOUBAO_WEB_PANEL_LOADING = '正在加载豆包网页…'

/** 顶栏按钮 hover 补充说明 */
export const DOUBAO_WEB_PANEL_BUTTON_TITLE = `${DOUBAO_WEB_PANEL_LABEL}官网聊天（第三方网页）`

/**
 * 右侧网页侧栏占位宽度（px）。
 * 画布主区右缩与 BrowserView bounds 共用此值。
 */
export const DOUBAO_PANEL_WIDTH = 400
