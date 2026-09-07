import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Eye, EyeOff, Loader2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { cn, generateUUID } from '@/lib/utils'
import type { ModelConfig, ModelKind } from '@/types/settings'
import { testModelConnection } from '@/lib/models/model-test-service'
import { normalizeApiBase, resolveImageUrl } from '@/lib/models/model-endpoint'
import {
  MODEL_API_FORMAT_OPTIONS,
  MODEL_ID_PLACEHOLDER,
  MODEL_KIND_LABEL,
} from '@/components/settings/model-platform-options'
import {
  buildImagePresetPatch,
  IMAGE_MODEL_PRESETS,
  resolveImagePresetKey,
  type ImagePresetKey,
} from '@/lib/models/image-model-presets'
import {
  buildLlmPresetPatch,
  LLM_MODEL_PRESETS,
  resolveLlmPresetKey,
  type LlmPresetKey,
} from '@/lib/models/llm-model-presets'
import {
  buildVideoPresetPatch,
  resolveVideoPresetKey,
  VIDEO_MODEL_PRESETS,
  type VideoPresetKey,
} from '@/lib/models/video-model-presets'
import { isWeishiApiModel, WEISHI_API_PRESET } from '@/lib/models/weishi-model-presets'
import {
  buildWeishiCustomModelPatchFromCatalog,
  resolveDefaultWeishiUpstreamModelId,
} from '@/lib/models/weishi-model-catalog'
import { useSettingsStore } from '@/stores/settings-store'
import { isWeishiModelCatalogReady } from '@/components/settings/weishi-model-config-fields'
import {
  extractBaseUrlFromEndpoint,
  normalizeVideoModelConfig,
  resolveVideoCreateUrl,
} from '@/lib/models/video-model-utils'
import { resolveGrokVideoCreateUrl } from '@/lib/video/grok-video-client'
import { createEmptyModel } from '@/lib/storage/settings-defaults'
import {
  modelDialogInputClass,
  SettingsToggleField,
} from '@/components/settings/model-config-dialog-shared'
import { VideoModelExtraFields } from '@/components/settings/video-model-extra-fields'
import { WeishiModelConfigFields } from '@/components/settings/weishi-model-config-fields'

interface ModelConfigDialogProps {
  open: boolean
  kind: ModelKind
  initial?: ModelConfig | null
  isEdit?: boolean
  onClose: () => void
  onSave: (config: ModelConfig) => void
}

const inputClass = modelDialogInputClass

