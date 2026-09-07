import type { AssetKind } from '@/types/workflow'

export const ASSET_KIND_UI = {
  character: {
    tab: '角色设定',
    list: '角色列表',
    name: '角色名称',
    description: '角色描述',
    card: '角色卡',
    search: '搜索角色和描述',
  },
  scene: {
    tab: '场景设定',
    list: '场景列表',
    name: '场景名称',
    description: '场景描述',
    card: '场景图',
    search: '搜索场景和描述',
  },
  prop: {
    tab: '物品设定',
    list: '物品列表',
    name: '物品名称',
    description: '物品描述',
    card: '物品图',
    search: '搜索物品和描述',
  },
} as const satisfies Record<
  AssetKind,
  {
    tab: string
    list: string
    name: string
    description: string
    card: string
    search: string
  }
>

export function assetStatusBadge(status: string) {
  if (status === 'done') return { label: '已生成', className: 'bg-emerald-600/90 text-white' }
  if (status === 'generating') return { label: '生成中', className: 'bg-cyan-600/80 text-white' }
  if (status === 'failed') return { label: '失败', className: 'bg-red-500/80 text-white' }
  return { label: '待生成', className: 'bg-slate-500/20 text-slate-600 dark:text-slate-300 border border-slate-500/25' }
}

/** 资产列表第二行状态文案（对齐参考项目） */
export function assetListStatusText(status: string): { label: string; className: string } {
  if (status === 'done') return { label: '已完成', className: 'text-emerald-500' }
  if (status === 'generating') return { label: '生成中', className: 'text-cyan-500' }
  if (status === 'failed') return { label: '失败', className: 'text-red-400' }
  return { label: '待生成', className: 'text-muted-foreground' }
}
