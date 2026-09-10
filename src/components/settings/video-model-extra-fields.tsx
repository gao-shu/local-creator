import { cn } from '@/lib/utils'
import type { ModelConfig } from '@/types/settings'
import { VideoDurationTagField, VideoModelTagField } from '@/components/settings/video-model-tag-field'
import {
  buildVideoEndpointFromBaseUrl,
  supportsSimpleVideoEndpoint,
} from '@/lib/models/video-model-utils'

const inputClass = cn(
  'w-full px-3.5 py-2.5 rounded-xl text-sm',
  'bg-muted/50 border border-border/40',
  'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
  'placeholder:text-muted-foreground/50 transition-all',
)

interface VideoModelExtraFieldsProps {
  form: ModelConfig
  onPatch: (patch: Partial<ModelConfig>) => void
}

function ConfigModeToggle({
  value,
  onChange,
}: {
  value: 'simple' | 'advanced'
  onChange: (mode: 'simple' | 'advanced') => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-border/40 p-0.5 bg-muted/30">
      {(['simple', 'advanced'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            value === mode
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {mode === 'simple' ? '简单' : '高级'}
        </button>
      ))}
    </div>
  )
}

export function VideoModelExtraFields({ form, onPatch }: VideoModelExtraFieldsProps) {
  const showSimpleMode = supportsSimpleVideoEndpoint(form)
  const configMode = form.configMode === 'simple' && showSimpleMode ? 'simple' : 'advanced'
  const computedEndpoint =
    configMode === 'simple' && form.baseUrl?.trim()
      ? buildVideoEndpointFromBaseUrl(form.baseUrl, form)
      : ''

  const setConfigMode = (mode: 'simple' | 'advanced') => {
    if (mode === 'simple' && showSimpleMode) {
      const baseUrl = form.baseUrl?.trim() || form.endpoint?.replace(/\/v1\/videos.*$/i, '') || ''
      onPatch({
        configMode: 'simple',
        baseUrl,
        endpoint: baseUrl ? buildVideoEndpointFromBaseUrl(baseUrl, form) : form.endpoint,
      })
      return
    }
    onPatch({ configMode: 'advanced' })
  }

  return (
    <div className="space-y-4">
      {showSimpleMode ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">接入模式</p>
          <ConfigModeToggle value={configMode} onChange={setConfigMode} />
        </div>
      ) : null}

      {showSimpleMode && configMode === 'simple' ? (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Base URL</label>
          <input
            type="text"
            value={form.baseUrl || ''}
            onChange={(e) => {
              const baseUrl = e.target.value
              onPatch({
                baseUrl,
                endpoint: buildVideoEndpointFromBaseUrl(baseUrl, form),
              })
            }}
            placeholder="https://your-video-api-host"
            className={inputClass}
          />
          <p className="text-xs text-muted-foreground">填写服务商域名，系统自动拼接完整地址</p>
          {computedEndpoint ? (
            <p className="text-[11px] font-mono text-muted-foreground/80 break-all">{computedEndpoint}</p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <p className="text-sm font-medium">视频参数</p>
        <div className="space-y-4 rounded-xl border border-border/30 p-3.5 bg-muted/10">
          <VideoModelTagField
            label="画面比例"
            placeholder="输入比例后回车，如 16:9"
            tags={form.ratios ?? []}
            onChange={(ratios) => onPatch({ ratios })}
          />

          <VideoDurationTagField
            tags={form.durations ?? []}
            onChange={(durations) => onPatch({ durations })}
          />
        </div>
      </div>
    </div>
  )
}
