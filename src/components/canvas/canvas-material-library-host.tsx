// Copyright (c) local-creator contributors. All rights reserved.

import { useMemo } from 'react'
import { MaterialLibraryPickerDialog } from '@/components/workshop/material-library-picker-dialog'
import {
  collectCanvasMaterialLibraryKeys,
  type CanvasMaterialLibraryRequest,
} from '@/lib/canvas/canvas-material-import'
import type { MaterialLibraryItem } from '@/lib/materials/material-library-service'
import type { Node } from '@xyflow/react'

interface CanvasMaterialLibraryHostProps {
  open: boolean
  request: CanvasMaterialLibraryRequest | null
  nodes: Node[]
  onClose: () => void
  onConfirm: (items: MaterialLibraryItem[]) => Promise<void>
}

export function CanvasMaterialLibraryHost({
  open,
  request,
  nodes,
  onClose,
  onConfirm,
}: CanvasMaterialLibraryHostProps) {
  const existingCanvasEntryKeys = useMemo(() => collectCanvasMaterialLibraryKeys(nodes), [nodes])
  const isPickMode = request?.intent.type === 'pick'

  return (
    <MaterialLibraryPickerDialog
      open={open}
      mode="canvas"
      defaultKind={request?.defaultKind ?? 'character'}
      currentProjectId=""
      existingCanvasEntryKeys={existingCanvasEntryKeys}
      allowReuseOnCanvas={isPickMode}
      selectionLimit={isPickMode ? 1 : undefined}
      confirmLabel={isPickMode ? '使用' : undefined}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}
