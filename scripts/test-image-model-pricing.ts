/**
 * 图片模型分档计价 · 客户端纯逻辑回归（无需 Electron / dev server）
 *
 * 用法：npm run test:image-pricing
 */

import assert from 'node:assert/strict'

import { resolveModelHaodouCost } from '@/lib/auth/haodou-consume-service'
import {
  formatImageQualityLabel,
  formatImageModelListPriceLabel,
  formatImagePricingModeLabel,
  formatResolutionCapabilityLabel,
  buildImageCapabilityDisplay,
  buildImageModelPickerGroups,
  collectImageGroupNames,
  findImageModelsInSameGroup,
  flattenImageModelGroups,
  groupImageModelsByGroupName,
  isDefaultImageTier,
  isTieredImagePricing,
  mapDtoToImagePricingMeta,
  normalizeImageQuality,
  normalizeImageResolution,
  resolveImageHaodouCostSync,
  resolveImageModelGroupKey,
  shouldFetchImageModelQuote,
} from '@/lib/models/image-model-pricing'
import { getImageModelDisplayTags, formatImageModelSelectOptionLabels } from '@/lib/models/image-model-display'
import { buildImageModelSelectOptions } from '@/lib/models/model-select-options'
import {
  formatImageGenerationTierSummary,
  normalizeImageGenerationTierParams,
  resolveAssetImageTierPrefs,
  resolveStoryboardImageTierPrefs,
  shouldShowImageGenerationTierControls,
  shouldShowImageQualitySelector,
  shouldShowImageResolutionSelector,
  buildImageProxyTierPayload,
} from '@/lib/models/image-generation-tier-params'
import {
  estimateImageHaodouCostSync,
  formatImageHaodouPreviewText,
} from '@/lib/auth/image-billing-display'
import {
  mapSystemModelDto,
  mergeImageModelsGrouped,
  type ClientSystemModelDto,
} from '@/lib/models/system-models-service'
import type { ModelConfig } from '@/types/settings'

function imageModel(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'system:ext_img',
    name: 'Test Image',
    source: 'system',
    modelKey: 'ext_img',
    billingMode: 'external',
    haodouCost: 7,
    unitPrice: 7,
    imagePricing: {
      pricingMode: 'by_resolution',
      pricingSummary: '4K: 21.0 豆/张',
      defaultResolution: '1K',
      defaultQuality: 'medium',
      resolutions: ['1K', '2K', '4K'],
      supportsQualityModes: false,
    },
    ...overrides,
  }
}

function tieredDto(): ClientSystemModelDto {
  return {
    model_key: 'ext_img_tiered',
    name: 'Tiered Image',
    kind: 'image',
    source: 'system',
    haodou_cost: 2,
    billing_mode: 'external',
    unit_price: '2.0',
    unit_label: '豆/张',
    pricing_mode: 'by_resolution',
    pricing_summary: '4K: 3.0 豆/张',
    price_range: { min: '3.0', max: '3.0' },
    default_resolution: '1K',
    default_quality: 'medium',
    resolutions: ['1K', '2K', '4K'],
    supports_quality_modes: false,
    group_name: 'gpt-image-2',
    description: '渠道一，4K 加价',
    config_json: { unit_price: '2.0' },
    proxy_available: true,
  }
}

console.log('[test:image-pricing] normalize helpers')
assert.equal(normalizeImageResolution('4k'), '4K')
assert.equal(normalizeImageResolution('bad'), null)
assert.equal(normalizeImageQuality('HIGH'), 'high')
assert.equal(normalizeImageQuality(''), null)

console.log('[test:image-pricing] quality/resolution labels')
assert.equal(formatImageQualityLabel('high'), '高')
assert.equal(formatResolutionCapabilityLabel(['2K', '1K', '4K']), '1K·2K·4K')

console.log('[test:image-pricing] mapDtoToImagePricingMeta')
const meta = mapDtoToImagePricingMeta(tieredDto())
assert.ok(meta)
assert.equal(meta?.pricingMode, 'by_resolution')
assert.equal(meta?.defaultResolution, '1K')
assert.equal(meta?.groupName, 'gpt-image-2')
assert.equal(meta?.pricingSummary, '4K: 3.0 豆/张')