export function ModelConfigDialog({
  open,
  kind,
  initial,
  isEdit: isEditProp,
  onClose,
  onSave,
}: ModelConfigDialogProps) {
  const isEdit = isEditProp ?? Boolean(initial?.id)
  const [form, setForm] = useState<ModelConfig>(() => createEmptyModel(kind))
  const [showKey, setShowKey] = useState(false)
  const [apiFormatOpen, setApiFormatOpen] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const systemVideoModels = useSettingsStore((state) => state.systemModelsByKind.video)

  useEffect(() => {
    if (!open) return
    if (initial) {
      const base =
        kind === 'video'
          ? normalizeVideoModelConfig({
              ...initial,
              baseUrl:
                initial.baseUrl ||
                extractBaseUrlFromEndpoint(initial.endpoint || '', initial),
            })
          : initial
      if (kind === 'video' && isWeishiApiModel(base)) {
        const systemVideo = useSettingsStore.getState().systemModelsByKind.video
        const modelId = base.model?.trim() || resolveDefaultWeishiUpstreamModelId(systemVideo)
        const catalogPatch = buildWeishiCustomModelPatchFromCatalog(modelId, systemVideo)
        setForm({ ...base, ...catalogPatch, model: modelId, autoAppendV1: base.autoAppendV1 !== false })
      } else {
        setForm({ ...base, autoAppendV1: base.autoAppendV1 !== false })
      }
    } else {
      const empty = createEmptyModel(kind)
      if (kind === 'video' && isWeishiApiModel(empty)) {
        const systemVideo = useSettingsStore.getState().systemModelsByKind.video
        const modelId = empty.model?.trim() || resolveDefaultWeishiUpstreamModelId(systemVideo)
        const catalogPatch = buildWeishiCustomModelPatchFromCatalog(modelId, systemVideo)
        setForm({ ...empty, ...catalogPatch, model: modelId })
      } else {
        setForm(empty)
      }
    }
    setError('')
    setShowKey(false)
    setApiFormatOpen(false)
  }, [open, initial, kind])

  const patch = useCallback((next: Partial<ModelConfig>) => {
    setForm((prev) => ({ ...prev, ...next }))
  }, [])

  const handleClose = useCallback(() => {
    setError('')
    onClose()
  }, [onClose])

  const validate = () => {
    const fail = (message: string) => {
      setError(message)
      toast.error(message)
      return false
    }
    const isWeishiVideo = kind === 'video' && isWeishiApiModel(form)

    if (isWeishiVideo) {
      if (!isWeishiModelCatalogReady(systemVideoModels)) {
        return fail('管理端暂无启用的微视系统模型，无法保存')
      }
      if (!form.model?.trim()) {
        return fail('请选择模型')
      }
      const catalogPatch = buildWeishiCustomModelPatchFromCatalog(form.model, systemVideoModels)
      if (!catalogPatch.endpoint?.trim()) {
        return fail('所选模型缺少平台接口地址，请联系管理员')
      }
      if (!form.apiKey?.trim()) {
        return fail('请填写 API 密钥')
      }
      return true
    }

    if (!form.name.trim()) {
      return fail('请填写配置名称')
    }
    const endpoint =
      kind === 'video'
        ? normalizeVideoModelConfig(form).endpoint?.trim()
        : form.endpoint?.trim()
    if (!endpoint) {
      return fail('请填写 API 地址')
    }
    if (form.platform !== 'ollama' && !form.apiKey?.trim()) {
      return fail('请填写 API 密钥')
    }
    if ((kind === 'llm' || kind === 'video') && !form.model?.trim()) {
      return fail('请填写模型 ID')
    }
    if (kind === 'video') {
      const ratios = Array.isArray(form.ratios)
        ? form.ratios.map((item) => String(item).trim()).filter(Boolean)
        : []
      const durations = Array.isArray(form.durations)
        ? form.durations.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
        : []
      const resolutions = Array.isArray(form.resolutions)
        ? form.resolutions.map((item) => String(item).trim()).filter(Boolean)
        : []
      const missing: string[] = []
      if (ratios.length === 0) missing.push('画面比例')
      if (durations.length === 0) missing.push('时长（秒）')
      if (resolutions.length === 0) missing.push('分辨率')
      if (missing.length > 0) {
        return fail(`请至少配置：${missing.join('、')}`)
      }
    }
    return true
  }

  const handleTest = async () => {
    setError('')
    try {
      setTesting(true)
      const testModel =
        kind === 'video' ? normalizeVideoModelConfig(form) : form
      const result = await testModelConnection(kind, testModel)
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch (err: unknown) {
      const e = err as Error
      toast.error(e.message || '测试失败')
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    setError('')
    try {
      const isWeishiVideo = kind === 'video' && isWeishiApiModel(form)
      const weishiCatalogPatch =
        isWeishiVideo && form.model?.trim()
          ? buildWeishiCustomModelPatchFromCatalog(form.model, systemVideoModels)
          : {}
      const mergedForm = isWeishiVideo
        ? {
            ...form,
            ...weishiCatalogPatch,
            name: form.name.trim() || WEISHI_API_PRESET.name,
            remark: form.remark?.trim() || WEISHI_API_PRESET.remark,
          }
        : form

      const payload =
        kind === 'video'
          ? normalizeVideoModelConfig({
              ...mergedForm,
              name: mergedForm.name.trim(),
              endpoint: mergedForm.endpoint?.trim(),
              apiKey: mergedForm.apiKey?.trim(),
              model: mergedForm.model?.trim(),
              remark: mergedForm.remark?.trim(),
              id: mergedForm.id || generateUUID(),
            })
          : {
              ...mergedForm,
              name: mergedForm.name.trim(),
              endpoint: mergedForm.endpoint?.trim(),
              apiKey: mergedForm.apiKey?.trim(),
              model: mergedForm.model?.trim(),
              remark: mergedForm.remark?.trim(),
              id: mergedForm.id || generateUUID(),
            }
      onSave(payload)
      handleClose()
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const apiFormatOptions = MODEL_API_FORMAT_OPTIONS[kind]
  const llmPresetKey = kind === 'llm' ? resolveLlmPresetKey(form) : null
  const imagePresetKey = kind === 'image' ? resolveImagePresetKey(form) : null
  const videoPresetKey = kind === 'video' ? resolveVideoPresetKey(form) : null
  const selectedApiFormat =
    kind === 'llm' && llmPresetKey
      ? apiFormatOptions.find((o) => o.value === llmPresetKey) ?? apiFormatOptions[0]
      : kind === 'image' && imagePresetKey
        ? apiFormatOptions.find((o) => o.value === imagePresetKey) ?? apiFormatOptions[0]
        : kind === 'video' && videoPresetKey
          ? apiFormatOptions.find((o) => o.value === videoPresetKey) ?? apiFormatOptions[0]
          : apiFormatOptions[0]
  const showWeishiSimpleEndpoint =
    kind === 'video' &&
    isWeishiApiModel(form) &&
    form.configMode === 'simple'
  const hideModelIdField = kind === 'video' && isWeishiApiModel(form)
  const hideApiFormatPicker = kind === 'video' && isWeishiApiModel(form)
  const isWeishiVideo = kind === 'video' && isWeishiApiModel(form)
  const weishiCatalogReady = !isWeishiVideo || isWeishiModelCatalogReady(systemVideoModels)
  const showAutoAppendV1 =
    kind === 'llm'
      ? llmPresetKey === 'openai_compatible'
      : kind === 'image'
        ? imagePresetKey === 'openai_compatible' || imagePresetKey === 'grok'
        : videoPresetKey === 'openai_compatible' || videoPresetKey === 'grok'
  const isOpenAiCompatiblePreset =
    llmPresetKey === 'openai_compatible' ||
    imagePresetKey === 'openai_compatible' ||
    imagePresetKey === 'grok' ||
    videoPresetKey === 'openai_compatible' ||
    videoPresetKey === 'grok'
  const resolvedVideoEndpointPreview =
    kind === 'video' && videoPresetKey === 'grok'
      ? resolveGrokVideoCreateUrl(form)
      : kind === 'video' && videoPresetKey === 'openai_compatible'
        ? resolveVideoCreateUrl(form)
        : ''
  const resolvedImageEndpointPreview =
    kind === 'image' &&
    (imagePresetKey === 'openai_compatible' || imagePresetKey === 'grok') &&
    form.endpoint?.trim()
      ? resolveImageUrl(form)
      : ''

  const applyLlmPresetFields = (key: LlmPresetKey) => {
    patch(
      buildLlmPresetPatch(key, {
        keepName: Boolean(form.name.trim()),
        name: form.name.trim() || LLM_MODEL_PRESETS[key].defaultName,
      }),
    )
  }

  const applyImagePresetFields = (key: ImagePresetKey) => {
    patch(
      buildImagePresetPatch(key, {
        keepName: Boolean(form.name.trim()),
        name: form.name.trim() || IMAGE_MODEL_PRESETS[key].defaultName,
      }),
    )
  }

  const applyVideoPresetFields = (key: VideoPresetKey) => {
    patch(
      buildVideoPresetPatch(key, {
        keepName: Boolean(form.name.trim()),
        name: form.name.trim() || VIDEO_MODEL_PRESETS[key].defaultName,
      }),
    )
  }

  const isApiFormatSelected = (value: string) =>
    (kind === 'llm' && llmPresetKey === value) ||
    (kind === 'image' && imagePresetKey === value) ||
    (kind === 'video' && videoPresetKey === value)

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'pointer-events-auto w-full max-h-[90vh] flex flex-col',
                isWeishiVideo ? 'max-w-lg' : kind === 'video' ? 'max-w-2xl' : 'max-w-lg',
              )}
            >
            <div
              className={cn(
                'rounded-2xl border border-border/40',
                'bg-card shadow-2xl shadow-black/20',
                'flex flex-col overflow-hidden max-h-[90vh]',
              )}
            >
              <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0">
                <div>
                  <h2 className="text-lg font-semibold">
                    {isWeishiVideo
                      ? isEdit
                        ? '编辑微视API'
                        : '微视API'
                      : isEdit
                        ? '编辑 API 配置'
                        : '新建 API 配置'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isWeishiVideo
                      ? '模型与接口由平台配置；生视频参数在分镜 Step4 选择'
                      : `配置外部 ${MODEL_KIND_LABEL[kind]} 服务的 API 接入信息`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="px-6 space-y-4 pb-2 overflow-y-auto flex-1">
                {!isWeishiVideo ? (
                <div>
                  <label className="block text-sm font-medium mb-1.5">配置名称</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => patch({ name: e.target.value })}
                    placeholder="例如：DeepSeek / Gemini"
                    className={inputClass}
                    autoFocus
                  />
                </div>
                ) : null}

                {!isWeishiVideo ? (
                <div className="relative">
                  <label className="block text-sm font-medium mb-1.5">API 格式</label>
                  {hideApiFormatPicker ? (
                    <div className={cn(inputClass, 'flex items-center text-muted-foreground')}>
                      微视API
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setApiFormatOpen((v) => !v)}
                        className={cn(inputClass, 'flex items-center justify-between text-left')}
                      >
                        <span>{selectedApiFormat?.label ?? 'OpenAI'}</span>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 text-muted-foreground transition-transform',
                            apiFormatOpen && 'rotate-180',
                          )}
                        />
                      </button>
                      {apiFormatOpen ? (
                        <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-xl border border-border/40 bg-card shadow-lg max-h-52 overflow-y-auto">
                          {apiFormatOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                if (kind === 'llm') {
                                  applyLlmPresetFields(option.value as LlmPresetKey)
                                } else if (kind === 'image') {
                                  applyImagePresetFields(option.value as ImagePresetKey)
                                } else {
                                  applyVideoPresetFields(option.value as VideoPresetKey)
                                }
                                setApiFormatOpen(false)
                              }}
                              className={cn(
                                'w-full px-3 py-2.5 text-left hover:bg-muted/60 transition-colors',
                                isApiFormatSelected(option.value) ? 'bg-primary/5' : '',
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {isApiFormatSelected(option.value) ? (
                                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                ) : (
                                  <span className="w-3.5 shrink-0" />
                                )}
                                <span className="text-sm font-medium">{option.label}</span>
                              </div>
                              {option.description ? (
                                <p className="text-xs text-muted-foreground mt-0.5 pl-5">
                                  {option.description}
                                </p>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                ) : null}

                {!isWeishiVideo && !showWeishiSimpleEndpoint ? (
                <div>
                  <label className="block text-sm font-medium mb-1.5">API 地址</label>
                  <input
                    type="text"
                    value={form.endpoint || ''}
                    onChange={(e) => patch({ endpoint: e.target.value })}
                    placeholder={
                      isOpenAiCompatiblePreset
                        ? 'https://api.example.com'
                        : kind === 'llm' && llmPresetKey
                          ? LLM_MODEL_PRESETS[llmPresetKey].endpoint || 'https://api.example.com'
                          : kind === 'image' && imagePresetKey
                            ? IMAGE_MODEL_PRESETS[imagePresetKey].endpoint ||
                              'https://api.example.com'
                            : kind === 'video' && videoPresetKey
                              ? VIDEO_MODEL_PRESETS[videoPresetKey].endpoint ||
                                'https://api.example.com'
                              : 'https://api.example.com'
                    }
                    className={inputClass}
                  />
                  {resolvedImageEndpointPreview &&
                  normalizeApiBase(form.endpoint) !== resolvedImageEndpointPreview ? (
                    <p className="text-[11px] font-mono text-muted-foreground/80 break-all mt-1.5">
                      实际请求：{resolvedImageEndpointPreview}
                    </p>
                  ) : null}
                  {resolvedVideoEndpointPreview &&
                  resolvedVideoEndpointPreview !== normalizeApiBase(form.endpoint) ? (
                    <p className="text-[11px] font-mono text-muted-foreground/80 break-all mt-1.5">
                      实际请求：{resolvedVideoEndpointPreview}
                    </p>
                  ) : null}
                </div>
                ) : null}

                {!isWeishiVideo && !hideModelIdField ? (
                <div>
                  <label className="block text-sm font-medium mb-1.5">模型 ID</label>
                  <input
                    type="text"
                    value={form.model || ''}
                    onChange={(e) => patch({ model: e.target.value })}
                    placeholder={MODEL_ID_PLACEHOLDER[kind]}
                    className={inputClass}
                  />
                  {kind !== 'video' ? (
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {kind === 'image'
                        ? imagePresetKey === 'openai_compatible' || imagePresetKey === 'grok'
                          ? imagePresetKey === 'grok'
                            ? '填写根域名后自动拼接 /v1/images/generations；有参考图走 /v1/images/edits（JSON image.url）'
                            : '填写根域名后自动拼接 /v1/images/generations，参考图走 multipart /v1/images/edits'
                          : '图片模型测试会 POST /v1/images/generations，需填写模型 ID'
                        : 'LLM 测试需要填写模型 ID'}
                    </p>
                  ) : null}
                </div>
                ) : null}

                {form.platform !== 'ollama' && !isWeishiVideo ? (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">API 密钥</label>
                    <div className="relative">
                      <input
                        type={showKey ? 'text' : 'password'}
                        value={form.apiKey || ''}
                        onChange={(e) => patch({ apiKey: e.target.value })}
                        placeholder="sk-..."
                        className={cn(inputClass, 'pr-10')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted transition-colors"
                      >
                        {showKey ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                ) : null}

                {isWeishiVideo ? (
                  <WeishiModelConfigFields
                    form={form}
                    onPatch={patch}
                    showApiKey
                    showKey={showKey}
                    onToggleShowKey={() => setShowKey((value) => !value)}
                  />
                ) : kind === 'video' ? (
                  <VideoModelExtraFields form={form} onPatch={patch} />
                ) : null}

                {!isWeishiVideo && showAutoAppendV1 ? (
                  <SettingsToggleField
                    label="自动补充 /v1 路径"
                    description={
                      kind === 'video'
                        ? '开启后请求发往 /v1/videos 等；关闭则不带 /v1'
                        : kind === 'image'
                          ? '开启后请求发往 /v1/images/generations、/v1/images/edits、/v1/models 等；关闭则不带 /v1'
                          : '开启后请求发往 /v1/chat/completions、/v1/models 等；关闭则不带 /v1'
                    }
                    checked={form.autoAppendV1 !== false}
                    onCheckedChange={(checked) => patch({ autoAppendV1: checked })}
                  />
                ) : null}

                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/20 shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                >
                  取消
                </button>
                {!isWeishiVideo ? (
                <button
                  type="button"
                  onClick={() => void handleTest()}
                  disabled={testing || saving}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium border border-border/40',
                    'hover:bg-muted transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {testing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      测试中...
                    </span>
                  ) : (
                    '测试连接'
                  )}
                </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={saving || testing || !weishiCatalogReady}
                  className={cn(
                    'px-5 py-2 rounded-xl text-sm font-medium',
                    'bg-primary text-primary-foreground',
                    'hover:opacity-90 active:scale-[0.98] transition-all',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      保存中...
                    </span>
                  ) : isEdit ? (
                    '保存'
                  ) : (
                    '创建'
                  )}
                </button>
              </div>
            </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
