// Copyright (c) local-creator contributors. All rights reserved.

export type ProjectKind = 'workflow' | 'canvas'

export interface SoftDeletedProjectRef {
  projectId: string
  kind: ProjectKind
  deletedAt: number
}

/** 回收站超过该天数提示可清理（首版不自动删除） */
export const RECYCLE_BIN_STALE_DAYS = 30
export const RECYCLE_BIN_STALE_MS = RECYCLE_BIN_STALE_DAYS * 24 * 60 * 60 * 1000

export function isProjectSoftDeleted(meta: { deletedAt?: number }): boolean {
  return typeof meta.deletedAt === 'number' && meta.deletedAt > 0
}

export function filterActiveProjects<T extends { deletedAt?: number }>(projects: T[]): T[] {
  return projects.filter((project) => !isProjectSoftDeleted(project))
}

export function filterSoftDeletedProjects<T extends { deletedAt?: number }>(projects: T[]): T[] {
  return projects.filter((project) => isProjectSoftDeleted(project))
}

export function isRecycleBinItemStale(deletedAt: number, now = Date.now()): boolean {
  return typeof deletedAt === 'number' && deletedAt > 0 && now - deletedAt >= RECYCLE_BIN_STALE_MS
}

export function countStaleRecycleBinItems(
  projects: ReadonlyArray<{ deletedAt?: number }>,
  now = Date.now(),
): number {
  return projects.filter(
    (project) => isProjectSoftDeleted(project) && isRecycleBinItemStale(project.deletedAt!, now),
  ).length
}

/** 恢复时去掉 deletedAt，避免索引残留无效字段 */
export function stripProjectDeletedAt<T extends { deletedAt?: number }>(
  project: T,
): Omit<T, 'deletedAt'> {
  const { deletedAt: _deletedAt, ...rest } = project
  return rest
}

export function sortRecycleBinProjectsByDeletedAtDesc<T extends { deletedAt?: number }>(
  projects: T[],
): T[] {
  return [...projects].sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
}

/** 从项目索引条目中收集软删除项目 ID */
export function collectSoftDeletedProjectIds(
  projects: ReadonlyArray<{ id?: string; deletedAt?: number }>,
): Set<string> {
  const ids = new Set<string>()
  for (const project of projects) {
    const id = String(project.id || '').trim()
    if (!id || !isProjectSoftDeleted(project)) continue
    ids.add(id)
  }
  return ids
}

/** 合并工坊 + 画布索引，返回软删除项目 ID 集合 */
export function collectSoftDeletedProjectIdsFromIndexes(
  workflowProjects: ReadonlyArray<{ id?: string; deletedAt?: number }>,
  canvasProjects: ReadonlyArray<{ id?: string; deletedAt?: number }>,
): Set<string> {
  const ids = collectSoftDeletedProjectIds(workflowProjects)
  for (const id of collectSoftDeletedProjectIds(canvasProjects)) {
    ids.add(id)
  }
  return ids
}

/** 带来源类型的软删除项目明细（供日志或调试） */
export function collectSoftDeletedProjectRefs(
  workflowProjects: ReadonlyArray<{ id?: string; deletedAt?: number }>,
  canvasProjects: ReadonlyArray<{ id?: string; deletedAt?: number }>,
): SoftDeletedProjectRef[] {
  const refs: SoftDeletedProjectRef[] = []

  for (const project of workflowProjects) {
    const projectId = String(project.id || '').trim()
    if (!projectId || !isProjectSoftDeleted(project)) continue
    refs.push({ projectId, kind: 'workflow', deletedAt: project.deletedAt! })
  }

  for (const project of canvasProjects) {
    const projectId = String(project.id || '').trim()
    if (!projectId || !isProjectSoftDeleted(project)) continue
    refs.push({ projectId, kind: 'canvas', deletedAt: project.deletedAt! })
  }

  return refs
}
