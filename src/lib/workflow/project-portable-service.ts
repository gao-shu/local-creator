// Copyright (c) Haode AI. All rights reserved.

export interface ProjectPortableResult {
  success: boolean
  canceled?: boolean
  projectId?: string
  targetDir?: string
  error?: string
}

export async function exportWorkflowProject(projectId: string): Promise<ProjectPortableResult> {
  const id = String(projectId || '').trim()
  if (!id) return { success: false, error: '项目 ID 无效' }
  if (!window.workflowAPI?.exportProject) {
    return { success: false, error: '导出仅在桌面客户端可用' }
  }
  const res = await window.workflowAPI.exportProject(id)
  return res
}

export async function importWorkflowProject(): Promise<ProjectPortableResult> {
  if (!window.workflowAPI?.importProject) {
    return { success: false, error: '导入仅在桌面客户端可用' }
  }
  const res = await window.workflowAPI.importProject()
  return res
}
