// Copyright (c) Haode AI. All rights reserved.

import type { ScriptCreateParams } from '@/lib/toolbox/script-create/types'
import {
  SCRIPT_CONTENT_TYPE_OPTIONS,
  SCRIPT_DURATION_OPTIONS,
  SCRIPT_EPISODE_OPTIONS,
  SCRIPT_GENRE_OPTIONS,
  SCRIPT_PLATFORM_OPTIONS,
} from '@/lib/toolbox/script-create/types'

function labelOf<T extends string>(
  options: Array<{ id: T; label: string }>,
  id: T,
): string {
  return options.find((item) => item.id === id)?.label ?? id
}

export function buildScriptCreatePrompt(idea: string, params: ScriptCreateParams): string {
  const contentType = labelOf(SCRIPT_CONTENT_TYPE_OPTIONS, params.contentType)
  const duration = labelOf(SCRIPT_DURATION_OPTIONS, params.duration)
  const episodes = labelOf(SCRIPT_EPISODE_OPTIONS, params.episodeCount)
  const genre = labelOf(SCRIPT_GENRE_OPTIONS, params.genre)
  const platform = labelOf(SCRIPT_PLATFORM_OPTIONS, params.platform)
  const multiEpisode = params.episodeCount !== '1'

  return [
    '你是一名资深短剧/漫剧编剧，擅长把一句话创意写成可拍摄、可分镜的剧本。',
    '要求：',
    '1. 可拍、可画：每场给出地点、画面动作、对白/旁白、情绪与预估秒数。',
    '2. 对白短、口语化，少形容词堆砌，少空泛抒情。',
    '3. 结构清晰，节奏适合目标时长与平台。',
    '4. 只输出 Markdown 正文，不要解释创作思路，不要用代码块包裹全文。',
    '',
    '请严格使用以下结构：',
    '# {标题}',
    '',
    '> 一句话卖点：...',
    '> 预估时长：...',
    '',
    '## 角色',
    '- 角色名：人设一句',
    '',
    multiEpisode
      ? '## 第1集 {集标题}\n\n### 场次1 · {地点} · 约Ns\n- 画面：...\n- 对白/旁白：...\n- 情绪：...\n\n（后续第2集、第3集同样结构）'
      : '### 场次1 · {地点} · 约Ns\n- 画面：...\n- 对白/旁白：...\n- 情绪：...\n\n（按需要继续场次2、场次3…）',
    '',
    '【创作约束】',
    `- 内容类型：${contentType}`,
    `- 目标时长：${duration}`,
    `- 集数：${episodes}`,
    `- 叙事题材：${genre}`,
    `- 平台：${platform}`,
    multiEpisode ? '- 多集时必须用「## 第N集」清晰分段，每集有自己的小高潮或钩子。' : '- 单集完整闭环，结尾有记忆点。',
    '',
    '【用户创意】',
    idea.trim(),
  ].join('\n')
}
