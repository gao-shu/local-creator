// Copyright (c) local-creator contributors. All rights reserved.

/**
 * P0：分镜模板可用性 / 空壳回落 / Seedance prompt 回归。
 * 运行：npm run test:storyboard-template-usability
 */
import assert from 'node:assert/strict'
import { SEEDANCE_15S_STANDARD_TEMPLATE } from '../src/lib/prompts/storyboard/seedance-15s-standard'
import { ensurePromptTemplates } from '../src/lib/storage/settings-defaults'
import {
  REMOVED_STORYBOARD_TEMPLATE_KEYS,
  SEED_STORYBOARD_TEMPLATES,
} from '../src/lib/storage/prompt-templates-seed'
import type { AppSettings } from '../src/types/settings'
import {
  buildStoryboardPrompt,
  isUsableStoryboardTemplate,
  listStoryboardTemplateSelectOptions,
  resolveCanvasStoryboardTemplateKey,
  resolveProjectStoryboardTemplateKey,
  resolveStoryboardTemplate,
} from '../src/lib/workflow/storyboard-prompt'
import type { WorkflowEpisode } from '../src/types/workflow'

const LEGACY_IMAGE_STORYBOARD_SNIPPET = '景别仅用：中景、近景、特写'

function seedStoryboardTemplates() {
  return SEED_STORYBOARD_TEMPLATES.filter((t) => !REMOVED_STORYBOARD_TEMPLATE_KEYS.has(t.key))
}

function baseSettingsFields(): Omit<AppSettings, 'storyboardTemplates'> {
  return {
    dataRootPath: '',
    projectsDataPath: '',
    workflowDataPath: '',
    characterLibraryPath: '',
    sceneLibraryPath: '',
    generatedImagesPath: '',
    videoSavePath: '',
    llmModels: [],
    imageModels: [],
    videoModels: [],
    extractTemplates: [],
    styleTemplates: [],
    debugEnabled: false,
    openAtLogin: false,
    apiBaseUrl: 'https://example.test',
    affixPresets: [],
    defaultAssetLayoutKeys: { character: '', scene: '', prop: '' },
  }
}

/** 与运行时一致：ensurePromptTemplates 合并 SEED + 手写分镜模板 */
function seedSettings(): AppSettings {
  return ensurePromptTemplates({
    ...baseSettingsFields(),
    storyboardTemplates: seedStoryboardTemplates(),
  })
}

function settingsWithCustomContent(content: string): AppSettings {
  return {
    ...seedSettings(),
    storyboardTemplates: seedStoryboardTemplates().map((tpl) =>
      tpl.key === 'custom' ? { ...tpl, content } : tpl,
    ),
  }
}

const EPISODE: WorkflowEpisode = {
  id: 'ep_usability',
  episodeIndex: 1,
  title: '测试集',
  summary: '',
  content: 'SCENE 1-1 外 - 学院大门 - 日\nChloe 迈入校门。',
  updatedAt: Date.now(),
}

function testIsUsableStoryboardTemplate() {
  assert.equal(isUsableStoryboardTemplate({ content: '' }), false)
  assert.equal(isUsableStoryboardTemplate({ content: '   ' }), false)
  const seedance = SEED_STORYBOARD_TEMPLATES.find((t) => t.key === 'seedance-15s')
  assert.ok(seedance)
  assert.equal(isUsableStoryboardTemplate(seedance!), true)
}

function testListStoryboardTemplateSelectOptions() {
  const settings = seedSettings()
  const options = listStoryboardTemplateSelectOptions(settings)
  const values = options.map((o) => o.value)
  assert.ok(values.includes('seedance-15s'), '应含 seedance-15s')
  assert.ok(values.includes('seedance-15s-standard'), '应含 seedance-15s-standard')
  assert.ok(values.includes('seedance-10s'), '应含 seedance-10s')
  assert.ok(!values.includes('4宫格'), '空壳四宫格不应出现在下拉')
  assert.ok(!values.includes('custom'), '未填写的 custom 不应出现在下拉')
}

