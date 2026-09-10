export type WorkflowStep = 1 | 2 | 3 | 4

export const SCRIPT_MAX_LENGTH = 50000

export type EpisodeStyle = 'realistic' | 'comic' | '2d_anime' | '3d_anime' | 'article'

/** Step2 分集规划模式：bootstrap 占位 / manual 手搓 / ai_split AI 分集 */
export type WorkflowEpisodePlan = 'bootstrap' | 'manual' | 'ai_split'

export const EPISODE_PLAN_LABELS: Record<WorkflowEpisodePlan, string> = {
  bootstrap: '占位分集',
  manual: '手动分集',
  ai_split: 'AI 分集',
}

export interface EpisodeEntity {
  name: string
  description: string
}

export interface WorkflowEpisode {
  id: string
  episodeIndex: number
  title: string
  summary: string
  hook?: string
  hookScore?: number
  content: string
  /** Step4 左栏「本页参考」备注，仅对照用，不参与推理，不回写 Step2 */
  step4ScriptRef?: string
  /** 用户在 Step2 手改过本集脚本后，不再从 Step1 全文自动覆盖 */
  contentManuallyEdited?: boolean
  assetScope?: string
  characters: EpisodeEntity[]
  scenes: EpisodeEntity[]
  items: EpisodeEntity[]
}

export type WorkflowTaskType =
  | 'episode_split'
  | 'extract'
  | 'storyboard'
  | 'image'
  | 'video'

export type WorkflowTaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface WorkflowTask {
  id: string
  type: WorkflowTaskType
  status: WorkflowTaskStatus
  progressMessage?: string
  errorMessage?: string
  /** 生图/生视频：关联分镜 ID */
  shotId?: string
  /** 生图：关联资产 ID（Step3） */
  assetId?: string
  /** 生视频：远端 API 任务快照 */
  remoteJob?: import('@/types/video-remote-job').VideoRemoteJobSnapshot
  /** 关联分集（分镜推理等） */
  episodeId?: string
  episodeIndex?: number
  episodeTitle?: string
  /** 画布：来源文本节点 id（提取资产 / 智能分镜） */
  canvasSourceNodeId?: string
  /** 画布运行队列：展示标签（生图/生视频执行历史） */
  label?: string
  createdAt: number
  updatedAt: number
}

export interface WorkflowProjectMeta {
  id: string
  title: string
  description?: string
  /** 项目卡片封面（项目目录内相对路径，如 cover.jpg） */
  coverImagePath?: string
  currentStep: WorkflowStep
  updatedAt: number
  createdAt: number
  /** 软删除时间戳；有值则不在列表展示，项目目录与数据保留 */
  deletedAt?: number
}

export interface WorkflowProjectData {
  script: string
  extractTemplateKey?: string
  storyboardTemplateKey?: string
  /** 项目视觉风格（Step1 选定的生图 preset key，Step2/3/4 默认跟随） */
  projectStylePresetKey: string
  /** Step3 生图风格覆盖；空则跟随 projectStylePresetKey */
  assetStyleOverrideKey?: string
  /** Step4 分镜生图风格覆盖；空则跟随 projectStylePresetKey */
  storyboardStyleOverrideKey?: string
  /** 分集规划模式；旧项目无此字段时由 inferEpisodePlan 推断 */
  episodePlan?: WorkflowEpisodePlan
  currentStep: WorkflowStep
  episodes: WorkflowEpisode[]
  characters: WorkflowAsset[]
  scenes: WorkflowAsset[]
  props: WorkflowAsset[]
  shots: WorkflowShot[]
  /** 生图/生视频时自动携带的固定前缀 */
  promptPrefix?: string
  /** 生图/生视频时自动携带的固定后缀 */
  promptSuffix?: string
  /** 当前选用的前后缀预设 id */
  selectedAffixPresetId?: number
  /** 跨步骤共享的当前分集（Step2/3/4 同步） */
  activeEpisodeId?: string
}

export interface WorkflowListResult {
  success: boolean
  projects: WorkflowProjectMeta[]
  error?: string
}

export interface WorkflowCreateResult {
  success: boolean
  project?: WorkflowProjectMeta
  error?: string
}

