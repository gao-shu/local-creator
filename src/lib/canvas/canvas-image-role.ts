// Copyright (c) local-creator contributors. All rights reserved.

import type { Node } from '@xyflow/react'
import type { CanvasImageAssetRole } from '@/types/canvas-nodes'
import { CANVAS_NODE_TYPES, type CanvasImageNodeData } from '@/types/canvas-nodes'

export const CANVAS_IMAGE_ROLE_LABELS: Record<CanvasImageAssetRole, string> = {
  character: '角色',
  scene: '场景',
  item: '道具',
}

/** 画布 @ 转换 / 名称前展示用（对齐画镜：人物 / 场景 / 道具） */
export const CANVAS_IMAGE_ROLE_MENTION_LABELS: Record<CanvasImageAssetRole, string> = {
  character: '人物',
  scene: '场景',
  item: '道具',
}

export const CANVAS_IMAGE_ROLE_COLORS: Record<CanvasImageAssetRole, string> = {
  character: 'text-pink-600 dark:text-pink-400',
  scene: 'text-emerald-600 dark:text-emerald-400',
  item: 'text-amber-600 dark:text-amber-400',
}

/** 未转换 / 默认图片名称文字色 */
export const CANVAS_IMAGE_DEFAULT_NAME_COLOR = 'text-foreground/80 dark:text-white/75'

export const CANVAS_IMAGE_MUTED_NAME_COLOR = 'text-muted-foreground dark:text-white/45'

export const CANVAS_IMAGE_ROLE_BG: Record<CanvasImageAssetRole, string> = {
  character: 'bg-pink-500/15 border-pink-400/35',
  scene: 'bg-emerald-500/15 border-emerald-400/35',
  item: 'bg-amber-500/15 border-amber-400/35',
}

export const CANVAS_IMAGE_ROLE_OPTIONS: CanvasImageAssetRole[] = ['character', 'scene', 'item']