function testResolveEmptyShellKeys() {
  const settings = seedSettings()
  assert.equal(
    resolveProjectStoryboardTemplateKey({ storyboardTemplateKey: '4宫格' }, settings),
    'seedance-15s',
  )
  assert.equal(
    resolveCanvasStoryboardTemplateKey({
      ...settings,
      lastUsedCanvasStoryboardTemplateKey: '9宫格',
    }),
    'seedance-15s',
  )
}

function testResolveCustomTemplate() {
  const emptyCustom = seedSettings()
  assert.equal(
    resolveProjectStoryboardTemplateKey({ storyboardTemplateKey: 'custom' }, emptyCustom),
    'seedance-15s',
  )

  const filledCustom = settingsWithCustomContent('你是自定义分镜导演，输出 JSON。')
  assert.equal(
    resolveProjectStoryboardTemplateKey({ storyboardTemplateKey: 'custom' }, filledCustom),
    'custom',
  )
  const options = listStoryboardTemplateSelectOptions(filledCustom)
  assert.ok(options.some((o) => o.value === 'custom'), '已填 custom 应出现在下拉')
}

function testResolveStoryboardTemplateUsesSeedance() {
  const settings = seedSettings()
  const tpl = resolveStoryboardTemplate(settings, '4宫格')
  assert.equal(tpl.key, 'seedance-15s')
  assert.match(tpl.content, /Seedance|00:00-00:04/)
}

function testSeedance15sStandardTemplateBody() {
  const tpl = SEEDANCE_15S_STANDARD_TEMPLATE
  assert.equal(tpl.key, 'seedance-15s-standard')
  assert.match(tpl.content, /【写作定位】/)
  assert.match(tpl.content, /00:00-00:04/)
  assert.match(tpl.content, /禁止不可拍虚写/)
  assert.match(tpl.content, /50mm f\/2/)
  assert.match(tpl.content, /首段含本镜主要 @场景/)

  const settings = seedSettings()
  const resolved = resolveStoryboardTemplate(settings, 'seedance-15s-standard')
  assert.equal(resolved.key, 'seedance-15s-standard')
  const prompt = buildStoryboardPrompt(
    EPISODE,
    { characters: [], scenes: [], props: [] },
    resolved,
    settings,
  )
  assert.match(prompt, /场记 \+ 摄影单/)
  assert.match(prompt, /00:00-00:04/)
}

function testBuildStoryboardPromptUsesSeedanceNotLegacyImage() {
  const settings = seedSettings()
  const prompt = buildStoryboardPrompt(
    EPISODE,
    { characters: [], scenes: [], props: [] },
    undefined,
    settings,
  )
  assert.match(prompt, /Seedance|00:00-00:04/, '应使用 Seedance 分镜正文')
  assert.ok(
    !prompt.includes(LEGACY_IMAGE_STORYBOARD_SNIPPET),
    '不应回落到老生图分镜 prompt',
  )

  const fromEmptyShell = buildStoryboardPrompt(
    EPISODE,
    { characters: [], scenes: [], props: [] },
    resolveStoryboardTemplate(settings, '4宫格'),
    settings,
  )
  assert.match(fromEmptyShell, /Seedance|00:00-00:04/)
  assert.ok(!fromEmptyShell.includes(LEGACY_IMAGE_STORYBOARD_SNIPPET))
}

function main() {
  testIsUsableStoryboardTemplate()
  testListStoryboardTemplateSelectOptions()
  testResolveEmptyShellKeys()
  testResolveCustomTemplate()
  testResolveStoryboardTemplateUsesSeedance()
  testSeedance15sStandardTemplateBody()
  testBuildStoryboardPromptUsesSeedanceNotLegacyImage()
  console.log('ok: storyboard-template-usability (P0)')
}

main()
