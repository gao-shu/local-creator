// Copyright (c) Haode AI. All rights reserved.

/** 与后台 CONSUME_REASONS / grant reasons 对齐 */
export type HaodouConsumeReason =
  | 'consume_image'
  | 'consume_video'
  | 'consume_script'
  | 'consume_tts'

/** 好豆流水 reason → 用户可见文案 */
export const HAODOU_REASON_LABELS: Record<string, string> = {
  register_bonus: '注册礼',
  invite_new_user: '邀请码奖励',
  invite_referrer: '邀请好友',
  admin_adjust: '系统调整',
  consume_image: '生图消耗',
  consume_video: '生视频消耗',
  consume_tts: '配音消耗',
  consume_script: '剧本/LLM 消耗',
  refund_failed: '生成失败退还',
  recharge_package: '充值套餐',
}

export function haodouReasonLabel(reason: string): string {
  return HAODOU_REASON_LABELS[reason] || reason
}

export function haodouConsumeReasonLabel(reason: HaodouConsumeReason): string {
  return haodouReasonLabel(reason)
}
