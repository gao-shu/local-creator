import type { EpisodeStyle } from '@/types/workflow'

export type ModelKind = 'llm' | 'image' | 'video'

export type BillingMode = 'internal' | 'external'

export type ImagePricingMode = 'flat' | 'by_resolution' | 'by_quality_resolution'

export type VideoPricingMode = 'flat' | 'by_resolution'

export type ImageQuality = 'low' | 'medium' | 'high'

export interface ImageAspectRatioItem {
  label: string
  value: string
  width: number
  height: number
}

/** 系统图片模型分档计价元数据（GET /client/models，Client Step 2+） */
export interface ImageModelPricingMeta {
  pricingMode?: ImagePricingMode | null
  pricingSummary?: string | null
  priceRange?: { min: string; max: string } | null
  defaultResolution?: string | null
  defaultQuality?: ImageQuality | null
  resolutions?: string[]
  supportsQualityModes?: boolean
  aspectRatios?: ImageAspectRatioItem[]
  groupName?: string | null
  description?: string | null
}

/** 系统视频模型分档计价元数据（GET /client/models，Phase 5） */
export interface VideoModelPricingMeta {
  pricingMode?: VideoPricingMode | null
  pricingSummary?: string | null
  priceRange?: { min: string; max: string } | null
  defaultResolution?: string | null
  resolutions?: string[]
}

export type ModelConsumptionUnit = 'second' | 'count' | 'call' | '1k_tokens'

/** 后台项目消耗单价（GET /client/models → consumption） */
export interface ModelConsumptionConfig {
  billing_enabled: boolean
  price: string
  unit: ModelConsumptionUnit
  unit_label: string
}

export interface ModelConfig {
  id: string
  name: string
  endpoint?: string
  apiKey?: string
  model?: string
  apiFormat?: string
  platform?: string
  autoAppendV1?: boolean
  /** 模型来源：仅保留 custom（历史 system 字段可读入后过滤） */
  source?: 'system' | 'custom'
  /** 系统模型标识（遗留字段，开源版忽略） */
  modelKey?: string
  /** @deprecated */
  isBackendModel?: boolean
  /** 先上传本地素材改 URL 请求，避免 base64 过大 */
  uploadByUrl?: boolean
  /** 视频：简单模式填 baseUrl，系统自动拼接 endpoint */
  configMode?: 'simple' | 'advanced'
  baseUrl?: string
  /** 视频能力：画面比例 / 时长(秒) / 清晰度 / 参考模式（与计价分离） */
  ratios?: string[]
  defaultRatio?: string
  durations?: number[]
  defaultDurationSec?: number
  resolutions?: string[]
  /** 开放参考模式（VideoReferenceMode 字符串）；缺省见 resolveVideoCapability 读兜底 */
  referenceModes?: string[]
  defaultReferenceMode?: string
  remark?: string
  /** 系统模型统一单价（1 位小数）；internal=元，external=豆 */
  unitPrice?: number
  /** 单价单位文案，如 元/秒、豆/张 */
  unitLabel?: string
  /** 平台系统模型单次额度扣费（legacy 展示；计费以 unitPrice×数量 为准） */
  generateCost?: number
  /** 项目消耗计费（仅 source=system，由后台 consumption-prices 配置） */
  consumption?: ModelConsumptionConfig
  /** 系统图片模型分档计价（external/internal 均可展示；扣豆仅 external） */
  imagePricing?: ImageModelPricingMeta
  /** 系统视频模型分档计价（external/internal 均可展示；扣豆仅 external） */
  videoPricing?: VideoModelPricingMeta
}

export type ModelPlatform =
  | 'openai_compatible'
  | 'new_api'
  | 'volcengine'
  | 'google_vertex'
  | 'google_gemini'
  | 'anthropic'
  | 'ollama'

export type SettingsPromptType = 'extract' | 'storyboard' | 'style' | 'layout'

export type TemplateListKey =
  | 'extractTemplates'
  | 'styleTemplates'
  | 'storyboardTemplates'
  | 'layoutTemplates'

