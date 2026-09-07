/**
 * 联调脚本共用 fetch 封装（含超时与可重试网络错误）
 */
export function normalizeApiBase(raw = process.env.API_BASE || 'http://8.141.97.65/api') {
  return String(raw).replace(/\/+$/, '')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableFetchError(err) {
  const code = err?.code ?? err?.cause?.code
  if (code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'UND_ERR_HEADERS_TIMEOUT') return true
  const msg = String(err?.message ?? err?.cause?.message ?? '')
  return /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(msg)
}

export function createProbeApi(apiBase = normalizeApiBase(), options = {}) {
  const timeoutMs = Number(process.env.PROBE_FETCH_TIMEOUT_MS) || options.timeoutMs || 30_000
  const maxRetries = Number(process.env.PROBE_FETCH_RETRIES) || options.maxRetries || 3
  const retryDelayMs = options.retryDelayMs ?? 2_000

  async function api(path, { method = 'GET', body, token } = {}) {
    const url = `${apiBase}${path.startsWith('/') ? path : `/${path}`}`
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    let lastError
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(timeoutMs),
        })
        const text = await res.text()
        let json = null
        try {
          json = text ? JSON.parse(text) : null
        } catch {
          json = { raw: text }
        }
        return { status: res.status, json }
      } catch (err) {
        lastError = err
        if (!isRetryableFetchError(err) || attempt >= maxRetries) throw err
        console.warn(
          `[probe] ${method} ${path} attempt ${attempt}/${maxRetries} failed (${err.message ?? err}), retrying...`,
        )
        await sleep(retryDelayMs)
      }
    }
    throw lastError
  }

  return { api, apiBase }
}
