/** 客户端模糊匹配：query 按空格分词，每段都需在 text 中出现（忽略大小写） */
export function fuzzyMatchText(text: string, query: string): boolean {
  const haystack = text.trim().toLowerCase()
  const q = query.trim().toLowerCase()
  if (!q) return true
  return q.split(/\s+/).every((token) => token.length > 0 && haystack.includes(token))
}
