// Copyright (c) 2025 好的AI. All rights reserved.

/** Step3 资产生图 / 分镜批量生图 worker 池并发（写死，不提供设置项） */
export const IMAGE_BATCH_CONCURRENCY = 3

/** 视频任务状态轮询间隔（OpenAI / Grok / 微视 / 智谱 / Agnes 统一） */
export const VIDEO_POLL_INTERVAL_MS = 8000

/** Step4 单镜/批量生视频 worker 池并发（写死，不提供设置项） */
export const VIDEO_BATCH_CONCURRENCY = 3

/** 创作工坊 Step1/3/4 脏数据自动保存间隔 */
export const WORKSHOP_AUTO_SAVE_INTERVAL_MS = 30_000

/** @deprecated 使用 VIDEO_BATCH_CONCURRENCY */
export const DEFAULT_MAX_CONCURRENCY = VIDEO_BATCH_CONCURRENCY

/** 分镜生图表单并发选项上限 */
export const MAX_BATCH_CONCURRENCY = 5
