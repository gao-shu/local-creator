// Copyright (c) local-creator contributors. All rights reserved.

import { SCRIPT_MAX_LENGTH } from '@/types/workflow'

export function serializeScriptDraft(script: string): string {
  const text = script.replace(/\r\n/g, '\n').trim()
  if (text.length <= SCRIPT_MAX_LENGTH) return text
  return text.slice(0, SCRIPT_MAX_LENGTH)
}

export function clampScriptText(script: string): { text: string; truncated: boolean } {
  if (script.length <= SCRIPT_MAX_LENGTH) {
    return { text: script, truncated: false }
  }
  return { text: script.slice(0, SCRIPT_MAX_LENGTH), truncated: true }
}

export function sanitizeExportFileName(title: string): string {
  const base = title.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ')
  return (base || '剧本').slice(0, 40)
}

export function resolveWorkshopProjectTitle(input: {
  title: string
  parsedTitle?: string
  idea: string
}): string {
  const explicit = input.title.trim()
  if (explicit) return explicit.slice(0, 40)
  const parsed = input.parsedTitle?.trim()
  if (parsed) return parsed.slice(0, 40)
  const idea = input.idea.trim().replace(/\s+/g, ' ')
  if (idea) return idea.slice(0, 20)
  return '未命名剧本'
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.endsWith('.txt') ? filename : `${filename}.txt`
  anchor.click()
  URL.revokeObjectURL(url)
}
