// Copyright (c) Haode AI. All rights reserved.

import {
  normalizeImageGenerationTierParams,
  resolveAssetImageTierPrefs,
  type ImageGenerationTierParams,
} from '@/lib/models/image-generation-tier-params'
import { saveCanvasImageNodeToMaterialLibrary, isCanvasImageNodeSyncedToMaterialLibraryAsync } from '@/lib/canvas/canvas-image-material-save'
import { materialLibrarySyncSuccessMessage } from '@/lib/materials/material-library-service'
import {
  compressImageDataUrlToMaxBytes,
  formatImageByteSize,
  resolveCanvasImageCompressTargetBytes,
} from '@/lib/canvas/canvas-image-compress'
import {
  CANVAS_IMAGE_ROLE_COLORS,
  CANVAS_IMAGE_ROLE_MENTION_LABELS,
  resolveCanvasAssetNameWhenMarkingRole,
  resolveCanvasImageDisplayName,
  stripCanvasRolePrefixFromName,
} from '@/lib/canvas/canvas-image-role'
import { readSettings } from '@/lib/storage/settings-service'
import {
  isCanvasAssetImageNode,
  reviewPatchForCanvasImageNode,
} from '@/lib/canvas/canvas-image-character'
import { cn } from '@/lib/utils'
import {
  CANVAS_NODE_COMPACT_SELECT,
  CANVAS_NODE_CONSOLE,
  CANVAS_NODE_SUBTEXT,
} from '@/lib/canvas/canvas-node-theme'
import {
  CANVAS_MEDIA_NODE_HEADER_ROW_CLASS,
  CANVAS_MEDIA_NODE_PREVIEW_SQUARE_STYLE,
  CanvasMediaNodeImageEmptyState,
  CanvasMediaNodeMissingOverlay,
  CanvasMediaNodeTypeLabel,
  canvasMediaNodePreviewClassName,
} from '@/components/canvas/nodes/canvas-media-node-chrome'

import {
  CANVAS_NODE_BOTTOM_CONSOLE_ANCHOR_STYLE,
  CANVAS_NODE_CONSOLE_WIDTH,
  CANVAS_NODE_TOP_TOOLBAR_ANCHOR_STYLE,
} from '@/lib/canvas/canvas-console-layout'
import {
  CANVAS_IMAGE_PREVIEW_RIGHT_X,
  CANVAS_IMAGE_PREVIEW_WIDTH_PX,
  resolveCanvasImageShellLayout,
} from '@/lib/canvas/canvas-image-node-layout'

import { mapCanvasAssetRoleToKind } from '@/lib/canvas/canvas-image-generate-prompt'
import { getLayoutPresetsForKind, resolveProjectAssetLayoutKey } from '@/lib/workflow/layout-presets'
import { CanvasImageEditDialog } from '@/components/canvas/modals/canvas-image-edit-dialog'

function CanvasImageNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as CanvasImageNodeData
  const {
    projectId,
    nodes,
    edges,
    updateNodeData,
    runNode,
    stopNode,
    isNodeRunning,
    imageConsoleNodeId,
    openImageConsole,
    closeImageConsole,
    addCanvasNode,
    duplicateNode,
    deleteNode,
    flushPersist,
    agentPanelOpen,
    agentReferenceEnabled,
    toggleAgentReference,
  } = useCanvasEditor()
  const settings = useSettingsStore((state) => state.settings)
  const [contextMenuAnchor, setContextMenuAnchor] = useState<CanvasImageContextMenuAnchor | null>(
    null,
  )
  const [compressing, setCompressing] = useState(false)
  const [savingMaterial, setSavingMaterial] = useState(false)
  const [syncedToMaterialLibrary, setSyncedToMaterialLibrary] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOverEmpty, setDragOverEmpty] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [autoMentionEnabled, setAutoMentionEnabled] = useState(readCanvasImageAutoMentionEnabled)
  const prevPreviewRef = useRef('')
  const wasGeneratingRef = useRef(false)
  const { src: previewSrc, mediaMissing } = useCanvasImagePreview(
    nodeData.outputPath,
    projectId,
    nodeData.outputOwnerKind,
    nodeData.outputOwnerProjectId,
  )
  const { frameStyle, onImageLoad } = useAdaptiveImageFrame(previewSrc)
  const running = isNodeRunning(id) || nodeData.status === 'running'
  const hasImageFile = Boolean(String(nodeData.outputPath || '').trim())
  const hasImage = Boolean(previewSrc)
  const showMissingOverlay = hasImageFile && mediaMissing && !running
  const consoleOpen = imageConsoleNodeId === id
  const showConsole = consoleOpen
  const nodeRootRef = useCanvasConsoleDismissOnOutsidePointerDown(showConsole, closeImageConsole, id)
  const assetRole = nodeData.assetRole ?? 'character'
  const assetRoleConverted = Boolean(nodeData.assetRoleConverted)

  useEffect(() => {
    let cancelled = false
    if (!assetRoleConverted || !hasImageFile) {
      setSyncedToMaterialLibrary(false)
      return () => {
        cancelled = true
      }
    }
    void isCanvasImageNodeSyncedToMaterialLibraryAsync({
      nodeId: id,
      projectId,
      role: assetRole,
    }).then((synced) => {
      if (!cancelled) setSyncedToMaterialLibrary(synced)
    })
    return () => {
      cancelled = true
    }
  }, [id, projectId, assetRole, assetRoleConverted, hasImageFile])
  const shellLayout = useMemo(() => resolveCanvasImageShellLayout(), [])

  useEffect(() => {
    if (running) wasGeneratingRef.current = true
  }, [running])

  useEffect(() => {
    if (!prevPreviewRef.current && previewSrc && wasGeneratingRef.current) {
      closeImageConsole()
      wasGeneratingRef.current = false
    }
    prevPreviewRef.current = previewSrc
  }, [previewSrc, closeImageConsole])

  const upstreamPrompt = useMemo(
    () => resolveMergedPrompt(id, nodes, edges, ''),
    [id, nodes, edges],
  )

  const handlePatch = useCallback(
    (patch: Partial<CanvasImageNodeData>) => {
      updateNodeData(id, reviewPatchForCanvasImageNode(nodeData, patch))
    },
    [id, nodeData, updateNodeData],
  )

  const getMergedModels = useSettingsStore((state) => state.getMergedModels)
  const rememberAssetImageModelId = useSettingsStore((state) => state.rememberLastUsedAssetImageModelId)
  const rememberAssetImageTierParams = useSettingsStore((state) => state.rememberLastUsedAssetImageTierParams)
  const rememberAssetImageSize = useSettingsStore((state) => state.rememberLastUsedAssetImageSize)
  const imageModels = getMergedModels('image')

  const modelOptions = buildModelSelectOptions(imageModels, 'image', { modelPickerOnly: true })

  const displayPrompt = nodeData.prompt || ''
  const mentionCandidates = useCanvasMentionCandidates(nodes, projectId, id, edges)
  const assetMentionCandidates = useMemo(
    () => filterCanvasAssetMentionCandidates(mentionCandidates),
    [mentionCandidates],
  )
  const referenceBarAssets = useMemo(
    () =>
      collectCanvasVideoReferenceBarAssets({
        videoNodeId: id,
        prompt: displayPrompt,
        nodes,
        edges,
        mentionCandidates,
        consoleReferenceImagePaths: nodeData.consoleReferenceImagePaths,
      }),
    [displayPrompt, edges, id, mentionCandidates, nodeData.consoleReferenceImagePaths, nodes],
  )
  const promptMentionAssets = useMemo(
    () =>
      collectCanvasVideoPromptMentionAssets({
        prompt: displayPrompt,
        mentionCandidates,
      }),
    [displayPrompt, mentionCandidates],
  )

  const applyAutoMention = useCallback(
    (rawPrompt: string, options?: { preserveWhitespace?: boolean }) => {
      if (!rawPrompt) {
        handlePatch({ prompt: rawPrompt })
        return rawPrompt
      }
      const { prompt: nextPrompt } = prepareCanvasVideoPromptContext(rawPrompt, nodes, {
        edges,
        preserveWhitespace: options?.preserveWhitespace,
        autoMentionEnabled: true,
      })
      handlePatch({ prompt: nextPrompt })
      return nextPrompt
    },
    [edges, handlePatch, nodes],
  )

  const handleAutoMentionChange = useCallback(
    (enabled: boolean) => {
      writeCanvasImageAutoMentionEnabled(enabled)
      setAutoMentionEnabled(enabled)
      if (!enabled) return
      applyAutoMention(displayPrompt || upstreamPrompt, { preserveWhitespace: true })
    },
    [applyAutoMention, displayPrompt, upstreamPrompt],
  )

  const handlePromptChange = useCallback(
    (value: string) => {
      if (autoMentionEnabled && !isTypingCanvasManualMention(value)) {
        applyAutoMention(value, { preserveWhitespace: true })
        return
      }
      handlePatch({ prompt: value })
    },
    [applyAutoMention, autoMentionEnabled, handlePatch],
  )

  // 打开控制台且描述为空时，用上游 Prompt 跑一遍自动@（对齐视频节点）
  useEffect(() => {
    if (!showConsole || !autoMentionEnabled) return
    if (displayPrompt.trim()) return
    if (!upstreamPrompt.trim()) return
    applyAutoMention(upstreamPrompt)
  }, [applyAutoMention, autoMentionEnabled, displayPrompt, showConsole, upstreamPrompt])

  const handleUploadConsoleReference = useCallback(async () => {
    try {
      const path = await pickCanvasLocalImage({
        projectId,
        nodeId: id,
        kind: 'reference',
      })
      if (!path) return
      const next = [...(nodeData.consoleReferenceImagePaths ?? []), path]
      handlePatch({ consoleReferenceImagePaths: next })
      toast.success('已添加参考图')
    } catch (error: unknown) {
      toast.error((error as Error).message || '参考图上传失败')
    }
  }, [handlePatch, id, nodeData.consoleReferenceImagePaths, projectId])

  const handleRemoveConsoleReference = useCallback(
    (index: number) => {
      const current = nodeData.consoleReferenceImagePaths ?? []
      const next = current.filter((_, itemIndex) => itemIndex !== index)
      handlePatch({
        consoleReferenceImagePaths: next.length ? next : undefined,
      })
    },
    [handlePatch, nodeData.consoleReferenceImagePaths],
  )

  const activeModelId = useMemo(
    () => resolveSoftwareImageModelId(settings, imageModels),
    [
      imageModels,
      settings?.lastUsedAssetImageModelId,
      settings?.lastUsedStoryboardImageModelId,
    ],
  )
  const activeModel = imageModels.find((model) => model.id === activeModelId)
  const imageTierParams = useMemo(
    () =>
      normalizeImageGenerationTierParams(
        activeModel,
        { resolution: nodeData.imageResolution, quality: nodeData.imageQuality },
        resolveAssetImageTierPrefs(settings),
      ),
    [activeModel, nodeData.imageQuality, nodeData.imageResolution, settings],
  )
  const imageCostEstimate = null
  const imageCostLoading = false
  const handleImageTierParamsChange = useCallback(
    (next: ImageGenerationTierParams) => {
      handlePatch({
        imageResolution: next.resolution ?? undefined,
        imageQuality: next.quality ?? undefined,
      })
      rememberAssetImageTierParams({
        resolution: next.resolution,
        quality: next.quality,
      })
    },
    [handlePatch, rememberAssetImageTierParams],
  )

  const handleImageSizeChange = useCallback(
    (value: string) => {
      handlePatch({ imageSize: value })
      rememberAssetImageSize(value)
    },
    [handlePatch, rememberAssetImageSize],
  )

  useEffect(() => {
    if (!activeModel) return
    const normalized = normalizeImageGenerationTierParams(
      activeModel,
      { resolution: nodeData.imageResolution, quality: nodeData.imageQuality },
      resolveAssetImageTierPrefs(settings),
    )
    if (
      normalized.resolution === (nodeData.imageResolution ?? null) &&
      normalized.quality === (nodeData.imageQuality ?? null)
    ) {
      return
    }
    handlePatch({
      imageResolution: normalized.resolution ?? undefined,
      imageQuality: normalized.quality ?? undefined,
    })
  }, [activeModelId])

  const imageSize = normalizeImageSizePreset(
    nodeData.imageSize || settings?.lastUsedAssetImageSize,
    DEFAULT_IMAGE_SIZE,
  )
  const sizeLabel = resolveImageSizeApiValue(imageSize).replace('x', '×')

  const compactSelectClass = cn(
    'h-6 w-auto max-w-none shrink-0 border-0 px-1 text-[11px] shadow-none',
    CANVAS_NODE_COMPACT_SELECT,
  )

  const openConsole = useCallback(() => {
    openImageConsole(id)
  }, [id, openImageConsole])

  const toggleConsoleFromImage = useCallback(() => {
    if (!hasImage) return
    if (showConsole) closeImageConsole()
    else openConsole()
  }, [hasImage, showConsole, closeImageConsole, openConsole])

  const handleImagePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    ;(event.currentTarget as HTMLDivElement & { __dragStart?: { x: number; y: number } }).__dragStart = {
      x: event.clientX,
      y: event.clientY,
    }
    if (running) return
    if (!event.ctrlKey && !event.metaKey) {
      event.stopPropagation()
    }
  }, [running])

  const handleImageClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (running) return
      const target = event.currentTarget as HTMLDivElement & {
        __dragStart?: { x: number; y: number }
      }
      const start = target.__dragStart
      if (start) {
        const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y)
        if (moved > 4) return
      }
      if (event.ctrlKey || event.metaKey) return
      if (agentPanelOpen && agentReferenceEnabled) {
        event.stopPropagation()
        toggleAgentReference(id)
        return
      }
      if (!hasImage) {
        event.stopPropagation()
        openConsole()
        return
      }
      event.stopPropagation()
      toggleConsoleFromImage()
    },
    [agentPanelOpen, agentReferenceEnabled, hasImage, id, openConsole, running, toggleAgentReference, toggleConsoleFromImage],
  )

  const applyUploadedImagePath = useCallback(
    (outputPath: string) => {
      handlePatch({
        outputPath,
        outputOwnerKind: 'canvas',
        outputOwnerProjectId: projectId,
        status: 'success',
        error: undefined,
      })
      toast.success('图片已上传')
    },
    [handlePatch, projectId],
  )

  const handleUploadImage = useCallback(async () => {
    if (uploading || running) return
    setUploading(true)
    try {
      const outputPath = await pickCanvasLocalImage({
        projectId,
        nodeId: id,
        kind: 'upload',
      })
      if (!outputPath) return
      applyUploadedImagePath(outputPath)
    } catch (error: unknown) {
      toast.error((error as Error).message || '上传图片失败')
    } finally {
      setUploading(false)
    }
  }, [uploading, running, projectId, id, applyUploadedImagePath])

  const handleEmptyPreviewDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (hasImage || running || uploading) return
      if (shouldSuppressCanvasFileDropFromNativeVideoDrag()) return
      if (!dataTransferMayContainCanvasMedia(event.dataTransfer)) return
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'copy'
      setDragOverEmpty(true)
    },
    [hasImage, running, uploading],
  )

  const handleEmptyPreviewDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    const related = event.relatedTarget
    if (related instanceof globalThis.Node && event.currentTarget.contains(related)) return
    setDragOverEmpty(false)
  }, [])

  useEffect(() => {
    if (!dragOverEmpty) return
    const clear = () => setDragOverEmpty(false)
    window.addEventListener('dragend', clear, true)
    window.addEventListener('drop', clear, true)
    return () => {
      window.removeEventListener('dragend', clear, true)
      window.removeEventListener('drop', clear, true)
    }
  }, [dragOverEmpty])

  const handleEmptyPreviewDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      if (hasImage || running || uploading) return
      if (shouldSuppressCanvasFileDropFromNativeVideoDrag()) {
        event.preventDefault()
        event.stopPropagation()
        setDragOverEmpty(false)
        endNativeVideoDragSession()
        window.dispatchEvent(new Event('canvas-clear-dragging-media'))
        return
      }
      if (!dataTransferMayContainCanvasMedia(event.dataTransfer)) return
      event.preventDefault()
      event.stopPropagation()
      setDragOverEmpty(false)
      // 通知画布清掉全屏紫色拖放框（节点 drop 会打断冒泡）
      window.dispatchEvent(new Event('canvas-clear-dragging-media'))

      const imageItem = collectCanvasDroppedMedia(event.dataTransfer).find((item) => item.kind === 'image')
      if (!imageItem) {
        toast.message('请拖入图片文件')
        return
      }

      setUploading(true)
      try {
        const settingsRes = await readSettings()
        const base = {
          settings: settingsRes.data,
          appDataDir: settingsRes.appDataDir,
          projectId,
          nodeId: id,
        }
        const outputPath = imageItem.localPath
          ? await saveCanvasUploadedImageFromFile({ ...base, sourcePath: imageItem.localPath })
          : await saveCanvasUploadedImageFromDataUrl({
              ...base,
              dataUrl: await readDroppedImageDataUrl(imageItem.file),
            })
        applyUploadedImagePath(outputPath)
      } catch (error: unknown) {
        toast.error((error as Error).message || '上传图片失败')
      } finally {
        setUploading(false)
      }
    },
    [hasImage, running, uploading, projectId, id, applyUploadedImagePath],
  )

  const handleDeleteImage = useCallback(() => {
    if (!hasImageFile) return
    handlePatch({
      outputPath: undefined,
      status: 'idle',
      error: undefined,
    })
    closeImageConsole()
    toast.success('已删除生成图')
  }, [hasImageFile, handlePatch, closeImageConsole])

  const handleConnectorAdd = useCanvasNodeQuickAdd(id, shellLayout.shellWidth)
  const updateNodeInternals = useUpdateNodeInternals()

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, showConsole, previewSrc, frameStyle, updateNodeInternals])

  const selfNode = useMemo(() => nodes.find((node) => node.id === id), [nodes, id])

  const imageDisplayName = useMemo(
    () =>
      resolveCanvasImageDisplayName({
        assetRole: nodeData.assetRole,
        importShotNumber: nodeData.importShotNumber,
        imageName: nodeData.imageName,
        assetRoleConverted: nodeData.assetRoleConverted,
      }),
    [
      nodeData.assetRole,
      nodeData.importShotNumber,
      nodeData.imageName,
      nodeData.assetRoleConverted,
    ],
  )

  const imageNamePlaceholder = imageDisplayName.rolePrefix
    ? nodeData.assetRole === 'scene'
      ? '场景名称'
      : nodeData.assetRole === 'item'
        ? '物品名称'
        : '角色昵称'
    : '图片名称'

  const handleAssetRoleChange = useCallback(
    (role: CanvasImageAssetRole) => {
      if (!role) return

      const selfData = nodes.find((node) => node.id === id)?.data as CanvasImageNodeData | undefined
      const currentAssetRole = selfData?.assetRole ?? nodeData.assetRole
      const currentConverted = Boolean(selfData?.assetRoleConverted ?? nodeData.assetRoleConverted)
      const currentImageName = String(selfData?.imageName ?? nodeData.imageName ?? '').trim()

      if (role === currentAssetRole && currentConverted) return

      const existingNames = nodes
        .filter((node) => node.type === CANVAS_NODE_TYPES.imageNode && node.id !== id)
        .map((node) => String((node.data as CanvasImageNodeData).imageName || '').trim())
        .filter(Boolean)
      const nextName = resolveCanvasAssetNameWhenMarkingRole(
        currentImageName,
        role,
        existingNames,
        {
          previousRole: currentAssetRole,
          wasConverted: currentConverted,
        },
      )

      const nextKind = mapCanvasAssetRoleToKind(role)
      const validLayoutKeys = new Set(
        getLayoutPresetsForKind(nextKind, settings).map((item) => item.key),
      )
      const nextLayoutKey =
        (selfData?.layoutKey ?? nodeData.layoutKey) && validLayoutKeys.has(selfData?.layoutKey ?? nodeData.layoutKey ?? '')
          ? (selfData?.layoutKey ?? nodeData.layoutKey)
          : resolveProjectAssetLayoutKey(undefined, nextKind, settings?.defaultAssetLayoutKeys)

      handlePatch({
        assetRole: role,
        assetRoleConverted: true,
        assetRoleOrigin: selfData?.assetRoleOrigin ?? nodeData.assetRoleOrigin ?? currentAssetRole ?? 'character',
        imageName: nextName,
        layoutKey: nextLayoutKey,
      })
      toast.success(`已转为 @${CANVAS_IMAGE_ROLE_MENTION_LABELS[role]}：${CANVAS_IMAGE_ROLE_MENTION_LABELS[role]} ${nextName}`)
      // 标记为人物/场景/道具后收起控制台与顶部工具栏
      closeImageConsole()
    },
    [
      closeImageConsole,
      handlePatch,
      id,
      nodeData.assetRole,
      nodeData.assetRoleConverted,
      nodeData.assetRoleOrigin,
      nodeData.imageName,
      nodeData.layoutKey,
      nodes,
      settings,
    ],
  )

  const handleCancelAssetRoleConversion = useCallback(() => {
    handlePatch({
      assetRole: nodeData.assetRoleOrigin ?? nodeData.assetRole ?? 'character',
      assetRoleConverted: false,
    })
  }, [handlePatch, nodeData.assetRole, nodeData.assetRoleOrigin])

  const handleSaveToMaterialLibrary = useCallback(async () => {
    if (savingMaterial) return
    if (!assetRoleConverted) {
      toast.error('请先标记为人物/场景/道具后再保存到素材库')
      return
    }
    const wasSynced = syncedToMaterialLibrary
    try {
      setSavingMaterial(true)
      const settingsRes = await readSettings()
      let projectTitle = projectId
      try {
        const meta = await getCanvasProject(projectId)
        if (meta.title?.trim()) projectTitle = meta.title.trim()
      } catch {
        // 标题读取失败时退回 projectId
      }
      await saveCanvasImageNodeToMaterialLibrary({
        nodeId: id,
        data: nodeData,
        projectId,
        projectTitle,
        settings: settingsRes.data,
        appDataDir: settingsRes.appDataDir,
      })
      setSyncedToMaterialLibrary(true)
      const displayName = resolveCanvasImageDisplayName({
        assetRole,
        imageName: nodeData.imageName,
        assetRoleConverted: true,
        importShotNumber: nodeData.importShotNumber,
      })
      const name =
        displayName.nickname === '未命名' ? `画布素材_${id.slice(-6)}` : displayName.label
      toast.success(materialLibrarySyncSuccessMessage(name, wasSynced))
    } catch (error: unknown) {
      toast.error((error as Error).message || '同步到素材库失败')
    } finally {
      setSavingMaterial(false)
    }
  }, [id, nodeData, projectId, savingMaterial, syncedToMaterialLibrary, assetRole])

  const handleCompressImage = useCallback(async () => {
    if (!previewSrc || compressing || running || uploading) return
    const targetBytes = resolveCanvasImageCompressTargetBytes()
    try {
      setCompressing(true)
      const result = await compressImageDataUrlToMaxBytes(previewSrc, targetBytes)
      if (!result.compressed) {
        toast.message(`当前约 ${formatImageByteSize(result.beforeBytes)}，已低于 5MB，无需压缩`)
        return
      }
      const settingsRes = await readSettings()
      const outputPath = await saveCanvasUploadedImageFromDataUrl({
        settings: settingsRes.data,
        appDataDir: settingsRes.appDataDir,
        projectId,
        nodeId: id,
        dataUrl: result.dataUrl,
      })
      handlePatch({
        outputPath,
        outputOwnerKind: 'canvas',
        outputOwnerProjectId: projectId,
        status: 'success',
        error: undefined,
      })
      flushPersist()
      toast.success(
        `已压缩：${formatImageByteSize(result.beforeBytes)} → ${formatImageByteSize(result.afterBytes)}`,
      )
    } catch (error: unknown) {
      toast.error((error as Error).message || '图片压缩失败')
    } finally {
      setCompressing(false)
    }
  }, [
    compressing,
    flushPersist,
    handlePatch,
    id,
    previewSrc,
    projectId,
    running,
    uploading,
  ])

  const handleSaveImageName = useCallback(
    (name: string) => {
      let next = name.trim()
      if (nodeData.assetRoleConverted && nodeData.assetRole) {
        next = stripCanvasRolePrefixFromName(next, nodeData.assetRole)
      }
      handlePatch({ imageName: next || undefined })
    },
    [handlePatch, nodeData.assetRole, nodeData.assetRoleConverted],
  )

  const handleEditImage = useCallback(() => {
    if (!nodeData.outputPath) {
      toast.message('请先生成或上传图片')
      return
    }
    if (running) {
      toast.message('生成进行中，请稍后再编辑')
      return
    }
    if (mediaMissing) {
      toast.message('图片文件已丢失，无法编辑')
      return
    }
    setEditDialogOpen(true)
  }, [mediaMissing, nodeData.outputPath, running])

  const handleEditSaved = useCallback(
    (newOutputPath: string) => {
      handlePatch({
        outputPath: newOutputPath,
        outputOwnerKind: 'canvas',
        outputOwnerProjectId: projectId,
        status: 'success',
        error: undefined,
      })
      flushPersist()
    },
    [flushPersist, handlePatch, projectId],
  )

  const addConnectedModule = useCallback(
    (type: string, extraData?: Record<string, unknown>, positionOffsetY = 160) => {
      const baseX = (selfNode?.position.x ?? 0) + CANVAS_IMAGE_PREVIEW_RIGHT_X + 72
      const baseY = (selfNode?.position.y ?? 0) + positionOffsetY
      addCanvasNode(
        type,
        { x: baseX, y: baseY },
        {
          direction: 'source',
          nodeId: id,
          handleId: 'right',
        },
        extraData,
      )
    },
    [addCanvasNode, id, selfNode?.position.x, selfNode?.position.y],
  )

  const handleContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenuAnchor({ x: event.clientX, y: event.clientY })
  }, [])

  return (
    <div
      ref={nodeRootRef}
      data-testid={`canvas-node-${id}`}
      data-image-busy={running ? 'true' : 'false'}
      className="relative overflow-visible"
      style={{ width: shellLayout.shellWidth }}
      onContextMenu={handleContextMenu}
    >
      <CanvasImageContextMenu
        anchor={contextMenuAnchor}
        onClose={() => setContextMenuAnchor(null)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
        onAddImageRole={(role) =>
          addConnectedModule(CANVAS_NODE_TYPES.imageNode, { assetRole: role })
        }
        onAddVideo={() => addConnectedModule(CANVAS_NODE_TYPES.storyVideo)}
        onAddVoice={() =>
          addConnectedModule(CANVAS_NODE_TYPES.voiceNode, undefined, 340)
        }
      />

      {/* 标题区：图标 + 名称；分辨率在右上（不在预览图内） */}
      <div
        className={CANVAS_MEDIA_NODE_HEADER_ROW_CLASS}
        style={{ width: shellLayout.previewWidth }}
      >
        <CanvasMediaNodeTypeLabel icon={ImageIcon} iconTitle="图片" />
        {!showConsole ? (
          <>
            <CanvasImageNameEditor
              value={imageDisplayName.nickname}
              fixedPrefix={imageDisplayName.rolePrefix}
              fixedPrefixColorClass={imageDisplayName.colorClass}
              colorClass={imageDisplayName.colorClass}
              onSave={handleSaveImageName}
              placement="above"
              placeholder={imageNamePlaceholder}
              className="min-w-0 flex-1 justify-start"
            />
            {hasImage ? (
              <span className="ml-auto shrink-0 text-[11px] leading-none text-muted-foreground/70 dark:text-white/35">
                {sizeLabel}
              </span>
            ) : null}
          </>
        ) : null}
      </div>

      {/* 图片本体：位置/大小固定，不随控制台展开变化 */}
      <div className="relative z-0" style={{ width: shellLayout.previewWidth }}>
        {showConsole ? (
          <div
            className="nodrag nopan pointer-events-none absolute z-40"
            style={{
              width: CANVAS_NODE_CONSOLE_WIDTH,
              ...CANVAS_NODE_TOP_TOOLBAR_ANCHOR_STYLE,
            }}
          >
            <div className="pointer-events-auto" data-testid={`canvas-node-${id}-image-toolbar`}>
            <CanvasImageTopToolbar
              nodeId={id}
              hasImage={hasImageFile}
              previewSrc={previewSrc}
              assetRole={nodeData.assetRole ?? 'character'}
              assetRoleConverted={Boolean(nodeData.assetRoleConverted)}
              running={running}
              uploading={uploading}
              compressing={compressing}
              onUpload={() => void handleUploadImage()}
              onDelete={handleDeleteImage}
              onAssetRoleChange={handleAssetRoleChange}
              onCancelAssetRoleConversion={handleCancelAssetRoleConversion}
              onEditImage={handleEditImage}
              onCompressImage={() => void handleCompressImage()}
              onSaveToMaterialLibrary={() => void handleSaveToMaterialLibrary()}
              savingMaterial={savingMaterial}
              syncedToMaterialLibrary={syncedToMaterialLibrary}
            />
            </div>
          </div>
        ) : null}
        <div
          role="button"
          tabIndex={0}
          data-testid={`canvas-node-${id}-preview`}
          onClick={handleImageClick}
          onPointerDown={handleImagePointerDown}
          onDragEnter={handleEmptyPreviewDragOver}
          onDragOver={handleEmptyPreviewDragOver}
          onDragLeave={handleEmptyPreviewDragLeave}
          onDrop={(event) => void handleEmptyPreviewDrop(event)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              if (!hasImage) openConsole()
              else toggleConsoleFromImage()
            }
          }}
          className={cn(
            canvasMediaNodePreviewClassName(selected),
            'transition-[box-shadow,ring-color] duration-300',
            running &&
              'ring-2 ring-amber-400/50 shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_0_28px_rgba(251,191,36,0.18)]',
          )}
          style={previewSrc ? frameStyle : CANVAS_MEDIA_NODE_PREVIEW_SQUARE_STYLE}
        >
          {previewSrc ? (
            <img
              src={previewSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
              draggable={false}
              onLoad={onImageLoad}
            />
          ) : (
            <CanvasMediaNodeImageEmptyState
              uploading={uploading}
              dragActive={dragOverEmpty}
              onUpload={() => void handleUploadImage()}
              uploadTestId={`canvas-node-${id}-upload-empty`}
            />
          )}

          {showMissingOverlay ? <CanvasMediaNodeMissingOverlay mediaKind="image" /> : null}

          {previewSrc && !showConsole ? (
            <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover/preview:bg-black/10" />
          ) : null}

          {running ? (
            <CanvasNodeGeneratingOverlay
              message={nodeData.progressMessage}
              fallbackMessage="图片生成中…"
              cancelTestId={`canvas-node-${id}-cancel-image-generating`}
              cancelLabel="取消生成"
              onCancel={() => stopNode(id)}
            />
          ) : null}

          {isCanvasAssetImageNode(nodeData) ? (
            <CanvasImageCharacterOverlay
              nodeId={id}
              projectId={projectId}
              data={nodeData}
              hasImage={Boolean(previewSrc)}
              onPatch={handlePatch}
            />
          ) : null}

          {previewSrc && !showConsole ? (
            <CanvasImageCornerActions previewSrc={previewSrc} onDelete={handleDeleteImage} />
          ) : null}
        </div>

        <CanvasNodeConnector side="left" anchored onQuickAdd={handleConnectorAdd} />
        <CanvasNodeConnector side="right" anchored onQuickAdd={handleConnectorAdd} />

        {/* 下控制台：绝对浮在图片下方，节点置顶后盖过其它卡片 */}
        {showConsole ? (
          <div
            className="nodrag nopan pointer-events-none absolute z-30"
            style={{
              width: CANVAS_NODE_CONSOLE_WIDTH,
              ...CANVAS_NODE_BOTTOM_CONSOLE_ANCHOR_STYLE,
            }}
          >
            <div
              className={cn(
                CANVAS_NODE_CONSOLE,
                'pointer-events-auto flex flex-col px-3.5 pt-3 pb-2.5 !overflow-visible',
              )}
              onPointerDown={(event) => event.stopPropagation()}
            >
          <CanvasVideoReferenceBar
            assets={referenceBarAssets}
            mentionAssets={promptMentionAssets}
            canvasProjectId={projectId}
            autoMentionEnabled={autoMentionEnabled}
            onAutoMentionChange={handleAutoMentionChange}
            onUploadReference={() => void handleUploadConsoleReference()}
            onRemoveUpload={handleRemoveConsoleReference}
            embedded
            disabled={running}
          />

          <div
            className="nowheel nodrag nopan min-h-0"
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
          >
            <MentionTextarea
              value={displayPrompt}
              onChange={handlePromptChange}
              candidates={assetMentionCandidates}
              canvasProjectId={projectId}
              embedded
              tone="canvas"
              rows={3}
              scrollBoxHeight={168}
              maxHeight={168}
              disabled={running}
              emptyHint="输入 @ 可引用已标记的人物/场景/道具"
              placeholder={
                upstreamPrompt
                  ? upstreamPrompt
                  : '描述你想生成的画面内容'
              }
              className="border-0 bg-transparent px-0 py-0 text-[14px] leading-relaxed"
            />
          </div>

          <div
            className="mt-2 flex shrink-0 items-center gap-1.5 overflow-x-auto overflow-y-visible pt-1 nodrag nopan"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              {modelOptions.length ? (
                <Select
                  value={activeModelId}
                  onChange={(value) => rememberAssetImageModelId(value)}
                  options={modelOptions}
                  placeholder="模型"
                  compactMenu
                  hideSuffixInTrigger
                  hideSuffixInMenu
                  className={cn(compactSelectClass, '!w-[120px]')}
                />
              ) : (
                <span className="px-1 text-[11px] text-red-400">请配置模型</span>
              )}

              <CanvasImageParamsPopover
                imageSize={imageSize}
                onImageSizeChange={handleImageSizeChange}
                model={activeModel}
                tierParams={imageTierParams}
                onTierParamsChange={handleImageTierParamsChange}
                consoleAuxId={id}
              />
            </div>

            <CanvasGeneratePill
              testId={`canvas-node-${id}-generate-image`}
              running={running}
              disabled={!modelOptions.length}
              showGenerateCost={false}
              generateCost={null}
              generateCostLoading={imageCostLoading}
              className="h-8 gap-1 px-3"
              onClick={() => void runNode(id)}
            />
            {running ? (
              <button
                type="button"
                data-testid={`canvas-node-${id}-stop-image`}
                title="停止生图"
                aria-label="停止生图"
                onClick={(event) => {
                  event.stopPropagation()
                  stopNode(id)
                }}
                className="nodrag nopan inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-red-500/35 bg-red-500/10 px-3 text-xs font-medium text-red-400 hover:bg-red-500/15"
              >
                停止
              </button>
            ) : null}
          </div>

          {nodeData.error ? (
            <p className="mt-2 text-[11px] leading-relaxed text-red-400">{nodeData.error}</p>
          ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <CanvasImageEditDialog
        open={editDialogOpen}
        projectId={projectId}
        nodeId={id}
        outputPath={nodeData.outputPath}
        imageName={
          imageDisplayName.nickname !== '图片' && imageDisplayName.nickname !== '未命名'
            ? imageDisplayName.nickname
            : nodeData.imageName
        }
        outputOwnerKind={nodeData.outputOwnerKind}
        outputOwnerProjectId={nodeData.outputOwnerProjectId}
        onClose={() => setEditDialogOpen(false)}
        onSaved={handleEditSaved}
      />
    </div>
  )
}

export const CanvasImageNode = memo(CanvasImageNodeComponent)
