// Copyright (c) Haode AI. All rights reserved.

import {
  extractScriptTextFromFile,
  supportedScriptFormatsLabel,
} from '@/lib/script/script-file-import'

export const CANVAS_PROMPT_TEXT_IMPORT_ACCEPT =
  '.txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** 画布文本节点上限（分镜稿导入需容纳多镜长文；发送生成仍受模型上下文约束） */
export const CANVAS_PROMPT_TEXT_MAX_LENGTH = 100_000

export { supportedScriptFormatsLabel }

export async function importCanvasPromptTextFromFile(
  file: File,
  maxLength: number = CANVAS_PROMPT_TEXT_MAX_LENGTH,
): Promise<{ text: string; truncated: boolean }> {
  const raw = await extractScriptTextFromFile(file)
  if (!raw) {
    throw new Error('文件内容为空')
  }
  if (raw.length <= maxLength) {
    return { text: raw, truncated: false }
  }
  return { text: raw.slice(0, maxLength), truncated: true }
}
