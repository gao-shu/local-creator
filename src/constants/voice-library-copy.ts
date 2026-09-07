// Copyright (c) Haode AI. All rights reserved.

/** 新增音色表单说明（软件级索引，各项目可选用） */
export const VOICE_LIBRARY_SAVE_HINT = '保存到软件音色库，各项目均可选用'

/** 保存按钮文案 */
export const VOICE_LIBRARY_SAVE_BUTTON = '保存到音色库'

/** 展开表单标题 */
export const VOICE_LIBRARY_ADD_TITLE = '添加音色'

/** 外层「新增」按钮文案 */
export const VOICE_LIBRARY_ADD_TRIGGER = '新增音色'

export function formatVoiceLibrarySavedToast(voiceName: string): string {
  return `已保存到音色库：${voiceName}`
}
