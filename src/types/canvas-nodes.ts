// Copyright (c) local-creator contributors. All rights reserved.

import type { CanvasImageLightingConfig, CanvasImageSubjectView } from '@/types/canvas-image-tools'
import type { VideoReferenceMode } from '@/lib/workflow/storyboard-video-presets'
import type { ParsedValidateIssue } from '@/lib/workflow/storyboard-prompt'
import type { ImageQuality } from '@/types/settings'

/** 节点运行状态 */
export type CanvasNodeStatus = 'idle' | 'running' | 'success' | 'error'

/** 媒体文件归属（导入分镜时可能引用创作工坊项目路径） */
export type CanvasMediaOwnerKind = 'canvas' | 'workflow' | 'materials'

export interface CanvasMediaOwner {
  mediaOwnerKind?: CanvasMediaOwnerKind
  mediaOwnerProjectId?: string
}

/** 对齐画镜本地画布节点 type */
export const CANVAS_NODE_TYPES = {
  note: 'note',
  group: 'group',
  shotPrompt: 'shotPrompt',
  referenceImage: 'referenceImage',
  imageNode: 'imageNode',
  storyVideo: 'storyVideo',
  voiceNode: 'voiceNode',
  /** 音频片段（如从视频提取的 mp3），可播放；与 voiceNode（TTS 音色）区分 */
  audioNode: 'audioNode',
} as const

export type CanvasNodeType = (typeof CANVAS_NODE_TYPES)[keyof typeof CANVAS_NODE_TYPES]

/** 画镜：图片节点资产类型（角色 / 场景 / 物品） */
export type CanvasImageAssetRole = 'character' | 'scene' | 'item'

export interface CanvasNodeDataBase {
  label?: string
  status?: CanvasNodeStatus
  error?: string
  /** 最近一次成功/失败状态变更时间（任务面板展示） */
  statusUpdatedAt?: number
}

export interface CanvasPromptNodeData extends CanvasNodeDataBase {
  prompt: string
  /** 控制台补充指令（可选，与正文合并后提取） */
  chatInstruction?: string
  /** 最近一次提取摘要，如「角色 2 · 场景 1」 */
  lastExtractSummary?: string
  /** 最近一次分镜生成摘要，如「12 镜」 */
  lastStoryboardSummary?: string
}

export interface CanvasGroupNodeData extends CanvasNodeDataBase {
  label: string
}

export interface CanvasReferenceImageNodeData extends CanvasNodeDataBase, CanvasMediaOwner {
  imagePath?: string
  /** 创建后自动打开选图 */
  pickOnMount?: boolean
  /** 参考图资产类型：角色 / 场景 / 物品 */
  assetRole?: CanvasImageAssetRole
  /** 视频节点旁分镜参考条缩略图（旧数据兼容） */
  exportShotRefStrip?: boolean
  importShotId?: string
  importShotNumber?: number
  importWorkflowAssetId?: string
}

export interface CanvasImageNodeData extends CanvasNodeDataBase, CanvasMediaOwner {
  prompt?: string
  imageSize?: string
  /** 系统模型计价档分辨率（1K/2K/4K） */
  imageResolution?: string
  /** 系统模型计价档质量 */
  imageQuality?: ImageQuality
  outputPath?: string
  outputOwnerKind?: CanvasMediaOwnerKind
  outputOwnerProjectId?: string
  /** 导入来源分镜 ID（仅展示） */
  importShotId?: string
  importShotNumber?: number
  /** 导入来源创作工坊项目 ID（素材库等） */
  importWorkflowProjectId?: string
  /** 图片资产类型：角色 / 场景 / 物品 */
  assetRole?: CanvasImageAssetRole
  /** 创建时的资产类型（取消转换时恢复） */
  assetRoleOrigin?: CanvasImageAssetRole
  /** 是否已通过工具栏 @ 转换过类型（转换后在名称前展示类型标签） */
  assetRoleConverted?: boolean
  /** 用户自定义图片名称（创建时按类型默认，可重命名） */
  imageName?: string
  /** 资产 @ 引用名（优先于 imageName） */
  entityName?: string
  /** 导入来源工坊资产 ID */
  importWorkflowAssetId?: string
  /** 主体视角工具配置 */
  subjectView?: CanvasImageSubjectView
  /** 打光工具配置 */
  lightingConfig?: CanvasImageLightingConfig
  /** 人物：绑定本地音色（local:voice_xxx，对齐创作工坊） */
  voiceType?: string
  voiceName?: string
  jimengAssetId?: string
  jimengAssetStatus?: string
  reviewImagePath?: string
  /** 创作工坊画风 key（style-presets） */
  styleKey?: string
  /** 创作工坊布局 key（layout-presets，随角色/场景/道具变化） */
  layoutKey?: string
  /** 已迁移至 648px 外壳布局（控制台与节点同宽，避免底部控件无法点击） */
  layoutShellV2?: boolean
  /** 图片控制台本地上传的参考图（画布项目相对路径）；有则走 /images/edits */
  consoleReferenceImagePaths?: string[]
}

