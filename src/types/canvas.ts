// Copyright (c) Haode AI. All rights reserved.

import type { Edge, Node, Viewport } from '@xyflow/react'

export interface CanvasProjectMeta {
  id: string
  title: string
  description: string
  coverImagePath?: string
  /** 用户手动设置的封面，开启后不再随节点图自动更新 */
  coverManual?: boolean
  createdAt: number
  updatedAt: number
  /** 软删除时间戳；有值则不在列表展示，项目目录与数据保留 */
  deletedAt?: number
  /** 从磁盘扫描恢复（如画镜旧数据） */
  recovered?: boolean
}

/** 画布项目级 settings（随 data.json 持久化；当前无用户可配项） */
export type CanvasProjectSettings = Record<string, never>

export interface CanvasProjectData {
  version: 1
  nodes: Node[]
  edges: Edge[]
  viewport: Viewport
  settings?: CanvasProjectSettings
}

export interface CanvasListResult {
  success: boolean
  projects: CanvasProjectMeta[]
  error?: string
}

export interface CanvasCreateResult {
  success: boolean
  project?: CanvasProjectMeta
  error?: string
}

export interface CanvasDeleteResult {
  success: boolean
  error?: string
}

export interface CanvasReadDataResult {
  success: boolean
  data?: CanvasProjectData
  error?: string
}

export interface CanvasWriteDataResult {
  success: boolean
  error?: string
}

export interface CanvasUpdateProjectResult {
  success: boolean
  project?: CanvasProjectMeta
  error?: string
}

export function createEmptyCanvasData(): CanvasProjectData {
  return {
    version: 1,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 0.9 },
  }
}