/** 布局模板适用的资产类型 */
export type LayoutTemplateKind = 'character' | 'scene' | 'prop'

export interface PromptTemplate {
  id: string
  key: string
  name: string
  promptType: SettingsPromptType | 'other'
  content: string
  description?: string
  /** 布局模板专用：角色 / 场景 / 道具 */
  layoutKind?: LayoutTemplateKind
  /** 风格模板：所属描述大类（LLM 分集/提取语义） */
  styleCategory?: EpisodeStyle
  /** 风格模板：在项目风格选择器中优先展示 */
  styleRecommended?: boolean
  isBuiltin?: boolean
}

/** 分镜生图/生视频固定前后缀预设（全局 settings.json） */
export interface PromptAffixPreset {
  id: number
  name: string
  prefix: string
  suffix: string
  isDefault?: boolean
}

/** 便携数据包内的 settings.json 字段 */
export interface AppSettings {
  /** 便携数据根目录（所有项目、素材、配置均在此目录内） */
  dataRootPath: string
  dataRootPathHistory?: string[]
  /** @deprecated 与 dataRootPath 同步，仅保留字段兼容 */
  projectsDataPath: string
  /** @deprecated 与 dataRootPath 同步，仅保留字段兼容 */
  workflowDataPath: string
  projectsDataPathHistory?: string[]
  workflowDataPathHistory?: string[]
  characterLibraryPath: string
  sceneLibraryPath: string
  generatedImagesPath: string
  videoSavePath: string
  llmModels: ModelConfig[]
  imageModels: ModelConfig[]
  videoModels: ModelConfig[]
  storyboardTemplates: PromptTemplate[]
  extractTemplates: PromptTemplate[]
  styleTemplates: PromptTemplate[]
  layoutTemplates: PromptTemplate[]
  /** 开启后生视频前展示请求参数确认弹窗 */
  debugEnabled?: boolean
  /** 开机时自动启动应用（默认 true；仅打包版写入系统登录项） */
  openAtLogin?: boolean
  /** 最近一次在创作流程中选用的 LLM 配置 id */
  lastUsedLlmModelId?: string
  /** Step2 分集规划上次选用的 LLM id */
  lastUsedEpisodeLlmModelId?: string
  /** Step2 资产提取 / AI 分集上次选用的提取模板 key */
  lastUsedExtractTemplateKey?: string
  /** Step4 分镜推理上次选用的 LLM id */
  lastUsedStoryboardLlmModelId?: string
  /** Step3 资产生图上次选用的尺寸 preset value */
  lastUsedAssetImageSize?: string
  /** Step3 资产生图计价档分辨率（1K/2K/4K） */
  lastUsedAssetImageResolution?: string
  /** Step3 资产生图计价档质量 */
  lastUsedAssetImageQuality?: ImageQuality
  /** Step4 分镜生图上次选用的尺寸 preset value */
  lastUsedStoryboardImageSize?: string
  /** Step4 分镜生图计价档分辨率 */
  lastUsedStoryboardImageResolution?: string
  /** Step4 分镜生图计价档质量 */
  lastUsedStoryboardImageQuality?: ImageQuality
  /** Step3 资产生图上次选用的图片模型 id */
  lastUsedAssetImageModelId?: string
  /** Step4 分镜生图上次选用的图片模型 id */
  lastUsedStoryboardImageModelId?: string
  /** Step4 生视频上次选用的视频模型 id（同时记住上次选用的视频模型） */
  lastUsedStoryboardVideoModelId?: string
  /** Step4 生视频上次选用的参考模式 */
  lastUsedStoryboardVideoReferenceMode?: string
  /** Step4 生视频上次选用的时长（秒，与下拉 value 一致） */
  lastUsedStoryboardVideoDuration?: string
  /** Step4 生视频上次选用的画面比例 */
  lastUsedStoryboardVideoAspectRatio?: string
  /** Step4 生视频上次选用的分辨率 */
  lastUsedStoryboardVideoResolution?: string
  /** Step4 分镜生图上次选用的推理格式（单图/宫格） */
  lastUsedStoryboardImageInferenceFormat?: string
  /** Step4 分镜生图是否携带当前剧本 */
  lastUsedStoryboardImageCarryScript?: boolean
  /** Step4 分镜批量生图/生视频上次选用的并发数 */
  lastUsedStoryboardBatchConcurrency?: string
  /** Step4 批量生视频是否跳过已有视频 */
  lastUsedStoryboardVideoSkipExisting?: boolean
  /** Step4 批量生视频发送顺序 */
  lastUsedStoryboardVideoSendOrder?: string
  /** Step4 定时生视频间隔（分钟） */
  lastUsedStoryboardVideoScheduleIntervalMin?: string
  /** Step4 定时生视频轮数 */
  lastUsedStoryboardVideoScheduleRounds?: string
  /** Step3 各资产类型上次选用的画风 preset key */
  lastUsedAssetStyleKeys?: Partial<Record<'character' | 'scene' | 'prop', string>>
  /** 各资产类型默认布局 preset key（新建资产 / 未指定 layoutKey 时使用，全局生效） */
  defaultAssetLayoutKeys?: Partial<Record<'character' | 'scene' | 'prop', string>>
  /** 画布分镜推理上次选用的分镜模板 key */
  lastUsedCanvasStoryboardTemplateKey?: string
  /** 画布生图各资产类型上次选用的布局 preset key */
  lastUsedCanvasLayoutKeys?: Partial<Record<'character' | 'scene' | 'prop', string>>
  /** Step4 分镜生图上次选用的画风 preset key */
  lastUsedStoryboardStyleKey?: string
  /** Step4 预览区上次选用：显示分镜图 / 显示视频 */
  lastUsedStoryboardPreviewMode?: 'image' | 'video'
  /** Step4 预览区上次选用：横屏 / 竖屏 */
  lastUsedStoryboardPreviewAspect?: 'landscape' | 'portrait'
  /**
   * Step4 补空间锚点档位：
   * - quick：快速补锚点（轻量）
   * - deep：深度连续性审查（硬规则 + 可选原文摘要）
   * 未设置时：内部账号默认 deep，外部默认 quick
   */
  storyboardValidateMode?: 'quick' | 'deep'
  /** @deprecated 不再使用，保留字段兼容旧 settings.json */
  defaultLlmModelId?: string
  /** @deprecated 不再使用，保留字段兼容旧 settings.json */
  defaultImageModelId?: string
  /** @deprecated 不再使用，保留字段兼容旧 settings.json */
  defaultVideoModelId?: string
  /** 可选自建后端 API 根地址；默认空（不连公司服务器） */
  apiBaseUrl?: string
  /** 分镜固定前后缀预设库 */
  affixPresets?: PromptAffixPreset[]
}

export type SettingsTabId = 'paths' | 'models' | 'templates' | 'system' | 'account' | 'agreement'

export interface SettingsReadResult {
  success: boolean
  fileExists: boolean
  data: AppSettings
  filePath: string
  /** 启动器目录（仅存放 storage-root.json 指针） */
  launcherDir: string
  /** 当前绑定的便携数据根目录 */
  dataRoot: string
  /** 路径解析用，等于 dataRoot（未绑定时为 launcherDir） */
  appDataDir: string
  error?: string
}

export interface BindDataRootResult {
  success: boolean
  fileExists?: boolean
  data?: AppSettings
  dataRoot?: string
  filePath?: string
  launcherDir?: string
  error?: string
}

export interface SettingsWriteResult {
  success: boolean
  filePath?: string
  dataRoot?: string
  error?: string
}

export interface ExportDataRootPackageResult {
  success: boolean
  canceled?: boolean
  filePath?: string
  error?: string
}

export interface SelectDirectoryResult {
  success: boolean
  path?: string
  canceled?: boolean
  error?: string
}