/** 新建图片节点默认名称：图片1 / 图片2 … */
export function generateCanvasDefaultImageName(existingNames: string[] = []): string {
  const used = new Set(existingNames.map((name) => name.trim().toLowerCase()).filter(Boolean))
  for (let index = 1; index <= 999; index += 1) {
    const candidate = `图片${index}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
  return `图片${Date.now().toString().slice(-4)}`
}

export function collectCanvasImageNodeNames(nodes: Node[]): string[] {
  return nodes
    .filter((node) => node.type === CANVAS_NODE_TYPES.imageNode)
    .map((node) => String((node.data as CanvasImageNodeData).imageName || '').trim())
    .filter(Boolean)
}

function isCanvasImageAssetRole(value: unknown): value is CanvasImageAssetRole {
  return typeof value === 'string' && CANVAS_IMAGE_ROLE_OPTIONS.includes(value as CanvasImageAssetRole)
}

export function assignDefaultImageNodeData(
  nodes: Node[],
  data?: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...(data ?? {}) }
  const existingNames = collectCanvasImageNodeNames(nodes)
  if (!String(next.imageName || '').trim()) {
    if (next.assetRoleConverted && isCanvasImageAssetRole(next.assetRole)) {
      next.imageName = generateCanvasConvertedAssetName(next.assetRole, existingNames)
    } else {
      next.imageName = generateCanvasDefaultImageName(existingNames)
    }
  }
  next.layoutShellV2 = true
  return next
}

/** 画镜：@ 转换后自动生成唯一昵称（存储不含前缀，展示为 人物 01） */
export function generateCanvasConvertedAssetName(
  role: CanvasImageAssetRole,
  existingNames: string[] = [],
): string {
  const used = new Set(
    existingNames
      .map((name) => stripCanvasRolePrefixFromName(name.trim(), role).toLowerCase())
      .filter(Boolean),
  )
  for (let index = 1; index <= 99; index += 1) {
    const candidate = String(index).padStart(2, '0')
    if (!used.has(candidate.toLowerCase())) return candidate
  }
  return Date.now().toString().slice(-2)
}

/** 去掉名称中已有的角色前缀（人物 / 场景 / 道具，含可选空格） */
export function stripCanvasRolePrefixFromName(
  name: string,
  role?: CanvasImageAssetRole,
): string {
  const trimmed = String(name || '').trim()
  if (!trimmed || !role) return trimmed
  const prefix = CANVAS_IMAGE_ROLE_MENTION_LABELS[role]
  if (trimmed.startsWith(`${prefix} `)) {
    return trimmed.slice(prefix.length + 1).trimStart()
  }
  if (trimmed.startsWith(prefix)) {
    const stripped = trimmed.slice(prefix.length).trimStart()
    return stripped || trimmed
  }
  return trimmed
}

/** 是否为新建图片节点的默认名称（图片1 / 图片2 …） */
export function isDefaultCanvasImageName(name?: string | null): boolean {
  const trimmed = String(name || '').trim()
  if (!trimmed) return true
  return /^图片\d+$/.test(trimmed)
}

/** 是否为标记类型后自动分配的序号名（01 / 02 …） */
export function isDefaultCanvasConvertedAssetName(name?: string | null): boolean {
  const trimmed = String(name || '').trim()
  if (!trimmed) return true
  return /^\d{1,2}$/.test(trimmed)
}

function ensureUniqueCanvasAssetNickname(
  nickname: string,
  existingNames: string[],
  role?: CanvasImageAssetRole,
): string {
  const used = new Set(
    existingNames
      .map((name) => {
        const trimmed = name.trim()
        if (!trimmed) return ''
        return role ? stripCanvasRolePrefixFromName(trimmed, role).toLowerCase() : trimmed.toLowerCase()
      })
      .filter(Boolean),
  )
  if (!used.has(nickname.toLowerCase())) return nickname
  for (let index = 2; index <= 99; index += 1) {
    const candidate = `${nickname}${index}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
  return `${nickname}_${Date.now().toString().slice(-4)}`
}

/** 标记为人物/场景/道具时：保留用户自定义名称，仅对默认占位名重新编号 */
export function resolveCanvasAssetNameWhenMarkingRole(
  currentName: string | undefined,
  role: CanvasImageAssetRole,
  existingNames: string[],
  options?: {
    previousRole?: CanvasImageAssetRole
    wasConverted?: boolean
  },
): string {
  const previousRole = options?.previousRole
  const wasConverted = Boolean(options?.wasConverted)

  let bare = String(currentName || '').trim()
  for (const stripRole of [previousRole, role]) {
    if (stripRole) {
      bare = stripCanvasRolePrefixFromName(bare, stripRole)
    }
  }

  const shouldAutoName =
    !bare ||
    (wasConverted
      ? isDefaultCanvasConvertedAssetName(bare)
      : isDefaultCanvasImageName(bare))

  if (shouldAutoName) {
    return generateCanvasConvertedAssetName(role, existingNames)
  }

  return ensureUniqueCanvasAssetNickname(bare, existingNames, role)
}

/** 已标记类型时，拼接为「人物 昵称」形式（仅展示用） */
export function formatCanvasImageNameWithRolePrefix(
  name: string,
  options: {
    assetRole?: CanvasImageAssetRole
    assetRoleConverted?: boolean
  },
): string {
  const { assetRole, assetRoleConverted } = options
  if (!assetRoleConverted || !assetRole) {
    return String(name || '').trim()
  }
  const prefix = CANVAS_IMAGE_ROLE_MENTION_LABELS[assetRole]
  const bare = stripCanvasRolePrefixFromName(name, assetRole)
  if (!bare) return prefix
  return `${prefix} ${bare}`
}

export interface CanvasImageDisplayName {
  /** 可编辑昵称（不含类型前缀） */
  nickname: string
  /** 固定类型前缀：人物 / 场景 / 道具 */
  rolePrefix?: string
  /** 完整展示：人物 爷爷 */
  label: string
  colorClass: string
}

export function resolveCanvasImageTitle(options: {
  assetRole?: CanvasImageAssetRole
  importShotNumber?: number
  imageName?: string
}): { label: string; colorClass: string } {
  const custom = options.imageName?.trim()
  if (custom) {
    return {
      label: formatCanvasImageNameWithRolePrefix(custom, {
        assetRole: options.assetRole,
        assetRoleConverted: Boolean(options.assetRole),
      }),
      colorClass: options.assetRole
        ? CANVAS_IMAGE_ROLE_COLORS[options.assetRole]
        : CANVAS_IMAGE_DEFAULT_NAME_COLOR,
    }
  }
  if (options.assetRole) {
    const base = CANVAS_IMAGE_ROLE_LABELS[options.assetRole]
    const suffix =
      options.assetRole === 'character' && options.importShotNumber
        ? ` ${options.importShotNumber}`
        : ''
    return {
      label: `${base}${suffix}`,
      colorClass: CANVAS_IMAGE_ROLE_COLORS[options.assetRole],
    }
  }
  return { label: '图片', colorClass: CANVAS_IMAGE_DEFAULT_NAME_COLOR }
}

/** 画布节点标题展示名（已标记类型时前缀固定，昵称可编辑） */
export function resolveCanvasImageDisplayName(options: {
  assetRole?: CanvasImageAssetRole
  importShotNumber?: number
  imageName?: string
  assetRoleConverted?: boolean
}): CanvasImageDisplayName {
  const colorClass =
    options.assetRoleConverted && options.assetRole
      ? CANVAS_IMAGE_ROLE_COLORS[options.assetRole]
      : CANVAS_IMAGE_DEFAULT_NAME_COLOR

  const custom = options.imageName?.trim()
  if (options.assetRoleConverted && options.assetRole) {
    const rolePrefix = CANVAS_IMAGE_ROLE_MENTION_LABELS[options.assetRole]
    const nickname = custom ? stripCanvasRolePrefixFromName(custom, options.assetRole) : '未命名'
    return {
      nickname,
      rolePrefix,
      label: `${rolePrefix} ${nickname}`,
      colorClass,
    }
  }

  if (custom) {
    return {
      nickname: custom,
      label: custom,
      colorClass,
    }
  }

  return {
    nickname: '图片',
    label: '图片',
    colorClass,
  }
}