console.log('[test:image-pricing] mapSystemModelDto')
const mapped = mapSystemModelDto(tieredDto())
assert.equal(mapped.haodouCost, 2)
assert.equal(mapped.resolutions?.join(','), '1K,2K,4K')
assert.equal(mapped.imagePricing?.pricingMode, 'by_resolution')
assert.equal(mapped.imagePricing?.groupName, 'gpt-image-2')

console.log('[test:image-pricing] default tier sync cost')
const model = imageModel()
assert.equal(resolveImageHaodouCostSync(model), 7)
assert.equal(resolveImageHaodouCostSync(model, { quantity: 2 }), 14)
assert.ok(isDefaultImageTier(model))
assert.ok(isDefaultImageTier(model, { resolution: '1K', quality: 'medium' }))
assert.equal(shouldFetchImageModelQuote(model), false)

console.log('[test:image-pricing] non-default tier requires quote')
assert.equal(resolveImageHaodouCostSync(model, { resolution: '4K' }), 0)
assert.equal(shouldFetchImageModelQuote(model, { resolution: '4K' }), true)
assert.ok(!isDefaultImageTier(model, { resolution: '4K' }))

console.log('[test:image-pricing] flat pricing')
const flat = imageModel({
  imagePricing: {
    pricingMode: 'flat',
    pricingSummary: '固定 7.0 豆/张',
    defaultResolution: '1K',
    defaultQuality: 'medium',
  },
})
assert.ok(isTieredImagePricing('flat') === false)
assert.equal(shouldFetchImageModelQuote(flat, { resolution: '4K' }), false)
assert.equal(resolveImageHaodouCostSync(flat, { resolution: '4K' }), 7)

console.log('[test:image-pricing] resolveModelHaodouCost uses imagePricing default')
assert.equal(resolveModelHaodouCost(model, 'image'), 7)
assert.equal(resolveModelHaodouCost(model, 'image', { resolution: '4K' }), 0)

console.log('[test:image-pricing] internal billing returns 0')
const internal = imageModel({ billingMode: 'internal', haodouCost: undefined, unitPrice: undefined })
assert.equal(resolveImageHaodouCostSync(internal), 0)
assert.equal(resolveModelHaodouCost(internal, 'image'), 0)

console.log('[test:image-pricing] description maps to remark')
const withDescription = mapSystemModelDto({
  ...tieredDto(),
  description: '渠道一，4K 加价',
})
assert.equal(withDescription.remark, '渠道一，4K 加价')

console.log('[test:image-pricing] group by group_name')
const channelOne = mapSystemModelDto({ ...tieredDto(), model_key: 'ch1', name: 'GPT · 渠道一' })
const channelTwo = mapSystemModelDto({
  ...tieredDto(),
  model_key: 'ch2',
  name: 'GPT · 渠道二',
  description: '渠道二',
})
const ungrouped = mapSystemModelDto({
  ...tieredDto(),
  model_key: 'solo',
  name: 'Solo Model',
  group_name: null,
  description: null,
})
const groups = groupImageModelsByGroupName([channelOne, channelTwo, ungrouped])
assert.equal(groups.length, 2)
assert.equal(groups[0]?.groupKey, 'gpt-image-2')
assert.equal(groups[0]?.isMultiChannel, true)
assert.equal(groups[0]?.models.length, 2)
assert.equal(groups[1]?.groupKey, 'solo')
assert.equal(groups[1]?.isMultiChannel, false)

console.log('[test:image-pricing] collectImageGroupNames + same group lookup')
assert.deepEqual(collectImageGroupNames([channelOne, channelTwo, ungrouped]), ['gpt-image-2'])
assert.equal(findImageModelsInSameGroup([channelOne, channelTwo, ungrouped], channelOne).length, 2)
assert.equal(resolveImageModelGroupKey(channelOne), 'gpt-image-2')

console.log('[test:image-pricing] buildImageModelPickerGroups')
const pickerGroups = buildImageModelPickerGroups(
  [{ id: 'custom-1', name: 'My API', source: 'custom' }],
  [channelOne, channelTwo],
)
assert.equal(pickerGroups.customModels.length, 1)
assert.equal(pickerGroups.systemGroups.length, 1)
assert.equal(flattenImageModelGroups(pickerGroups.systemGroups).length, 2)

console.log('[test:image-pricing] mergeImageModelsGrouped')
const mergedGroups = mergeImageModelsGrouped(
  [{ id: 'custom-1', name: 'My API', source: 'custom' }],
  { llm: [], image: [channelOne, channelTwo], video: [] },
)
assert.equal(mergedGroups.systemGroups[0]?.models.length, 2)

