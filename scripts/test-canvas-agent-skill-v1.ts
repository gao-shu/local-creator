/**
 * Agent Skill v1 烟雾：Registry / Result 解析 / execute 入口存在性
 *   npx --yes tsx scripts/test-canvas-agent-skill-v1.ts
 */
import assert from 'node:assert/strict'
import {
  CANVAS_AGENT_SKILL_DEFINITIONS,
  CANVAS_AGENT_SKILL_MEDIA_TYPES,
  getCanvasAgentSkillDefinition,
  listCanvasAgentSkillDefinitionsByMediaType,
} from '../src/lib/canvas/canvas-agent-skill-registry.ts'
import {
  executeCanvasAgentSkill,
  parseCanvasStoryboardReviewOutput,
} from '../src/lib/canvas/canvas-agent-skill-execute.ts'
import type { CanvasAgentSkillId } from '../src/lib/canvas/canvas-agent-types.ts'

const ids = CANVAS_AGENT_SKILL_DEFINITIONS.map((item) => item.id).sort()
assert.deepEqual(
  ids,
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

assert.deepEqual(
  CANVAS_AGENT_SKILL_MEDIA_TYPES.map((item) => item.id),
  ['text', 'image', 'video'],
)

for (const id of ids as CanvasAgentSkillId[]) {
  const def = getCanvasAgentSkillDefinition(id)
  assert.ok(def, id)
  assert.ok(def.supportedNodeTypes.length > 0, id)
  assert.ok(def.mode === 'action' || def.mode === 'review', id)
  assert.ok(def.mediaType === 'text' || def.mediaType === 'image' || def.mediaType === 'video', id)
}

assert.equal(getCanvasAgentSkillDefinition('edit_video')?.requiresConfirmation, true)
assert.equal(getCanvasAgentSkillDefinition('review_storyboard')?.mode, 'review')
assert.equal(getCanvasAgentSkillDefinition('merge_image_grid')?.expensive, false)
assert.equal(getCanvasAgentSkillDefinition('extract_voice')?.requiresUserInstruction, false)
assert.ok(listCanvasAgentSkillDefinitionsByMediaType('text').length >= 3)
assert.ok(listCanvasAgentSkillDefinitionsByMediaType('image').some((item) => item.id === 'merge_image_grid'))

{
  const parsed = parseCanvasStoryboardReviewOutput(
    JSON.stringify({
      status: 'reject',
      score: 72,
      issues: [
        {
          type: 'shot_logic',
          severity: 'high',
          message: '镜头8直接出现楼梯',
          suggestion: '增加建立空间的中远景',
        },
      ],
    }),
  )
  assert.ok(parsed)
  assert.equal(parsed.status, 'reject')
  assert.equal(parsed.score, 72)
  assert.equal(parsed.issues.length, 1)
  assert.equal(parsed.issues[0].severity, 'high')
}

{
  const parsed = parseCanvasStoryboardReviewOutput(
    '前言\n```json\n{"status":"pass","score":90,"issues":[]}\n```\n',
  )
  assert.ok(parsed)
  assert.equal(parsed.status, 'pass')
  assert.equal(parsed.score, 90)
}

{
  const result = await executeCanvasAgentSkill({
    skillId: 'review_storyboard',
    model: {
      id: 'mock',
      name: 'mock',
      provider: 'openai',
      model: 'mock',
      apiKey: '',
      endpoint: '',
    } as never,
    input: {
      userInstruction: '审一下',
      targetNodeIds: [],
      nodes: [],
      edges: [],
    },
    deps: {
      updateNodeData: () => {},
      runNode: async () => {},
    },
  })
  assert.equal(result.status, 'failed')
  assert.match(String(result.error), /选中|引用/)
}

{
  const result = await executeCanvasAgentSkill({
    skillId: 'merge_image_grid',
    input: {
      userInstruction: '',
      targetNodeIds: [],
      nodes: [],
      edges: [],
    },
    deps: {
      updateNodeData: () => {},
      runNode: async () => {},
    },
  })
  assert.equal(result.status, 'failed')
  assert.match(String(result.error), /2 张/)
}

console.log('✓ canvas-agent-skill-v1')
