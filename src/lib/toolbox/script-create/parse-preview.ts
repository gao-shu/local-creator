// Copyright (c) local-creator contributors. All rights reserved.

import type { ScriptPreviewSummary } from '@/lib/toolbox/script-create/types'

function cleanInline(text: string): string {
  return text.replace(/^[#>*\-\s]+/, '').replace(/\*\*/g, '').trim()
}

export function parseScriptPreview(script: string): ScriptPreviewSummary {
  const lines = script.replace(/\r\n/g, '\n').split('\n')
  let title = ''
  let hook = ''
  let durationHint = ''
  const sceneTitles: string[] = []
  const characterNames: string[] = []
  let inCharacters = false

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    if (!title) {
      const h1 = line.match(/^#\s+(.+)$/)
      if (h1) {
        title = cleanInline(h1[1])
        continue
      }
    }

    const quote = line.match(/^>\s*(.+)$/)
    if (quote) {
      const body = quote[1]
      if (!hook && /卖点|一句话/.test(body)) {
        hook = cleanInline(body.replace(/^一句话卖点[：:]\s*/, ''))
      } else if (!durationHint && /时长|预估/.test(body)) {
        durationHint = cleanInline(body.replace(/^预估时长[：:]\s*/, ''))
      } else if (!hook) {
        hook = cleanInline(body)
      }
      continue
    }

    if (/^##\s*角色/.test(line)) {
      inCharacters = true
      continue
    }
    if (/^##\s+/.test(line) && !/^##\s*角色/.test(line)) {
      inCharacters = false
    }

    if (inCharacters) {
      const char = line.match(/^[-*]\s*([^：:]+)[：:]/)
      if (char) {
        const name = cleanInline(char[1])
        if (name && !characterNames.includes(name)) characterNames.push(name)
      }
      continue
    }

    const scene =
      line.match(/^###\s*(.+)$/) ||
      line.match(/^##\s*(第\s*\d+\s*集.*)$/) ||
      line.match(/^##\s*(场次\s*\d+.*)$/)
    if (scene) {
      const label = cleanInline(scene[1])
      if (label && !sceneTitles.includes(label)) sceneTitles.push(label)
    }
  }

  if (!title) {
    const first = lines.map((item) => item.trim()).find(Boolean)
    if (first) title = cleanInline(first).slice(0, 40)
  }

  return {
    title,
    hook,
    durationHint,
    sceneTitles: sceneTitles.slice(0, 8),
    characterNames: characterNames.slice(0, 8),
  }
}

export function extractTitleFromScript(script: string): string {
  return parseScriptPreview(script).title
}
