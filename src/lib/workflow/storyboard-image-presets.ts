/** 分镜生图 · 推理格式、并发与尺寸预设 */
import { IMAGE_BATCH_CONCURRENCY } from '@/constants/batch-concurrency'
import {
  INFERENCE_FORMAT_OPTIONS,
  type InferenceFormat,
  normalizeInferenceFormat,
  getInferenceFormatMeta,
  isGridInferenceFormat,
  resolveImageSizeForInferenceFormat,
  STORYBOARD_IMAGE_CARRY_SCRIPT,
} from '@/lib/workflow/shot-image-prompt'
import {
  DEFAULT_STORYBOARD_IMAGE_SIZE,
  IMAGE_SIZE_OPTIONS,
} from '@/lib/workflow/image-size-presets'

export {
  INFERENCE_FORMAT_OPTIONS,
  type InferenceFormat,
  normalizeInferenceFormat,
  getInferenceFormatMeta,
  isGridInferenceFormat,
  resolveImageSizeForInferenceFormat,
  STORYBOARD_IMAGE_CARRY_SCRIPT,
}

export interface StoryboardImageGeneratePrefs {
  inferenceFormat: InferenceFormat
  concurrency: string
}

/** 从 settings.json 恢复 Step4 分镜生图表单上次选用 */
export function resolveStoryboardImageGeneratePrefs(
  settings?: {
    lastUsedStoryboardImageInferenceFormat?: string
  } | null,
): StoryboardImageGeneratePrefs {
  return {
    inferenceFormat: normalizeInferenceFormat(settings?.lastUsedStoryboardImageInferenceFormat),
    concurrency: String(IMAGE_BATCH_CONCURRENCY),
  }
}

export { DEFAULT_STORYBOARD_IMAGE_SIZE }
export { IMAGE_SIZE_OPTIONS as STORYBOARD_ASPECT_SIZE_OPTIONS }
