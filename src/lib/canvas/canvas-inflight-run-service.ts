// Copyright (c) Haode AI. All rights reserved.

export interface CanvasInflightRun {
  projectId: string
  nodeId: string
  promise: Promise<boolean>
}

const inflightByKey = new Map<string, CanvasInflightRun>()

function inflightKey(projectId: string, nodeId: string): string {
  return `${projectId}:${nodeId}`
}

export function registerCanvasInflightRun(session: CanvasInflightRun): void {
  const key = inflightKey(session.projectId, session.nodeId)
  inflightByKey.set(key, session)
  void session.promise.finally(() => {
    if (inflightByKey.get(key)?.promise === session.promise) {
      inflightByKey.delete(key)
    }
  })
}

export function getCanvasInflightRun(
  projectId: string,
  nodeId: string,
): CanvasInflightRun | undefined {
  return inflightByKey.get(inflightKey(projectId, nodeId))
}

export function listCanvasInflightRuns(projectId: string): CanvasInflightRun[] {
  return [...inflightByKey.values()].filter((item) => item.projectId === projectId)
}

export function listAllCanvasInflightRuns(): CanvasInflightRun[] {
  return [...inflightByKey.values()]
}

export function hasCanvasInflightRun(projectId: string, nodeId: string): boolean {
  return inflightByKey.has(inflightKey(projectId, nodeId))
}

export function cancelCanvasInflightRun(projectId: string, nodeId: string): boolean {
  const key = inflightKey(projectId, nodeId)
  if (!inflightByKey.has(key)) return false
  inflightByKey.delete(key)
  return true
}
