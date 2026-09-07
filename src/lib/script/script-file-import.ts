// Copyright (c) HaodeAI. Script file import helpers.

import mammoth from 'mammoth'

const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.docx'] as const

export type ScriptImportExtension = (typeof SUPPORTED_EXTENSIONS)[number]

export function getScriptFileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return ''
  return name.slice(dot).toLowerCase()
}

export function isSupportedScriptFile(name: string): boolean {
  const ext = getScriptFileExtension(name)
  return SUPPORTED_EXTENSIONS.includes(ext as ScriptImportExtension)
}

export function supportedScriptFormatsLabel() {
  return 'TXT / MD / DOCX'
}

/** 从本地文件提取剧本文本 */
export async function extractScriptTextFromFile(file: File): Promise<string> {
  const ext = getScriptFileExtension(file.name)

  if (ext === '.doc') {
    throw new Error('不支持旧版 .doc 格式，请另存为 .docx 或 .txt 后导入')
  }

  if (!isSupportedScriptFile(file.name)) {
    throw new Error(`仅支持 ${supportedScriptFormatsLabel()} 文件`)
  }

  if (ext === '.docx') {
    const buffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer: buffer })
    return normalizeImportedText(result.value)
  }

  const text = await file.text()
  return normalizeImportedText(text)
}

function normalizeImportedText(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}
