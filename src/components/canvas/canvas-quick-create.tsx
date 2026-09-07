// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CreateProjectDialog,
  type CreateProjectSubmitPayload,
} from '@/components/workshop/create-project-dialog'
import { ensureDataRootConfigured } from '@/lib/storage/data-root-guard'
import { useCanvasProjectStore } from '@/stores/canvas-project-store'

/** 首页 / 总览：快速新建画布项目（替代原画布列表页入口） */
export function useCanvasQuickCreate() {
  const navigate = useNavigate()
  const create = useCanvasProjectStore((state) => state.create)
  const [open, setOpen] = useState(false)

  const openCreate = useCallback(async () => {
    if (!(await ensureDataRootConfigured())) return
    setOpen(true)
  }, [])

  const handleSubmit = useCallback(
    async (payload: CreateProjectSubmitPayload) => {
      const project = await create(payload.title, payload.description)
      if (project) {
        navigate(`/canvas/${project.id}`)
      }
    },
    [create, navigate],
  )

  const dialog = (
    <CreateProjectDialog
      open={open}
      onClose={() => setOpen(false)}
      onSubmit={handleSubmit}
      dialogTitle="新建画布"
      submitLabel="创建画布"
      testIdPrefix="canvas-create"
    />
  )

  return { openCreate, dialog }
}
