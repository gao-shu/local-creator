/** 检测路径是否包含中文（画境业务规则：禁止中文路径） */
export function hasChinesePath(value: string): boolean {
  if (!value.trim()) return false
  return /[\u4e00-\u9fff]/.test(value)
}

export function validateSettingsPaths(paths: Record<string, string>): string[] {
  const errors: string[] = []
  for (const [key, value] of Object.entries(paths)) {
    if (value && hasChinesePath(value)) {
      errors.push(`${key} 路径不能包含中文`)
    }
  }
  return errors
}
