// Copyright (c) local-creator contributors. All rights reserved.

import type { ScriptCreateDraft, ScriptCreateParams } from '@/lib/toolbox/script-create/types'
import { DEFAULT_SCRIPT_CREATE_PARAMS } from '@/lib/toolbox/script-create/types'

const DRAFT_KEY = 'lc.toolbox.script-create.draft.v1'

function isParams(value: unknown): value is ScriptCreateParams {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.contentType === 'string' &&
    typeof item.duration === 'string' &&
    typeof item.episodeCount === 'string' &&
    typeof item.genre === 'string' &&
    typeof item.platform === 'string'
  )
}

export function loadScriptCreateDraft(): ScriptCreateDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ScriptCreateDraft>
    if (parsed.version !== 1) return null
    return {
      version: 1,
      idea: typeof parsed.idea === 'string' ? parsed.idea : '',
      title: typeof parsed.title === 'string' ? parsed.title : '',
      script: typeof parsed.script === 'string' ? parsed.script : '',
      params: isParams(parsed.params) ? { ...DEFAULT_SCRIPT_CREATE_PARAMS, ...parsed.params } : {
        ...DEFAULT_SCRIPT_CREATE_PARAMS,
      },
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    }
  } catch {
    return null
  }
}

export function saveScriptCreateDraft(draft: Omit<ScriptCreateDraft, 'version' | 'updatedAt'>): void {
  try {
    const payload: ScriptCreateDraft = {
      version: 1,
      idea: draft.idea,
      title: draft.title,
      script: draft.script,
      params: draft.params,
      updatedAt: Date.now(),
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota / private mode */
  }
}
