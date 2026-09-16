/**
 * OA5 · 首次运行向导纯逻辑自检（无 Electron）
 * 运行：npx --yes tsx scripts/test-first-run-onboarding.ts
 */
import assert from 'node:assert/strict'
import {
  hasReadyLlmOrImageModel,
  isModelConfiguredForUse,
  shouldShowFirstRunWizard,
} from '../src/lib/onboarding/first-run'
import type { AppSettings, ModelConfig } from '../src/types/settings'

function model(partial: Partial<ModelConfig> & Pick<ModelConfig, 'id' | 'name'>): ModelConfig {
  return {
    id: partial.id,
    name: partial.name,
    provider: partial.provider || 'openai',
    endpoint: partial.endpoint,
    baseUrl: partial.baseUrl,
    apiKey: partial.apiKey,
    model: partial.model || 'test',
    enabled: partial.enabled !== false,
  } as ModelConfig
}

const emptySettings = {
  onboardingCompleted: false,
  llmModels: [],
  imageModels: [],
  videoModels: [],
} as unknown as AppSettings

assert.equal(shouldShowFirstRunWizard(null), false)
assert.equal(shouldShowFirstRunWizard(emptySettings), true)
assert.equal(
  shouldShowFirstRunWizard({ ...emptySettings, onboardingCompleted: true }),
  false,
)

assert.equal(isModelConfiguredForUse(null), false)
assert.equal(
  isModelConfiguredForUse(model({ id: '1', name: 'a', endpoint: 'https://x', apiKey: 'k' })),
  true,
)
assert.equal(
  isModelConfiguredForUse(model({ id: '1', name: 'a', endpoint: 'https://x', apiKey: '' })),
  false,
)

assert.equal(hasReadyLlmOrImageModel(emptySettings), false)
assert.equal(
  hasReadyLlmOrImageModel({
    ...emptySettings,
    llmModels: [model({ id: 'l1', name: 'llm', endpoint: 'https://api.example', apiKey: 'sk-test' })],
  }),
  true,
)
assert.equal(
  hasReadyLlmOrImageModel({
    ...emptySettings,
    imageModels: [model({ id: 'i1', name: 'img', baseUrl: 'https://img.example', apiKey: 'key' })],
  }),
  true,
)
assert.equal(
  hasReadyLlmOrImageModel({
    ...emptySettings,
    videoModels: [model({ id: 'v1', name: 'vid', endpoint: 'https://v.example', apiKey: 'key' })],
  }),
  false,
)

console.log('[test:first-run-onboarding] ok')
