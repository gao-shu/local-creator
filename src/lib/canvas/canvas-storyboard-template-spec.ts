// Copyright (c) local-creator contributors. All rights reserved.

/**
 * 「导入分镜稿 / 一键分镜」契约（P0）
 *
 * 产品边界：
 * - 文本节点不区分「剧本文本 / 分镜文本」类型
 * - 智能分镜 = LLM 从散文拆镜；导入分镜稿 = 本地解析镜头号模板
 * - 成片以视频节点 prompt 为准；本契约只定义「模板 → 结构化镜」
 *
 * 实现解析器时应对齐本文件，不要另起一套字段名。
 */

/** 切块锚点：仅认行首（避免台词里出现「镜头」误切） */
export const STORYBOARD_TEMPLATE_SHOT_BOUNDARIES = [
  /^镜头号\s*[:：]\s*/u,
  /^#{1,3}\s*镜头\s*[:：]?\s*\d+/u,
  /^Shot\s*(?:No\.?|Number|#)?\s*[:：]?\s*\d+/iu,
] as const

/**
 * 模板字段 → 规范化 key。
 * 解析时做别名匹配；未列出的行可进 `extraLines`（可选拼入 prompt 末尾）。
 */
export const STORYBOARD_TEMPLATE_FIELD_ALIASES: Record<string, string[]> = {
  shotNumber: ['镜头号', '分镜号', 'shot', 'shot number', 'shot_number'],
  scene: ['主要场景', '场景', '场景描述'],
  camera: ['运镜', '镜头运动', '机位'],
  lightingCore: ['核心光影', '光影'],
  lightingSetup: ['布光'],
  foreground: ['前景'],
  content: ['画面内容', '画面', '正文', '内容'],
  texture: ['质感细节', '质感'],
  emotion: ['人物情绪', '情绪'],
  dialogue: ['台词', '对白', '旁白'],
  sfx: ['音效', '声音'],
  duration: ['时长', '持续时间', 'duration'],
  blocking: ['人物站位', '站位', '走位'],
  style: ['画面风格', '风格'],
}

/** 写入视频/分镜 prompt 的字段顺序（有值才拼接） */
export const STORYBOARD_TEMPLATE_PROMPT_FIELD_ORDER = [
  'scene',
  'content',
  'camera',
  'lightingCore',
  'lightingSetup',
  'foreground',
  'texture',
  'emotion',
  'blocking',
  'style',
  'sfx',
] as const

export type StoryboardTemplatePromptField =
  (typeof STORYBOARD_TEMPLATE_PROMPT_FIELD_ORDER)[number]

/** 单镜硬门槛：有镜头号，且有画面主体文案 */
export const STORYBOARD_TEMPLATE_SHOT_REQUIRED = {
  /** 规范化后的镜头号 > 0 */
  shotNumber: true,
  /**
   * 下列至少一项非空：
   * - content（画面内容）
   * - 或 camera+scene 同时存在（极简模板兜底）
   */
  body: ['content'] as const,
  bodyFallbackPairs: [['camera', 'scene']] as const,
} as const

/**
 * 整篇成功门槛（导入分镜稿）：
 * - ≥1 镜即可导入（单镜场记也成立）
 * - 0 镜 → 失败，引导用户改用「智能分镜」
 */
export const STORYBOARD_TEMPLATE_DOC_MIN_SHOTS = 1

/** 确认弹窗默认选项（P3 UI） */
export const STORYBOARD_TEMPLATE_IMPORT_DEFAULTS = {
  createShotPromptNodes: true,
  /** 同步创建空视频节点并连线；不自动开跑 API */
  createVideoNodes: true,
  extractAssets: false,
} as const

/**
 * 与智能分镜 JSON 的对齐目标（落画布前）：
 * - prompt ← compose(prompt 字段序)
 * - dialogue ← 台词（可截断作短标题；完整台词仍放 prompt 或独立字段视落点而定）
 * - spatialAnchor ← 人物站位优先，否则主要场景
 * - durationSec ← 时长（仅视频节点；ParsedStoryboardItem 本身无此字段，action 层携带）
 */
export type StoryboardTemplateNormalizedShot = {
  shotNumber: number
  prompt: string
  dialogue: string
  spatialAnchor?: string
  durationSec?: number
  /** 缺字段但不阻断导入时的提示 */
  warnings: string[]
}

export type StoryboardTemplateParseFailureCode =
  | 'empty'
  | 'no_shot_boundary'
  | 'no_valid_shot'

export const STORYBOARD_TEMPLATE_FAILURE_HINT: Record<
  StoryboardTemplateParseFailureCode,
  string
> = {
  empty: '文本为空，请先粘贴或导入分镜稿。',
  no_shot_boundary: '未识别到「镜头号」分段，请改用智能分镜，或按模板补齐镜头号。',
  no_valid_shot: '已找到分段但缺少画面内容等必备字段，请补全后再导入。',
}
