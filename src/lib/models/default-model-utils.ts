import type { AppSettings, ModelConfig, ModelKind } from '@/types/settings'

export type DefaultModelField =
  | 'defaultLlmModelId'
  | 'defaultImageModelId'
  | 'defaultVideoModelId'

export function defaultModelField(kind: ModelKind): DefaultModelField {
  if (kind === 'llm') return 'defaultLlmModelId'
  if (kind === 'image') return 'defaultImageModelId'
  return 'defaultVideoModelId'
}

export function modelListKey(kind: ModelKind): 'llmModels' | 'imageModels' | 'videoModels' {
  if (kind === 'llm') return 'llmModels'
  if (kind === 'image') return 'imageModels'
  return 'videoModels'
}

export function getDefaultModelId(settings: AppSettings | null | undefined, kind: ModelKind): string | undefined {
  if (!settings) return undefined
  return settings[defaultModelField(kind)]
}

export function isDefaultModel(
  settings: AppSettings | null | undefined,
  kind: ModelKind,
  modelId: string,
): boolean {
  const defaultId = getDefaultModelId(settings, kind)
  return Boolean(defaultId && defaultId === modelId)
}

/** 下拉初始值：当前有效 > 默认 > 列表首项 */
export function resolveInitialModelId(
  models: ModelConfig[],
  options?: { currentId?: string; defaultId?: string },
): string {
  const valid = new Set(models.map((m) => m.id))
  const { currentId, defaultId } = options ?? {}
  if (currentId && valid.has(currentId)) return currentId
  if (defaultId && valid.has(defaultId)) return defaultId
  return models[0]?.id ?? ''
}

export function resolveDefaultModelIdAfterRemove(
  models: ModelConfig[],
  removedId: string,
  currentDefaultId?: string,
): string | undefined {
  if (!currentDefaultId || currentDefaultId !== removedId) return currentDefaultId
  return models[0]?.id
}
