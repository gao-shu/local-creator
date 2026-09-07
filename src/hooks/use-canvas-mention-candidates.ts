// Copyright (c) local-creator contributors. All rights reserved.

import { useEffect, useMemo, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { buildCanvasMentionCandidates } from '@/lib/canvas/canvas-mention-utils'
import { listVoiceLibraryEntries } from '@/lib/voice/voice-library-service'
import type { MentionCandidate } from '@/lib/workflow/mention-utils'
import type { VoiceLibraryEntry } from '@/types/voice-library'

/** 画布 @ 引用候选（含项目音色库解析后的音色节点） */
export function useCanvasMentionCandidates(
  nodes: Node[],
  projectId: string,
  excludeNodeId?: string,
  edges: Edge[] = [],
): MentionCandidate[] {
  const [voiceLibrary, setVoiceLibrary] = useState<VoiceLibraryEntry[]>([])

  useEffect(() => {
    let active = true
    void listVoiceLibraryEntries().then((items) => {
      if (active) setVoiceLibrary(items)
    })
    return () => {
      active = false
    }
  }, [])

  return useMemo(
    () =>
      buildCanvasMentionCandidates(nodes, voiceLibrary, edges).filter(
        (item) => item.canvasNodeId !== excludeNodeId,
      ),
    [edges, excludeNodeId, nodes, voiceLibrary],
  )
}
