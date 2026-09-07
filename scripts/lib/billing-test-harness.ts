/**
 * 计费联调共用基建：mock fetch 记录、auth 注入、HTTP 日志断言。
 * 供 Step 2 billing-call-matrix 与后续全自动验收使用。
 */
import assert from 'node:assert/strict'

import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'
import type { AuthUser } from '@/types/auth'
import type { AppSettings, ModelConfig } from '@/types/settings'

/** 单次 fetch 记录 */
export type FetchCallRecord = {
  order: number
  url: string
  method: string
  path: string
  body: unknown
}

export type MockFetchRequest = {
  url: string
  method: string
  path: string
  body: unknown
  headers: Headers
}

export type MockFetchResponse = {
  status?: number
  json: unknown
}

export type MockFetchHandler = (
  request: MockFetchRequest,
) => MockFetchResponse | Promise<MockFetchResponse>

export type MockFetchRule = {
  /** path 片段、正则，或自定义 matcher */
  match: string | RegExp | ((path: string, request: MockFetchRequest) => boolean)
  handler: MockFetchHandler
}

export type BillingLogExpectation = {
  /** path 中须包含的片段（至少命中一条） */
  includes?: string[]
  /** path 中不得出现的片段 */
  excludes?: string[]
  /** [较早, 较晚]：前者须先于后者出现 */
  orderBefore?: Array<[string, string]>
  /** 每组最多命中一个片段（互斥，如 consume vs video-consumption） */
  mutuallyExclusive?: string[][]
}

export type SeedAuthOptions = {
  loggedIn?: boolean
  token?: string
  isInternal?: boolean
  bells?: number
  userId?: string
  username?: string
}

export type BillingHarnessOptions = {
  apiBase?: string
  mocks?: MockFetchRule[]
  /** 未命中任何 rule 时的默认响应 */
  defaultHandler?: MockFetchHandler
}

const DEFAULT_API_BASE = 'https://billing-test.example/api'
/** 计费矩阵联调统一 API Base（与 mock fetch 对齐） */
export const TEST_API_BASE = DEFAULT_API_BASE
const PROBE_USER_TOKEN_PREFIX = 'probe-billing-test-token.'

let authSnapshot: { token: string | null; refreshToken: string | null; user: AuthUser | null } | null =
  null

type SettingsSnapshot = {
  settings: ReturnType<typeof useSettingsStore.getState>['settings']
  systemModelsByKind: ReturnType<typeof useSettingsStore.getState>['systemModelsByKind']
}

let settingsSnapshot: SettingsSnapshot | null = null
let windowSnapshot: (Window & typeof globalThis) | undefined

export type SeedBillingEnvOptions = {
  apiBase?: string
  videoCatalog?: ModelConfig[]
}

