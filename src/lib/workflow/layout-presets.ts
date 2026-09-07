import type { AppSettings, PromptTemplate } from '@/types/settings'
import type { AssetKind } from '@/types/workflow'

export interface LayoutPreset {
  key: string
  name: string
  subtype: AssetKind
  description?: string
  value: string
}

/** 布局列表来源：完整 settings、仅 layoutTemplates，或模板数组 */
export type LayoutTemplatesSource =
  | Pick<AppSettings, 'layoutTemplates'>
  | PromptTemplate[]
  | null
  | undefined

function resolveLayoutTemplatesList(source?: LayoutTemplatesSource): PromptTemplate[] | undefined {
  if (!source) return undefined
  if (Array.isArray(source)) return source
  return Array.isArray(source.layoutTemplates) ? source.layoutTemplates : undefined
}

function inferLayoutKindFromKey(key: string): AssetKind | undefined {
  if (key.includes('character')) return 'character'
  if (key.includes('scene')) return 'scene'
  if (key.includes('item') || key.includes('prop')) return 'prop'
  return undefined
}

function templateToLayoutPreset(tpl: PromptTemplate): LayoutPreset | null {
  if (tpl.promptType && tpl.promptType !== 'layout') return null
  const key = tpl.key?.trim()
  if (!key) return null
  const kind = tpl.layoutKind ?? inferLayoutKindFromKey(key)
  if (!kind) return null
  return {
    key,
    name: tpl.name?.trim() || key,
    subtype: kind,
    description: tpl.description,
    value: tpl.content ?? '',
  }
}

/** 角色默认布局：即梦+大头+三视图 */
export const DEFAULT_CHARACTER_LAYOUT_KEY = 'layout_character_jimeng_three'
export const DEFAULT_SCENE_LAYOUT_KEY = 'layout_scene_four'
export const DEFAULT_PROP_LAYOUT_KEY = 'layout_item_grid'

/** 各资产类型系统默认布局（写入 settings.defaultAssetLayoutKeys） */
export const DEFAULT_ASSET_LAYOUT_KEYS: Record<AssetKind, string> = {
  character: DEFAULT_CHARACTER_LAYOUT_KEY,
  scene: DEFAULT_SCENE_LAYOUT_KEY,
  prop: DEFAULT_PROP_LAYOUT_KEY,
}

/** 即梦+大头+三视图 */
export const CHARACTER_JIMENG_THREE_VIEW_PROMPT =
  '在纯白色背景上，生成角色的三视图，左边是微侧正面（全身），右边是微侧背面（全身），中间是角色的大头照（角色设计在一张图中,不包含其他物品，人物不手中不拿物品，嘴角等其他地方不残留食物等其他痕迹）注意：左右俩边必须是全身照（需要可以看见脚）'

/** 特写+三视图（对齐画镜） */
export const CHARACTER_CLOSEUP_THREE_VIEW_PROMPT =
  '左侧为角色面部特写(半身)，右侧依次为正面全身，侧身全身，背面全身，三视严格对齐，无透视畸变，角色间距均匀，无重叠。[背景]灰色背景，图片无任何干扰元素、无文字，无水印。PBR材质渲染、细节清晰，边缘锐利，无噪点'

/** 多宫格角色 */
export const CHARACTER_GRID_LAYOUT_PROMPT = `角色设计参考图布局要求：
1. 主视觉区（上方）：以"正面 + 侧面 + 背面"三个核心视角为主体，直观呈现角色的整体身形、服饰搭配和标志性特征，是制作人员对人物"整体造型"的参考基础。
2. 补充信息区（左侧）：拆分出"面部特写"和"配色板"（明确毛发、服饰的色值），补充主视角没覆盖的细节与色彩标准。
3. 局部细节区（底部）：用小模块单独展示关键部件的设计（配饰、点缀、关键身份识别元素），把主视角里的"模糊细节"拆分为精准的制作参考，方便导演确认。
4. 全身照比例照（右侧）：使用黄金比例参考物和人物身高形成对比。`

/** 四视图-参考生（对齐画镜） */
export const SCENE_REF_FOUR_VIEW_PROMPT = `请深度分析我提供的参考图（单张正视图或多张多角度视图）。准确提取图中包含的：时代背景、空间性质、核心主体、建筑/空间结构、材质特征、色彩倾向及光影逻辑。基于提取的特征，进行合理的三维空间推演，生成一个电影级写实的场景概念设计四视图展示。

【总体风格与格式定义】

核心风格： 电影摄影机实拍画面，胶片质感，自然主义布光，高度写实的物理材质，电影剧照级细节。

格式定义： 一个标准的2x2网格布局窗口，包含四个独立的、电影感视角的机位窗口。

【视图布局与机位定义】

左上：正面 (Front) - 窗口

机位： 建筑/空间的正立面或正视角平视摄影。

内容： 精确还原参考图的核心主体，强调结构的真实比例和布局，作为基准视角。

右上：背面 POV (Rear POV) - 窗口

机位： 从场景中心的核心主体位置，向反方向（入口方向）望去的电影主观镜头。

内容： 根据正面视角的线索，合理推导并清晰呈现反向视角的景物（如入口、背景墙面或外部环境），与正面视角形成符合逻辑的空间跳切。视野需开阔，无前景遮挡。

左下：左视图 (Left Side) - 窗口

机位： 纵向剖面或左侧透视摄影。

内容： 展示推演出的真实空间进深、左侧墙面的陈设层次，以及核心主体在纵向空间中的位置。

右下：右视图 (Right Side) - 窗口

机位： 纵向剖面或右侧透视摄影。

内容： 展示推演出的真实空间进深、右侧墙面（如窗户、多宝阁）的陈设层次，与左视图呼应，共同构建完整空间。`

