// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CreateProjectDialog,
  type CreateProjectSubmitPayload,
} from '@/components/workshop/create-project-dialog'
import { ensureDataRootConfigured } from '@/lib/storage/data-root-guard'
import { normalizeWorkflowStep } from '@/lib/workflow/step-utils'
import { useWorkflowProjectStore } from '@/stores/workflow-project-store'

/** 首页 / 总览：快速新建工坊项目（替代原项目列表页入口） */
export function useWorkshopQuickCreate() {
  const navigate = useNavigate()
  const create = useWorkflowProjectStore((state) => state.create)
  const [open, setOpen] = useState(false)

  const openCreate = useCallback(async () => {
    if (!(await ensureDataRootConfigured())) return
    setOpen(true)
  }, [])

  const handleSubmit = useCallback(
    async (payload: CreateProjectSubmitPayload) => {
      const project = await create(payload.title, payload.description)
      if (project) {
        navigate(
          `/workshop/${project.id}/step/${normalizeWorkflowStep(project.currentStep)}`,
        )
      }
    },
    [create, navigate],
  )

  const dialog = (
    <CreateProjectDialog
      open={open}
      onClose={() => setOpen(false)}
      onSubmit={handleSubmit}
    />
  )

  return { openCreate, dialog }
}
