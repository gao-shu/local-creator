import { FolderOpen } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { hasChinesePath } from '@/lib/storage/path-utils'
import { selectDirectory } from '@/lib/storage/settings-service'

interface PathFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}

export function PathField({ label, value, onChange, required }: PathFieldProps) {
  const chineseError = hasChinesePath(value)

  const handleBrowse = async () => {
    const res = await selectDirectory()
    if (res.success && res.path) {
      onChange(res.path)
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </Label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="选择或输入文件夹路径"
          className={chineseError ? 'border-destructive/50' : ''}
        />
        <Button type="button" variant="outline" onClick={handleBrowse}>
          <FolderOpen className="h-4 w-4" />
          选择
        </Button>
      </div>
      {chineseError ? (
        <p className="text-xs text-destructive">路径不能包含中文字符</p>
      ) : null}
    </div>
  )
}
