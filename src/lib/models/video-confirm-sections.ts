/**
 * 生视频确认弹窗：能力参数区 vs 费用区文案约定（H1）
 * 能力区只展示规格选项，禁止混入单价/额度。
 */

export const VIDEO_CONFIRM_PARAMS_SECTION_TITLE = '生成参数'
export const VIDEO_CONFIRM_BILLING_SECTION_TITLE = '费用预估'

export type VideoConfirmCapabilityField = {
  key: 'referenceMode' | 'duration' | 'aspectRatio' | 'resolution'
  label: string
  value: string
}

const PRICING_COPY_PATTERN = /豆|元|￥|\$|price|单价|费用|询价/i

export function buildVideoConfirmCapabilityFields(input: {
  referenceModeLabel?: string | null
  durationSec?: number | string | null
  aspectRatio?: string | null
  resolution?: string | null
}): VideoConfirmCapabilityField[] {
  const fields: VideoConfirmCapabilityField[] = []
  const mode = String(input.referenceModeLabel || '').trim()
  if (mode) {
    fields.push({ key: 'referenceMode', label: '参考模式', value: mode })
  }

  const durationRaw = input.durationSec
  if (durationRaw !== undefined && durationRaw !== null && durationRaw !== '') {
    const sec = Number(durationRaw)
    if (Number.isFinite(sec)) {
      fields.push({ key: 'duration', label: '时长', value: `${sec}s` })
    }
  }

  const ratio = String(input.aspectRatio || '').trim()
  if (ratio) {
    fields.push({ key: 'aspectRatio', label: '比例', value: ratio })
  }

  const resolution = String(input.resolution || '').trim()
  if (resolution) {
    fields.push({ key: 'resolution', label: '清晰度', value: resolution })
  }

  return fields
}

/** 能力区字段不得含计价文案（测试与 UI 守卫） */
export function capabilityFieldsContainPricingCopy(
  fields: VideoConfirmCapabilityField[],
): boolean {
  return fields.some(
    (field) => PRICING_COPY_PATTERN.test(field.label) || PRICING_COPY_PATTERN.test(field.value),
  )
}