/** 四视图（对齐画镜） */
export const SCENE_FOUR_VIEW_PROMPT = `【全题材通用】场景概念设计四视图生成指令
【前置指令：视觉解析与强制继承】
请深度分析我提供的参考图（单张正视图或多张多角度视图）。准确提取图中包含的：时代背景、空间性质、核心主体、建筑/空间结构、材质特征、色彩倾向及光影逻辑。基于提取的特征，进行合理的三维空间推演，生成一个电影级写实的场景概念设计四视图展示。

【总体风格与格式定义】

核心风格： 电影摄影机实拍画面，胶片质感，自然主义布光，高度写实的物理材质，电影剧照级细节。

格式定义： 一个标准的2x2网格布局窗口，包含四个独立的、电影感视角的机位窗口。

【视图布局与机位定义】

左上：正面 (Front) - 窗口

机位： 建筑/空间的正立面或正视角平视摄影。

内容： 精确还原参考图的核心主体，强调结构的真实比例和布局，作为基准视角。

右上：背面 POV (Rear POV) - 窗口

机位： 从场景中心的核心主体位置，向反方向（入口方向）望去的电影主观镜头。

内容： 根据正面视角的线索，合理推导并清晰呈现反向视角的景物（如入口、背景墙面或外部环境），与正面视角形成符合逻辑的空间跳切。视野需开阔，无前景遮挡。

左下：左视图 (Left Side) - 窗口

机位： 纵向剖面或左侧透视摄影。

内容： 展示推演出的真实空间进深、左侧墙面的陈设层次，以及核心主体在纵向空间中的位置。

右下：右视图 (Right Side) - 窗口

机位： 纵向剖面或右侧透视摄影。

内容： 展示推演出的真实空间进深、右侧墙面（如窗户、多宝阁）的陈设层次，与左视图呼应，共同构建完整空间。`

/** 多宫格场景（对齐画镜） */
export const SCENE_GRID_LAYOUT_PROMPT = `场景设计参考图布局要求：
1. 主视觉区（中央）：展示场景的全景视角，呈现完整的空间布局、建筑结构和环境氛围，是制作人员对场景"整体风格"的参考基础。
2. 多角度展示区（上方）：从不同视角（正面、侧面、俯视、仰视）展示场景的空间感和层次感，帮助理解场景的三维结构。
3. 光影氛围区（左侧）：展示场景在不同时间段（白天、黄昏、夜晚）或不同天气（晴天、阴天、雨天）下的光影效果和色调变化。
4. 细节特写区（底部）：展示场景中的关键道具、装饰元素、材质纹理等局部细节，补充主视角中不易察觉的设计元素。
5. 配色参考区（右侧）：提取场景的主色调、辅助色和点缀色，形成统一的色彩标准参考。`

/** 多宫格物品（对齐画镜） */
export const ITEM_GRID_LAYOUT_PROMPT = `物品设计参考图布局要求：
【重要】这是一张纯物品展示图，画面中禁止出现任何人物、角色、人体部位（如手、脚、身体等），只展示物品本身。

1. 主视觉区（中央）：以"正面 + 侧面 + 背面"三个核心视角展示物品的完整外观，呈现物品的整体造型、材质质感和标志性特征。
2. 多角度展示区（上方）：从不同角度（45度视角、俯视、仰视）展示物品的立体感和细节变化。
3. 尺寸比例区（左侧）：使用标尺或常见参照物（硬币、尺子等）展示物品的实际大小比例。
4. 细节特写区（底部）：展示物品的关键部件、接口、开关、装饰元素等局部细节，用于精准的制作参考。
5. 材质配色区（右侧）：展示物品的材质纹理、表面处理效果和配色方案，提取主色调和辅助色形成色彩标准。

禁止事项：不要出现任何人物、角色、人手、人体部位，只展示物品本身。`

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    key: 'layout_character_jimeng_three',
    name: '即梦+大头+三视图',
    subtype: 'character',
    value: CHARACTER_JIMENG_THREE_VIEW_PROMPT,
  },
  {
    key: 'layout_character_three',
    name: '特写+三视图',
    subtype: 'character',
    description: '决定该角色参考图按哪种版式输出',
    value: CHARACTER_CLOSEUP_THREE_VIEW_PROMPT,
  },
  {
    key: 'layout_character_grid',
    name: '多宫格角色',
    subtype: 'character',
    value: CHARACTER_GRID_LAYOUT_PROMPT,
  },
  {
    key: 'layout_scene_ref_four',
    name: '四视图-参考生',
    subtype: 'scene',
    value: SCENE_REF_FOUR_VIEW_PROMPT,
  },
  {
    key: 'layout_scene_four',
    name: '四视图',
    subtype: 'scene',
    value: SCENE_FOUR_VIEW_PROMPT,
  },
  {
    key: 'layout_scene_grid',
    name: '多宫格场景',
    subtype: 'scene',
    description: '全景 + 多角度 + 光影氛围',
    value: SCENE_GRID_LAYOUT_PROMPT,
  },
  {
    key: 'layout_item_grid',
    name: '多宫格物品',
    subtype: 'prop',
    description: '禁止出现人物',
    value: ITEM_GRID_LAYOUT_PROMPT,
  },
]

