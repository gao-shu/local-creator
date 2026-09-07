export interface ImageSizePreset {
  value: string
  /** 收起时展示（不含像素尺寸） */
  label: string
  /** 下拉展开时展示（含像素尺寸） */
  menuLabel: string
  apiSize: string
}

/** 画质 + 画幅 + 比例；像素尺寸仅在下拉菜单中展示 */
export const IMAGE_SIZE_OPTIONS: ImageSizePreset[] = [
  { value: '1024x1024', label: '1K 方图 1:1', menuLabel: '1K 方图 1:1 (1024×1024)', apiSize: '1024x1024' },
  { value: '2k-1:1', label: '2K 方图 1:1', menuLabel: '2K 方图 1:1 (2048×2048)', apiSize: '2048x2048' },
  { value: '4k-1:1', label: '4K 方图 1:1', menuLabel: '4K 方图 1:1 (4096×4096)', apiSize: '4096x4096' },
  { value: '1k-16:9', label: '1K 横图 16:9', menuLabel: '1K 横图 16:9 (1920×1080)', apiSize: '1920x1080' },
  { value: '1k-9:16', label: '1K 竖图 9:16', menuLabel: '1K 竖图 9:16 (1080×1920)', apiSize: '1080x1920' },
  { value: '2k-16:9', label: '2K 横图 16:9', menuLabel: '2K 横图 16:9 (2560×1440)', apiSize: '2560x1440' },
  { value: '2k-9:16', label: '2K 竖图 9:16', menuLabel: '2K 竖图 9:16 (1440×2560)', apiSize: '1440x2560' },
  { value: '4k-16:9', label: '4K 横图 16:9', menuLabel: '4K 横图 16:9 (3840×2160)', apiSize: '3840x2160' },
  { value: '4k-9:16', label: '4K 竖图 9:16', menuLabel: '4K 竖图 9:16 (2160×3840)', apiSize: '2160x3840' },
]

/** 分镜生图默认：2K 16:9 */
export const DEFAULT_STORYBOARD_IMAGE_SIZE = '2k-16:9'

export const DEFAULT_IMAGE_SIZE = '1024x1024'

/** 画布旧版像素 value → 统一 preset value */
const LEGACY_IMAGE_SIZE_ALIASES: Record<string, string> = {
  '768x1344': '1k-9:16',
  '1344x768': '1k-16:9',
  '1024x1536': '2k-9:16',
  '1536x1024': '2k-16:9',
  '2048x2048': '2k-1:1',
  '4096x4096': '4k-1:1',
}

const API_SIZE_TO_PRESET = Object.fromEntries(
  IMAGE_SIZE_OPTIONS.map((option) => [option.apiSize, option.value]),
) as Record<string, string>

export function findImageSizePreset(presetValue: string): ImageSizePreset | undefined {
  return IMAGE_SIZE_OPTIONS.find((option) => option.value === presetValue)
}

export function resolveImageSizeApiValue(presetValue: string): string {
  const hit = findImageSizePreset(presetValue)
  return hit?.apiSize ?? '1024x1024'
}

/** 校验并回落到合法 preset value（用于读取 settings / 画布节点中上次选用的尺寸） */
export function normalizeImageSizePreset(
  value: string | undefined,
  fallback: string = DEFAULT_IMAGE_SIZE,
): string {
  const raw = value?.trim()
  const candidate = raw
    ? LEGACY_IMAGE_SIZE_ALIASES[raw] ?? API_SIZE_TO_PRESET[raw] ?? raw
    : undefined
  if (candidate && IMAGE_SIZE_OPTIONS.some((option) => option.value === candidate)) {
    return candidate
  }
  return normalizeImageSizePreset(fallback, DEFAULT_IMAGE_SIZE)
}

/** 工具栏等窄位展示：短 label，不含像素尺寸 */
export function formatImageSizeDisplay(presetValue: string): string {
  const preset = findImageSizePreset(presetValue)
  if (preset) return preset.label
  const api = resolveImageSizeApiValue(presetValue)
  return api.replace('x', '×')
}

/** Select 选项：收起用 label，展开用 menuLabel */
export function toImageSizeSelectOptions() {
  return IMAGE_SIZE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    menuLabel: option.menuLabel,
  }))
}
