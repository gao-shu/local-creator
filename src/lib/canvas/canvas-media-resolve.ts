// Copyright (c) local-creator contributors. All rights reserved.

import type { CanvasMediaOwnerKind } from '@/types/canvas-nodes'
import { resolveMaterialsLibraryRootFromSettings } from '@/lib/materials/global-materials-paths'
import { resolveCanvasProjectRoot } from '@/lib/canvas/canvas-project-paths'
import { normalizeStoredMediaPath } from '@/lib/storage/media-path-resolver'
import { resolveProjectRoot } from '@/lib/storage/project-paths'
import { readSettings } from '@/lib/storage/settings-service'
import { isProjectVoiceExtractRelativePath } from '@/lib/voice/project-voice-extract-paths'

export interface CanvasMediaLocation {
  path: string
  ownerKind?: CanvasMediaOwnerKind
  ownerProjectId?: string
}

/** 短时缓存，避免大画布每个媒体节点重复 readSettings */
const PROJECT_ROOT_CACHE_TTL_MS = 30_000

type ProjectRootCacheEntry = {
  value: string | undefined
  expiresAt: number
}

const projectRootCache = new Map<string, ProjectRootCacheEntry>()
const projectRootInflight = new Map<string, Promise<string | undefined>>()

function projectRootCacheKey(
  canvasProjectId: string,
  owner?: Pick<CanvasMediaLocation, 'ownerKind' | 'ownerProjectId'>,
): string {
  return [
    String(canvasProjectId || '').trim(),
    String(owner?.ownerKind || ''),
    String(owner?.ownerProjectId || '').trim(),
  ].join('|')
}

async function resolveCanvasMediaProjectRootUncached(
  canvasProjectId: string,
  owner?: Pick<CanvasMediaLocation, 'ownerKind' | 'ownerProjectId'>,
): Promise<string | undefined> {
  const settingsRes = await readSettings()
  if (owner?.ownerKind === 'materials') {
    return resolveMaterialsLibraryRootFromSettings(settingsRes.data, settingsRes.appDataDir)
  }
  if (owner?.ownerKind === 'workflow' && owner.ownerProjectId) {
    return resolveProjectRoot(settingsRes.data, settingsRes.appDataDir, owner.ownerProjectId)
  }
  if (owner?.ownerKind === 'canvas' && owner.ownerProjectId) {
    return resolveCanvasProjectRoot(settingsRes.data, settingsRes.appDataDir, owner.ownerProjectId)
  }
  if (!canvasProjectId) return undefined
  return resolveCanvasProjectRoot(settingsRes.data, settingsRes.appDataDir, canvasProjectId)
}

export async function resolveCanvasMediaProjectRoot(
  canvasProjectId: string,
  owner?: Pick<CanvasMediaLocation, 'ownerKind' | 'ownerProjectId'>,
): Promise<string | undefined> {
  const key = projectRootCacheKey(canvasProjectId, owner)
  const now = Date.now()
  const cached = projectRootCache.get(key)
  if (cached && cached.expiresAt > now) return cached.value

  const inflight = projectRootInflight.get(key)
  if (inflight) return inflight

  const promise = resolveCanvasMediaProjectRootUncached(canvasProjectId, owner)
    .then((value) => {
      projectRootCache.set(key, {
        value,
        expiresAt: Date.now() + PROJECT_ROOT_CACHE_TTL_MS,
      })
      return value
    })
    .finally(() => {
      projectRootInflight.delete(key)
    })

  projectRootInflight.set(key, promise)
  return promise
}

export async function resolveCanvasMediaProjectRootSync(
  canvasProjectId: string,
  settings: { dataRootPath?: string },
  appDataDir: string,
  owner?: Pick<CanvasMediaLocation, 'ownerKind' | 'ownerProjectId'>,
): Promise<string> {
  if (owner?.ownerKind === 'materials') {
    return resolveMaterialsLibraryRootFromSettings(settings, appDataDir)
  }
  if (owner?.ownerKind === 'workflow' && owner.ownerProjectId) {
    return resolveProjectRoot(settings, appDataDir, owner.ownerProjectId)
  }
  if (owner?.ownerKind === 'canvas' && owner.ownerProjectId) {
    return resolveCanvasProjectRoot(settings, appDataDir, owner.ownerProjectId)
  }
  return resolveCanvasProjectRoot(settings, appDataDir, canvasProjectId)
}

/**
 * 解析画布音频节点 mp3 的项目根目录。
 * 抽音产物 `voices/extract_*` 始终落在画布项目内；旧节点可能误标 workflow owner，需回退。
 */
export async function resolveCanvasAudioMediaProjectRoot(
  canvasProjectId: string,
  storedPath: string,
  owner?: Pick<CanvasMediaLocation, 'ownerKind' | 'ownerProjectId'>,
): Promise<string | undefined> {
  const path = normalizeStoredMediaPath(storedPath)
  const primaryRoot = await resolveCanvasMediaProjectRoot(canvasProjectId, owner)
  if (!path || !isProjectVoiceExtractRelativePath(path)) {
    return primaryRoot
  }

  const canvasProjectIdTrimmed = String(canvasProjectId || '').trim()
  if (!canvasProjectIdTrimmed) return primaryRoot

  const usesCanvasOwner =
    owner?.ownerKind === 'canvas' && owner.ownerProjectId === canvasProjectIdTrimmed
  if (usesCanvasOwner) return primaryRoot

  return resolveCanvasMediaProjectRoot(canvasProjectId, {
    ownerKind: 'canvas',
    ownerProjectId: canvasProjectIdTrimmed,
  })
}
