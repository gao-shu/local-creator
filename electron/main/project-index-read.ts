// Copyright (c) local-creator contributors. All rights reserved.

import type { CanvasProjectMeta } from '../../src/types/canvas'
import type { WorkflowProjectMeta } from '../../src/types/workflow'
import {
  collectSoftDeletedProjectIdsFromIndexes,
  collectSoftDeletedProjectRefs,
  type SoftDeletedProjectRef,
} from '../../src/lib/storage/project-soft-delete'
import { resolveCanvasRoot, readCanvasProjectsIndex } from './ipc-canvas'
import { resolveWorkflowRoot, readWorkflowProjectsIndex } from './ipc-workflow'

/** 读取工坊 projects.json（含软删除条目，不过滤） */
export async function readAllWorkflowProjects(): Promise<WorkflowProjectMeta[]> {
  const root = await resolveWorkflowRoot()
  return readWorkflowProjectsIndex(root)
}

/** 读取画布 projects.json（含软删除条目，不过滤） */
export async function readAllCanvasProjects(): Promise<CanvasProjectMeta[]> {
  const root = await resolveCanvasRoot()
  return readCanvasProjectsIndex(root)
}

/** 合并读取工坊 + 画布索引中的软删除项目 ID */
export async function readSoftDeletedProjectIds(): Promise<Set<string>> {
  const [workflowProjects, canvasProjects] = await Promise.all([
    readAllWorkflowProjects(),
    readAllCanvasProjects(),
  ])
  return collectSoftDeletedProjectIdsFromIndexes(workflowProjects, canvasProjects)
}

/** 带来源类型的软删除项目明细 */
export async function readSoftDeletedProjectRefs(): Promise<SoftDeletedProjectRef[]> {
  const [workflowProjects, canvasProjects] = await Promise.all([
    readAllWorkflowProjects(),
    readAllCanvasProjects(),
  ])
  return collectSoftDeletedProjectRefs(workflowProjects, canvasProjects)
}
