// Copyright (c) local-creator contributors. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ProjectCard } from '@/components/workshop/project-card'
import { ProjectRecycleBinView } from '@/components/project-recycle-bin-view'
import {
  listDeletedWorkflowProjects,
  purgeWorkflowProject,
  restoreWorkflowProject,
} from '@/lib/storage/workflow-service'
import { readSettings } from '@/lib/storage/settings-service'
import { resolveProjectCardPreviews } from '@/lib/workflow/project-cover-utils'
import type { WorkflowProjectMeta } from '@/types/workflow'

export function WorkshopRecycleBinPage() {
  const [items, setItems] = useState<WorkflowProjectMeta[]>([])
  const [previewMap, setPreviewMap] = useState<Record<string, string[]>>({})

  const listDeleted = useCallback(async () => {
    const next = await listDeletedWorkflowProjects()
    setItems(next)
    return next
  }, [])

  const visibleIds = useMemo(() => items.map((p) => p.id).join(','), [items])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!items.length) {
        setPreviewMap({})
        return
      }
      const settingsRes = await readSettings()
      const entries = await Promise.all(
        items.map(async (project) => {
          try {
            const { urls } = await resolveProjectCardPreviews(project, {
              settings: settingsRes.data,
              appDataDir: settingsRes.appDataDir,
            })
            return [project.id, urls] as const
          } catch {
            return [project.id, []] as const
          }
        }),
      )
      if (!cancelled) setPreviewMap(Object.fromEntries(entries))
    })()
    return () => {
      cancelled = true
    }
  }, [visibleIds, items])

  return (
    <ProjectRecycleBinView
      kindLabel="项目"
      subtitle="已删除的创作项目可在此恢复或彻底清除"
      searchPlaceholder="搜索项目名称或描述..."
      testIdPrefix="workshop-recycle"
      gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      listDeleted={listDeleted}
      restoreProject={restoreWorkflowProject}
      purgeProject={purgeWorkflowProject}
      renderCard={(project, { busy, onRestore, onPurge }) => (
        <ProjectCard
          key={project.id}
          project={project}
          mode="recycle"
          busy={busy}
          previewUrls={previewMap[project.id]}
          onOpen={() => {}}
          onRestore={onRestore}
          onPurge={onPurge}
        />
      )}
    />
  )
}