const LEGACY_LAYOUT_KEY_MAP: Record<AssetKind, Record<string, string>> = {
  character: { layout_character: 'layout_character_grid' },
  scene: { layout_scene: 'layout_scene_grid' },
  prop: { layout_item: 'layout_item_grid' },
}

export function normalizeLayoutKey(
  layoutKey: string | undefined,
  kind: AssetKind,
): string | undefined {
  const key = layoutKey?.trim()
  if (!key) return undefined
  return LEGACY_LAYOUT_KEY_MAP[kind][key] ?? key
}

/** @deprecated 使用 normalizeLayoutKey */
export function normalizeCharacterLayoutKey(layoutKey?: string): string | undefined {
  return normalizeLayoutKey(layoutKey, 'character')
}

export function getDefaultLayoutKey(kind: AssetKind): string {
  return DEFAULT_ASSET_LAYOUT_KEYS[kind]
}

/** Step3 / 画布：解析当前类型的默认布局 key（资产自身 → 全局 settings → 系统默认） */
export function resolveProjectAssetLayoutKey(
  layoutKey: string | undefined,
  kind: AssetKind,
  globalLayoutKeys?: Partial<Record<AssetKind, string>>,
): string {
  const direct = normalizeLayoutKey(layoutKey, kind)
  if (direct) return direct

  const global = globalLayoutKeys?.[kind]
  const normalizedGlobal = normalizeLayoutKey(global, kind)
  if (normalizedGlobal) return normalizedGlobal

  return getDefaultLayoutKey(kind)
}

/**
 * 合并系统布局 + settings.layoutTemplates 自定义项。
 * 无 settings 时回退硬编码 LAYOUT_PRESETS；有列表时补齐缺失的系统项。
 */
export function listLayoutPresets(source?: LayoutTemplatesSource): LayoutPreset[] {
  const templates = resolveLayoutTemplatesList(source)
  if (!templates?.length) return [...LAYOUT_PRESETS]

  const presets: LayoutPreset[] = []
  const seen = new Set<string>()

  for (const tpl of templates) {
    const preset = templateToLayoutPreset(tpl)
    if (!preset || seen.has(preset.key)) continue
    seen.add(preset.key)
    presets.push(preset)
  }

  for (const sys of LAYOUT_PRESETS) {
    if (seen.has(sys.key)) continue
    seen.add(sys.key)
    presets.push(sys)
  }

  return presets.length > 0 ? presets : [...LAYOUT_PRESETS]
}

export function getLayoutPresetsForKind(kind: AssetKind, source?: LayoutTemplatesSource) {
  return listLayoutPresets(source).filter((p) => p.subtype === kind)
}

export function getLayoutPresetValue(
  key?: string,
  kind?: AssetKind,
  source?: LayoutTemplatesSource,
) {
  const normalized = kind ? normalizeLayoutKey(key, kind) : normalizeCharacterLayoutKey(key)
  if (!normalized) return ''
  const presets = kind ? getLayoutPresetsForKind(kind, source) : listLayoutPresets(source)
  return presets.find((p) => p.key === normalized)?.value ?? ''
}

/** 生图时解析布局文案；未设置 layoutKey 时使用各类型默认布局；未知/已删自定义 key 回退系统默认 */
export function resolveLayoutPresetValue(
  kind: AssetKind,
  layoutKey?: string,
  globalLayoutKeys?: Partial<Record<AssetKind, string>>,
  source?: LayoutTemplatesSource,
): string {
  const key = resolveProjectAssetLayoutKey(layoutKey, kind, globalLayoutKeys)
  const value = getLayoutPresetValue(key, kind, source)
  if (value) return value

  const fallbackKey = getDefaultLayoutKey(kind)
  if (fallbackKey === key) {
    return LAYOUT_PRESETS.find((p) => p.key === fallbackKey)?.value ?? ''
  }
  return (
    getLayoutPresetValue(fallbackKey, kind, source) ||
    LAYOUT_PRESETS.find((p) => p.key === fallbackKey)?.value ||
    ''
  )
}