console.log('[test:image-pricing] display helpers')
assert.equal(formatImagePricingModeLabel('by_resolution'), '分辨率')
assert.equal(formatImageModelListPriceLabel(channelOne), '4K: 3.0 豆/张')
const capability = buildImageCapabilityDisplay(channelOne)
assert.equal(capability.resolutionLabel, '1K·2K·4K')
assert.equal(capability.aspectRatioLabel, null)

console.log('[test:image-pricing] image model select options')
const selectTags = getImageModelDisplayTags(channelOne)
assert.ok(selectTags.includes('1K·2K·4K'))
assert.ok(selectTags.includes('分辨率'))
const selectLabel = formatImageModelSelectOptionLabels(channelOne)
assert.equal(selectLabel.label, 'GPT · 渠道一')
assert.equal(selectLabel.suffix, '4K: 3.0 豆/张')
assert.equal(selectLabel.systemBadgeTone, 'external')
const selectOptions = buildImageModelSelectOptions([channelOne, channelTwo, ungrouped])
assert.equal(selectOptions.length, 3)
assert.equal(selectOptions[0]?.group, 'gpt-image-2')
assert.ok(selectOptions.some((item) => item.label === 'GPT · 渠道一'))
assert.ok(selectOptions.some((item) => item.label === 'GPT · 渠道二'))
assert.equal(selectOptions[2]?.group, undefined)
const withCustom = buildImageModelSelectOptions([
  channelOne,
  channelTwo,
  { id: 'custom-1', name: 'My API', source: 'custom' },
])
assert.equal(withCustom.length, 3)
assert.equal(withCustom[0]?.group, 'gpt-image-2')
assert.equal(withCustom[2]?.group, '自定义模型')

console.log('[test:image-pricing] image generation tier params')
const tieredModel = channelOne
assert.equal(shouldShowImageResolutionSelector(tieredModel), true)
assert.equal(shouldShowImageQualitySelector(tieredModel), false)
const qualityModel = mapSystemModelDto({
  ...tieredDto(),
  model_key: 'quality_img',
  pricing_mode: 'by_quality_resolution',
  supports_quality_modes: true,
})
assert.equal(shouldShowImageQualitySelector(qualityModel), true)
const qualityTierParams = normalizeImageGenerationTierParams(qualityModel, {
  resolution: '4K',
  quality: 'high',
})
assert.equal(qualityTierParams.quality, 'high')
assert.equal(formatImageGenerationTierSummary(qualityModel, qualityTierParams), '4K · 高')
const flatModel = mapSystemModelDto({
  ...tieredDto(),
  model_key: 'flat_img',
  pricing_mode: 'flat',
  pricing_summary: '固定 2.0 豆/张',
})
assert.equal(shouldShowImageGenerationTierControls(flatModel), false)
const tierParams = normalizeImageGenerationTierParams(tieredModel, { resolution: '4K' })
assert.equal(tierParams.resolution, '4K')
assert.equal(tierParams.quality, null)
assert.equal(formatImageGenerationTierSummary(tieredModel, tierParams), '4K')
const assetPrefs = resolveAssetImageTierPrefs({
  lastUsedAssetImageResolution: '2K',
  lastUsedAssetImageQuality: 'high',
})
assert.equal(assetPrefs.resolution, '2K')
assert.equal(assetPrefs.quality, 'high')
const storyboardPrefs = resolveStoryboardImageTierPrefs({
  lastUsedStoryboardImageResolution: '1K',
  lastUsedStoryboardImageQuality: 'low',
})
assert.equal(storyboardPrefs.quality, 'low')

console.log('[test:image-pricing] proxy tier payload + billing preview')
assert.deepEqual(buildImageProxyTierPayload(tieredModel, { resolution: '4K', quality: 'high' }), {
  resolution: '4K',
})
assert.deepEqual(buildImageProxyTierPayload(flatModel, { resolution: '4K' }), {})
const billingSync = estimateImageHaodouCostSync({
  model: tieredModel,
  resolution: '1K',
  quality: 'medium',
})
assert.equal(billingSync.haodouCost, 2)
assert.equal(
  formatImageHaodouPreviewText({ haodouCost: 7, consumesHaodou: true, modelName: 'Test' }),
  '预计 7 好豆',
)

console.log('[test:image-pricing] all passed')
