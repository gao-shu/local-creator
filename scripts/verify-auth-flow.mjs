/**
 * 注册 / 登录 / 会话校验 E2E（直连 Docker 或经 Vite 代理）
 *
 * 用法:
 *   node scripts/verify-auth-flow.mjs
 *   API_BASE=http://127.0.0.1:28080/api node scripts/verify-auth-flow.mjs
 *   API_BASE=http://localhost:15173/api node scripts/verify-auth-flow.mjs
 */
const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:28080/api').replace(/\/+$/, '')

function fail(msg) {
  console.error(`[FAIL] ${msg}`)
  process.exit(1)
}

function ok(msg) {
  console.log(`[OK] ${msg}`)
}

async function api(path, { method = 'GET', body, token } = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  const text = await res.text()
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  return { status: res.status, json, text }
}

async function main() {
  console.log(`\n=== Auth E2E: ${API_BASE} ===\n`)

  const suffix = Date.now().toString(36)
  const username = `e2e_${suffix}`
  const password = 'password123'

  // 1. health
  {
    const { status, json } = await api('/health')
    if (status !== 200 || json?.data?.status !== 'ok') {
      fail(`health 失败 status=${status} body=${JSON.stringify(json)}`)
    }
    ok('health')
  }

  // 2. check-username available
  {
    const { status, json } = await api(`/client/auth/check-username?username=${username}`)
    if (status !== 200 || json?.code !== 0 || json?.data?.available !== true) {
      fail(`check-username 失败: ${JSON.stringify(json)}`)
    }
    ok(`check-username ${username} available`)
  }

  // 3. register
  let token = ''
  let userId = ''
  {
    const { status, json } = await api('/client/auth/register', {
      method: 'POST',
      body: { username, password },
    })
    if (status !== 200 || json?.code !== 0 || !json?.data?.access_token) {
      fail(`register 失败 status=${status} body=${JSON.stringify(json)}`)
    }
    token = json.data.access_token
    userId = json.data.user?.id
    if (!json.data.user?.invite_code || json.data.user?.bells !== 20) {
      fail(`register 用户字段异常: ${JSON.stringify(json.data.user)}`)
    }
    ok(`register ${username} invite=${json.data.user.invite_code} bells=${json.data.user.bells}`)
  }

  // 4. me with token
  {
    const { status, json } = await api('/client/auth/me', { token })
    if (status !== 200 || json?.code !== 0 || json?.data?.username !== username) {
      fail(`/me 失败: ${JSON.stringify(json)}`)
    }
    ok('/me 返回正确用户')
  }

  // 5. login same user
  {
    const { status, json } = await api('/client/auth/login', {
      method: 'POST',
      body: { username, password },
    })
    if (status !== 200 || json?.code !== 0 || !json?.data?.access_token) {
      fail(`login 失败: ${JSON.stringify(json)}`)
    }
    token = json.data.access_token
    ok('login 成功')
  }

  // 6. wrong password
  {
    const { status, json } = await api('/client/auth/login', {
      method: 'POST',
      body: { username, password: 'wrongpass1' },
    })
    if (status !== 200 || json?.code === 0) {
      fail(`错误密码应失败: ${JSON.stringify(json)}`)
    }
    ok(`错误密码拒绝 code=${json?.code}`)
  }

  // 7. duplicate register
  {
    const { status, json } = await api('/client/auth/register', {
      method: 'POST',
      body: { username, password },
    })
    if (status !== 200 || json?.code === 0) {
      fail(`重复注册应失败: ${JSON.stringify(json)}`)
    }
    ok(`重复注册拒绝 code=${json?.code}`)
  }

  // 8. invalid token
  {
    const { status, json } = await api('/client/auth/me', { token: 'invalid.jwt.token' })
    if (status === 200 && json?.code === 0) {
      fail('无效 token 不应通过 /me')
    }
    ok('无效 token 被拒绝')
  }

  console.log(`\n=== 全部通过 (user=${username} id=${userId}) ===\n`)
}

main().catch((err) => {
  console.error('[FAIL]', err.message || err)
  if (String(err.message).includes('fetch failed') || String(err.cause).includes('ECONNREFUSED')) {
    console.error('\n提示: 确认 Docker 已启动 (28080) 或 dev 代理已运行')
    console.error('  docker compose --env-file deploy/docker/.env ps')
    console.error('  cd haode-ai-client && npm run dev')
  }
  process.exit(1)
})
