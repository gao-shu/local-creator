/**
 * 工具箱 Skills 池：Registry 同源 + 文本/图片/视频主筛选
 *   npx --yes tsx scripts/test-toolbox-skills-pool.ts
 */
import assert from 'node:assert/strict'
import {
  CANVAS_AGENT_SKILL_CATEGORIES,
  CANVAS_AGENT_SKILL_DEFINITIONS,
  CANVAS_AGENT_SKILL_MEDIA_TYPES,
} from '../src/lib/canvas/canvas-agent-skill-registry.ts'
import {
  buildCanvasAgentSkillEditorPath,
  filterToolboxSkillsByCategory,
  filterToolboxSkillsByMediaType,
  formatCanvasAgentSkillCategoryLabel,
  formatCanvasAgentSkillKindLabel,
  formatCanvasAgentSkillMediaTypeLabel,
  formatCanvasAgentSkillModeLabel,
  listToolboxSkillCategories,
  listToolboxSkillDefinitions,
  listToolboxSkillMediaTypes,
  parseCanvasAgentSkillQuery,
  resolveCanvasProjectIdForSkillLaunch,
} from '../src/lib/toolbox/skills-pool.ts'

const listed = listToolboxSkillDefinitions()
assert.strictEqual(listed, CANVAS_AGENT_SKILL_DEFINITIONS)
assert.deepEqual(
  listed.map((item) => item.id).sort(),
  [
    'edit_image',
    'edit_video',
    'extract_assets',
    'extract_voice',
    'merge_image_grid',
    'review_storyboard',
    'smart_storyboard',
  ].sort(),
)

const mediaTypes = listToolboxSkillMediaTypes()
assert.strictEqual(mediaTypes, CANVAS_AGENT_SKILL_MEDIA_TYPES)
assert.deepEqual(
  mediaTypes.map((item) => item.id),
  ['text', 'image', 'video'],
)

const categories = listToolboxSkillCategories()
assert.strictEqual(categories, CANVAS_AGENT_SKILL_CATEGORIES)

for (const skill of listed) {
  assert.ok(skill.name.trim(), skill.id)
  assert.ok(skill.description.trim(), skill.id)
  assert.ok(skill.supportedNodeTypes.length > 0, skill.id)
  assert.ok(skill.mediaType, skill.id)
  assert.ok(skill.category, skill.id)
  assert.ok(
    mediaTypes.some((item) => item.id === skill.mediaType),
    `${skill.id} mediaType=${skill.mediaType}`,
  )
}

assert.equal(listed.find((item) => item.id === 'edit_image')?.mediaType, 'image')
assert.equal(listed.find((item) => item.id === 'edit_video')?.mediaType, 'video')
assert.equal(listed.find((item) => item.id === 'review_storyboard')?.mediaType, 'text')
assert.equal(listed.find((item) => item.id === 'merge_image_grid')?.mediaType, 'image')

assert.equal(filterToolboxSkillsByMediaType(listed, 'all').length, listed.length)
assert.ok(filterToolboxSkillsByMediaType(listed, 'image').length >= 2)
assert.ok(filterToolboxSkillsByMediaType(listed, 'text').length >= 3)
assert.equal(filterToolboxSkillsByCategory(listed, 'script').length, 0)
assert.equal(formatCanvasAgentSkillMediaTypeLabel('text'), '文本')
assert.equal(formatCanvasAgentSkillCategoryLabel('storyboard'), '分镜')

assert.equal(formatCanvasAgentSkillModeLabel('action'), 'Action')
assert.equal(formatCanvasAgentSkillModeLabel('review'), 'Review')

const editImage = listed.find((item) => item.id === 'edit_image')!
const review = listed.find((item) => item.id === 'review_storyboard')!
const merge = listed.find((item) => item.id === 'merge_image_grid')!
assert.equal(formatCanvasAgentSkillKindLabel(editImage), '生产型')
assert.equal(formatCanvasAgentSkillKindLabel(review), '分析型')
assert.equal(formatCanvasAgentSkillKindLabel(merge), '分析型')

assert.equal(parseCanvasAgentSkillQuery('review_storyboard'), 'review_storyboard')
assert.equal(parseCanvasAgentSkillQuery('merge_image_grid'), 'merge_image_grid')
assert.equal(parseCanvasAgentSkillQuery('nope'), null)

assert.equal(
  buildCanvasAgentSkillEditorPath('cv_demo', 'edit_video'),
  '/canvas/cv_demo?agentSkill=edit_video',
)

assert.equal(
  resolveCanvasProjectIdForSkillLaunch({
    projects: [
      { id: 'a', updatedAt: 1 },
      { id: 'b', updatedAt: 9 },
    ],
  }),
  'b',
)
assert.equal(
  resolveCanvasProjectIdForSkillLaunch({
    projects: [
      { id: 'a', updatedAt: 1 },
      { id: 'b', updatedAt: 9 },
    ],
    preferredProjectId: 'a',
  }),
  'a',
)
assert.equal(resolveCanvasProjectIdForSkillLaunch({ projects: [] }), null)

console.log('✓ toolbox-skills-pool')