export interface WorkflowDeleteResult {
  success: boolean
  error?: string
}

export interface WorkflowReadDataResult {
  success: boolean
  data?: WorkflowProjectData
  error?: string
}

export interface WorkflowWriteDataResult {
  success: boolean
  error?: string
}

export interface WorkflowUpdateProjectResult {
  success: boolean
  project?: WorkflowProjectMeta
  error?: string
}

export interface WorkflowTasksResult {
  success: boolean
  tasks: WorkflowTask[]
  error?: string
}

export interface WorkflowWriteTasksResult {
  success: boolean
  error?: string
}

export type AssetKind = 'character' | 'scene' | 'prop'

export type AssetStatus = 'draft' | 'generating' | 'done' | 'failed'

export interface WorkflowAsset {
  id: string
  kind: AssetKind
  name: string
  description: string
  prompt: string
  layoutKey?: string
  styleKey?: string
  referenceImagePath?: string
  /** 多张参考图（最多 10 张） */
  referenceImagePaths?: string[]
  /** 生图时使用的参考图索引（对应 referenceImagePaths） */
  selectedReferenceImageIndex?: number
  generatedImagePath?: string
  /** 多张生成图历史 */
  generatedImagePaths?: string[]
  /** 角色卡/场景图主图索引（对应 generatedImagePaths） */
  primaryGeneratedImageIndex?: number
  /** 即梦审核 assetId（后续接入） */
  jimengAssetId?: string
  jimengAssetStatus?: string
  /** 提交审核时绑定的本地图片路径（切换角色卡图后需重新审核） */
  reviewImagePath?: string
  /** @deprecated 使用 episodeIndexes */
  episodeIndex?: number
  /** 该资产出现在哪些分集（由分集实体标签自动关联） */
  episodeIndexes?: number[]
  /** 角色绑定的本地音色（local:voice_xxx，对齐 weifan / 画境） */
  voiceType?: string
  status: AssetStatus
  updatedAt: number
}


export type AssetListKey = 'characters' | 'scenes' | 'props'

export type ShotStatus = 'draft' | 'generating' | 'done' | 'failed'

/** 分镜上传音色条目（可在提示词中 @ 引用） */
export interface WorkflowShotReferenceAudioItem {
  path: string
  /** @ 引用显示名（不含扩展名） */
  name: string
}

export interface WorkflowShot {
  id: string
  episodeId: string
  episodeIndex: number
  shotNumber: number
  /** 分镜标题（5-15 字） */
  dialogue: string
  /** 生图提示词 */
  prompt: string
  sound?: string
  remark?: string
  /** 二次验证：全局空间锚点 */
  spatialAnchor?: string
  /** 提示词 @ 引用的资产 ID（与参考内容同步，生图直接使用） */
  referencedAssetIds?: string[]
  /** @deprecated 请用 validatedImagePaths；保留用于旧数据兼容 */
  validated?: boolean
  /** 人工审核通过的分镜图路径列表（切换主图时按当前图判断） */
  validatedImagePaths?: string[]
  /** 最近一次审核绑定的分镜图路径 */
  validatedImagePath?: string
  /** 单张参考图（兼容旧数据） */
  referenceImagePath?: string
  /** 多张参考图（最多 10 张，含视频截图） */
  referenceImagePaths?: string[]
  /** 视频参考音频（本地路径或公网 URL，生视频前上传至后台） */
  referenceAudioPaths?: string[]
  /** 上传音色元数据（与 referenceAudioPaths 同步，含 @ 引用名） */
  referenceAudioItems?: WorkflowShotReferenceAudioItem[]
  /** 生图时使用的参考图索引 */
  selectedReferenceImageIndex?: number
  generatedImagePath?: string
  generatedImagePaths?: string[]
  primaryGeneratedImageIndex?: number
  /** 分镜图生成状态 */
  status: ShotStatus
  generatedVideoPath?: string
  generatedVideoPaths?: string[]
  primaryGeneratedVideoIndex?: number
  /** 视频生成状态 */
  videoStatus?: ShotStatus
  /** 视频是否已过审 */
  videoValidated?: boolean
  updatedAt: number
}
