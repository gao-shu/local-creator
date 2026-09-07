import { ImageIcon, Loader2, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/input'
import type { WorkflowShot } from '@/types/workflow'
import { isStoryboardImageValidated } from '@/lib/workflow/shot-video-utils'
import { cn } from '@/lib/utils'

function shotStatusLabel(status: WorkflowShot['status']) {
  if (status === 'done') return { label: '已完成', className: 'bg-emerald-600/90 text-white' }
  if (status === 'generating') return { label: '生成中', className: 'bg-cyan-600/80 text-white' }
  if (status === 'failed') return { label: '失败', className: 'bg-red-500/80 text-white' }
  return { label: '草稿', className: 'bg-muted text-muted-foreground' }
}

interface ShotTableViewProps {
  shots: WorkflowShot[]
  selectedId: string | null
  previewMap: Record<string, string>
  onSelect: (id: string) => void
  onChange: (id: string, patch: Partial<WorkflowShot>) => void
  onAdd: () => void
  onDelete: (id: string) => void
}

export function ShotTableView({
  shots,
  selectedId,
  previewMap,
  onSelect,
  onChange,
  onAdd,
  onDelete,
}: ShotTableViewProps) {
  return (
    <div className="flex flex-col h-full min-h-0 rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full min-w-[640px] text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
            <tr className="text-left text-[11px] text-muted-foreground">
              <th className="px-3 py-2 w-14 font-medium">镜号</th>
              <th className="px-3 py-2 w-20 font-medium">画面</th>
              <th className="px-3 py-2 w-36 font-medium">标题</th>
              <th className="px-3 py-2 min-w-[240px] font-medium">Prompt</th>
              <th className="px-3 py-2 w-16 font-medium">状态</th>
              <th className="px-3 py-2 w-16 font-medium" />
            </tr>
          </thead>
          <tbody>
            {shots.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-16 text-center text-muted-foreground text-xs">
                  暂无分镜，点击「推理分镜」或手动添加
                </td>
              </tr>
            ) : (
              shots.map((shot) => {
                const selected = shot.id === selectedId
                const badge = shotStatusLabel(shot.status)
                const preview = previewMap[shot.id]
                return (
                  <tr
                    key={shot.id}
                    onClick={() => onSelect(shot.id)}
                    className={cn(
                      'border-t border-border/50 cursor-pointer transition-colors',
                      selected ? 'bg-cyan-500/10' : 'hover:bg-muted/40',
                    )}
                  >
                    <td className="px-3 py-2 align-top font-mono text-xs">{shot.shotNumber}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="h-12 w-12 rounded border border-border bg-muted overflow-hidden flex items-center justify-center">
                        {shot.status === 'generating' ? (
                          <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
                        ) : preview ? (
                          <img src={preview} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={shot.dialogue}
                        onChange={(e) => onChange(shot.id, { dialogue: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                      <Textarea
                        value={shot.prompt}
                        onChange={(e) => onChange(shot.id, { prompt: e.target.value })}
                        rows={2}
                        className="resize-none text-xs min-h-[56px]"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded', badge.className)}>
                        {badge.label}
                      </span>
                      {isStoryboardImageValidated(shot) ? (
                        <span className="block text-[10px] text-cyan-600 dark:text-cyan-400 mt-1">
                          已验证
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onDelete(shot.id)}
                        className="p-1 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border px-3 py-2 shrink-0">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          添加镜头
        </button>
      </div>
    </div>
  )
}