export interface CanvasVoiceNodeData extends CanvasNodeDataBase {
  /** local:voice_xxx */
  voiceType?: string
  /** @ 引用显示名（与音色库条目名称同步） */
  voiceName?: string
}

/** 画布音频片段节点（从视频提取或后续本地上传的 mp3） */
export interface CanvasAudioNodeData extends CanvasNodeDataBase, CanvasMediaOwner {
  /** 项目内相对路径，如 voices/extract_xxx/reference.mp3 */
  audioRelativePath: string
  /** 音频时长（秒） */
  durationSec?: number
  /** 提取时的截取起点（秒）；整段提取时可省略 */
  extractStartSec?: number
  /** 提取时的截取终点（秒）；null 表示到片尾 */
  extractEndSec?: number | null
  /** 来源视频节点 ID（追溯用） */
  sourceVideoNodeId?: string
  /** 来源视频展示名 */
  sourceVideoLabel?: string
}

export interface CanvasVideoNodeData extends CanvasNodeDataBase, CanvasMediaOwner {
  prompt?: string
  /**
   * 二次验证空间锚点（与工坊 WorkflowShot.spatialAnchor 同构）。
   * 生视频时与 prompt 拼接为镜头正文；勿仅写入 prompt 字段。
   * 旧画布若曾把锚点 join 进 prompt：不自动拆分，仅认本字段。
   */
  spatialAnchor?: string
  /**
   * 深度二次验证连续性 issues（复用 ParsedValidateIssue，禁止本地再定义一份）。
   * P0 仅类型空壳；P1 二次验证应用或导入路径再写入。
   */
  continuityIssues?: ParsedValidateIssue[]
  videoModelId?: string
  /** 对齐创作工坊 Step4 参考模式 */
  referenceMode?: VideoReferenceMode
  durationSec?: number
  aspectRatio?: string
  resolution?: string
  /** 生视频进度提示（上传/排队/生成中） */
  progressMessage?: string
  /** 远端 API 任务快照，用于关软件后恢复轮询 */
  remoteJob?: import('@/types/video-remote-job').VideoRemoteJobSnapshot
  outputPath?: string
  outputOwnerKind?: CanvasMediaOwnerKind
  outputOwnerProjectId?: string
  /** 该镜分镜图（first_frame），与生视频结果 outputPath 区分 */
  storyboardImagePath?: string
  storyboardImageOwnerKind?: CanvasMediaOwnerKind
  storyboardImageOwnerProjectId?: string
  importShotId?: string
  importShotNumber?: number
  importWorkflowProjectId?: string
  /** 智能分镜创建时写入的镜号（1-based）；手动添加的视频节点不设 */
  shotNumber?: number
  /** 分镜标题/对白摘要，用于节点展示与编辑弹窗 */
  dialogue?: string
  /** 成片后修改描述，提示待重新生成（仅有 shotNumber 时生效） */
  needsRegen?: boolean
  /** 用户自定义视频名称（创建时按序号默认，可重命名） */
  videoName?: string
  /** 视频控制台本地上传的参考图（画布项目相对路径） */
  consoleReferenceImagePaths?: string[]
  /** 本次生视频开始时间（ms），用于展示耗时 */
  generationStartedAt?: number
  /** 本次生视频完成耗时（ms），成功/失败结案时写入 */
  generationElapsedMs?: number
  /**
   * 远端成片已生成但本地落盘失败时保留的下载地址。
   * 有值时可「重新下载」，无需重新生成。
   */
  pendingDownloadUrl?: string
}

export {
  DEFAULT_IMAGE_SIZE as CANVAS_DEFAULT_IMAGE_SIZE,
  IMAGE_SIZE_OPTIONS as CANVAS_IMAGE_SIZE_OPTIONS,
} from '@/lib/workflow/image-size-presets'

/** @deprecated UI 请用 resolveVideoDurationOptions(model)；勿再直接引用 */
export const CANVAS_VIDEO_DURATION_OPTIONS = [5, 10, 15] as const

/** @deprecated UI 请用 resolveVideoAspectOptions(model)；勿再直接引用 */
export const CANVAS_VIDEO_ASPECT_OPTIONS = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
] as const

/** @deprecated UI 请用 resolveVideoResolutionOptions(model)；勿再写死档位 */
export const CANVAS_VIDEO_RESOLUTION_OPTIONS = [
  { value: '480', label: '480p' },
  { value: '720', label: '720p' },
  { value: '1080', label: '1080p' },
] as const
