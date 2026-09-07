// Copyright (c) Haode AI. All rights reserved.

import { useCallback } from 'react'
import { CanvasProjectCard } from '@/components/canvas/canvas-project-card'
import { ProjectRecycleBinView } from '@/components/project-recycle-bin-view'
import {
  listDeletedCanvasProjects,
  purgeCanvasProject,
  restoreCanvasProject,
} from '@/lib/storage/canvas-service'

export function CanvasRecycleBinPage() {
  const listDeleted = useCallback(() => listDeletedCanvasProjects(), [])

  return (
    <ProjectRecycleBinView
      kindLabel="画布"
      subtitle="已删除的画布项目可在此恢复或彻底清除"
      searchPlaceholder="搜索画布项目..."
      testIdPrefix="canvas-recycle"
      gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
      listDeleted={listDeleted}
      restoreProject={restoreCanvasProject}
      purgeProject={purgeCanvasProject}
      renderCard={(project, { busy, onRestore, onPurge }) => (
        <CanvasProjectCard
          key={project.id}
          project={project}
          mode="recycle"
          busy={busy}
          onOpen={() => {}}
          onRestore={onRestore}
          onPurge={onPurge}
        />
      )}
    />
  )
}