/** 从完整 URL 解析相对 API path（含 query） */
export function normalizeApiPath(url: string, apiBase = DEFAULT_API_BASE): string {
  const base = apiBase.replace(/\/+$/, '')
  if (url.startsWith(base)) {
    const rest = url.slice(base.length)
    return rest.startsWith('/') ? rest : `/${rest}`
  }
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

function parseRequestBody(init?: RequestInit): unknown {
  const raw = init?.body
  if (raw == null || raw === '') return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw
}

function matchRule(rule: MockFetchRule, path: string, request: MockFetchRequest): boolean {
  const { match } = rule
  if (typeof match === 'string') return path.includes(match)
  if (match instanceof RegExp) return match.test(path)
  return match(path, request)
}

function buildProbeUser(options: SeedAuthOptions): AuthUser {
  const bells = options.bells ?? 20
  return {
    id: options.userId ?? 'probe-user-1',
    username: options.username ?? 'probe_billing_user',
    nickname: 'Probe Billing',
    role: 'user',
    status: 'active',
    remaining_quota: bells,
    free_quota: bells,
    used_quota: 0,
    avatar_url: null,
    bells,
    is_internal: options.isInternal ?? false,
  }
}

let importMetaEnvPatched = false

/** Node/tsx 下 import.meta.env 可能为空，补齐以免 resolveApiBase / login-mode 抛错 */
export function ensureNodeImportMetaEnv(): void {
  if (importMetaEnvPatched) return
  const meta = import.meta as ImportMeta & { env?: Record<string, unknown> }
  if (!meta.env || typeof meta.env !== 'object') {
    meta.env = {}
  }
  const env = meta.env
  if (env.DEV === undefined) env.DEV = false
  if (env.PROD === undefined) env.PROD = true
  if (!env.VITE_API_BASE) env.VITE_API_BASE = TEST_API_BASE
  if (!env.VITE_LOGIN_REQUIRED) env.VITE_LOGIN_REQUIRED = 'true'
  importMetaEnvPatched = true
}

function createProbeSettings(apiBase: string): AppSettings {
  return {
    apiBaseUrl: apiBase,
    dataRootPath: '',
  } as AppSettings
}

/** Node 环境 stub settingsAPI.read，使 readSettings() 返回指定 apiBase */
export function installNodeSettingsStub(apiBase: string = TEST_API_BASE): void {
  if (windowSnapshot === undefined) {
    windowSnapshot = globalThis.window
  }
  const data = createProbeSettings(apiBase)
  const stub = {
    read: async () => ({
      success: true as const,
      fileExists: false,
      data,
      filePath: 'billing-test/settings.json',
      launcherDir: 'billing-test',
      dataRoot: '',
      appDataDir: 'billing-test',
    }),
    write: async () => ({ success: true as const }),
    bindDataRoot: async () => ({ success: false as const, error: 'billing-test stub' }),
  }
  globalThis.window = { settingsAPI: stub } as Window & typeof globalThis
}

export function uninstallNodeSettingsStub(): void {
  if (windowSnapshot === undefined) return
  globalThis.window = windowSnapshot
  windowSnapshot = undefined
}

/** 注入 settings-store catalog / apiBase（不触发 syncSystemModels） */
export function seedBillingTestEnv(options: SeedBillingEnvOptions = {}): void {
  const apiBase = options.apiBase ?? TEST_API_BASE
  installNodeSettingsStub(apiBase)

  if (!settingsSnapshot) {
    const state = useSettingsStore.getState()
    settingsSnapshot = {
      settings: state.settings,
      systemModelsByKind: state.systemModelsByKind,
    }
  }

  useSettingsStore.setState((state) => ({
    settings: state.settings
      ? { ...state.settings, apiBaseUrl: apiBase }
      : createProbeSettings(apiBase),
    systemModelsByKind: {
      ...state.systemModelsByKind,
      video: options.videoCatalog ?? state.systemModelsByKind.video,
    },
  }))
}

export function resetBillingTestEnv(): void {
  uninstallNodeSettingsStub()
  if (!settingsSnapshot) return
  useSettingsStore.setState({
    settings: settingsSnapshot.settings,
    systemModelsByKind: settingsSnapshot.systemModelsByKind,
  })
  settingsSnapshot = null
}
/** 注入 auth-store（不触发 setSession 的 syncSystemModels） */
export function seedAuthStore(options: SeedAuthOptions = {}): void {
  if (!authSnapshot) {
    const state = useAuthStore.getState()
    authSnapshot = {
      token: state.token,
      refreshToken: state.refreshToken,
      user: state.user,
    }
  }

  const loggedIn = options.loggedIn ?? true
  if (!loggedIn) {
    useAuthStore.setState({ token: null, refreshToken: null, user: null })
    return
  }

  const token = options.token ?? `${PROBE_USER_TOKEN_PREFIX}${Date.now()}`
  useAuthStore.setState({
    token,
    refreshToken: '',
    user: buildProbeUser(options),
  })
}

/** 恢复 seedAuthStore 前的 auth 状态 */
export function resetAuthStore(): void {
  if (!authSnapshot) {
    useAuthStore.setState({ token: null, refreshToken: null, user: null })
    return
  }
  useAuthStore.setState({ ...authSnapshot })
  authSnapshot = null
}

export function pathsFromCalls(calls: FetchCallRecord[]): string[] {
  return calls.map((item) => item.path)
}

export function assertBillingLog(calls: FetchCallRecord[], expect: BillingLogExpectation): void {
  const paths = pathsFromCalls(calls)
  const listing = paths.map((path, index) => `  ${index + 1}. ${path}`).join('\n')

  for (const fragment of expect.includes ?? []) {
    assert.ok(
      paths.some((path) => path.includes(fragment)),
      `Expected path including "${fragment}", got:\n${listing || '  (empty)'}`,
    )
  }

  for (const fragment of expect.excludes ?? []) {
    assert.ok(
      !paths.some((path) => path.includes(fragment)),
      `Expected no path including "${fragment}", got:\n${listing}`,
    )
  }

  for (const [earlier, later] of expect.orderBefore ?? []) {
    const earlierIndex = paths.findIndex((path) => path.includes(earlier))
    const laterIndex = paths.findIndex((path) => path.includes(later))
    assert.notEqual(earlierIndex, -1, `Expected path including "${earlier}", got:\n${listing}`)
    assert.notEqual(laterIndex, -1, `Expected path including "${later}", got:\n${listing}`)
    assert.ok(
      earlierIndex < laterIndex,
      `Expected "${earlier}" before "${later}", got:\n${listing}`,
    )
  }

  for (const group of expect.mutuallyExclusive ?? []) {
    const hit = group.filter((fragment) => paths.some((path) => path.includes(fragment)))
    assert.ok(
      hit.length <= 1,
      `Expected at most one of [${group.join(', ')}], hit [${hit.join(', ')}]:\n${listing}`,
    )
  }
}

/** 常用 billing mock 响应（可按场景覆盖） */
export function createDefaultBillingMocks(overrides: Partial<Record<string, MockFetchHandler>> = {}): MockFetchRule[] {
  const defaults: Record<string, MockFetchHandler> = {
    '/client/haodou/consume': () => ({
      json: {
        code: 0,
        data: { consumed: 3, balance: 17, model_key: 'sys_external_llm_probe' },
      },
    }),
    '/client/haodou/refund': () => ({
      json: { code: 0, data: { refunded: 3, balance: 20 } },
    }),
    '/client/system-models/chat': () => ({
      json: {
        code: 0,
        data: { content: 'ok' },
      },
    }),
    '/client/system-models/image': () => ({
      json: { code: 0, data: { url: 'https://example.com/mock.png' } },
    }),
    '/client/projects/consumption': () => ({
      json: {
        code: 0,
        data: {
          task_id: 'probe-task-llm',
          action: 'charge',
          duration_sec: 0,
          cost_yuan: '0.01',
          status: 'charged',
        },
      },
    }),
    '/v1/chat/completions': () => ({
      json: { choices: [{ message: { content: 'custom ok' } }] },
    }),
    '/client/projects/video-consumption': () => ({
      json: {
        code: 0,
        data: {
          task_id: 'probe-task-1',
          action: 'charge',
          duration_sec: 5,
          cost_yuan: '6.0',
          status: 'charged',
        },
      },
    }),
    ...overrides,
  }

  return Object.entries(defaults).map(([fragment, handler]) => ({
    match: fragment,
    handler,
  }))
}

export class FetchRecorder {
  readonly apiBase: string
  private calls: FetchCallRecord[] = []
  private order = 0
  private originalFetch: typeof globalThis.fetch | null = null
  private rules: MockFetchRule[] = []
  private fallbackHandler: MockFetchHandler

  constructor(options: BillingHarnessOptions = {}) {
    this.apiBase = (options.apiBase ?? DEFAULT_API_BASE).replace(/\/+$/, '')
    this.rules = options.mocks ?? createDefaultBillingMocks()
    this.fallbackHandler =
      options.defaultHandler ??
      ((request) => {
        throw new Error(`Unhandled mock fetch: ${request.method} ${request.path}`)
      })
  }

  get recordedCalls(): FetchCallRecord[] {
    return [...this.calls]
  }

  clear(): void {
    this.calls = []
    this.order = 0
  }

  addMock(rule: MockFetchRule): void {
    this.rules.unshift(rule)
  }

  install(): void {
    if (this.originalFetch) return
    this.originalFetch = globalThis.fetch

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
      const path = normalizeApiPath(url, this.apiBase)
      const body = parseRequestBody(init)

      this.order += 1
      this.calls.push({ order: this.order, url, method, path, body })

      const request: MockFetchRequest = {
        url,
        method,
        path,
        body,
        headers: new Headers(init?.headers),
      }

      const rule = this.rules.find((item) => matchRule(item, path, request))
      const handler = rule?.handler ?? this.fallbackHandler
      const response = await handler(request)
      const status = response.status ?? 200
      return new Response(JSON.stringify(response.json), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch
  }

  uninstall(): void {
    if (!this.originalFetch) return
    globalThis.fetch = this.originalFetch
    this.originalFetch = null
  }
}

/** 安装 harness → 执行 → 卸载并恢复 auth */
export async function runWithBillingHarness<T>(
  fn: (ctx: { recorder: FetchRecorder; apiBase: string }) => Promise<T>,
  options: BillingHarnessOptions = {},
): Promise<{ result: T; calls: FetchCallRecord[] }> {
  ensureNodeImportMetaEnv()
  const recorder = new FetchRecorder(options)
  recorder.install()
  try {
    const result = await fn({ recorder, apiBase: recorder.apiBase })
    return { result, calls: recorder.recordedCalls }
  } finally {
    recorder.uninstall()
    resetAuthStore()
    resetBillingTestEnv()
  }
}
