import { defineConfig, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = __dirname
const src = path.resolve(root, './src')
const appVersion = JSON.parse(readFileSync(path.resolve(root, 'package.json'), 'utf8')).version as string

const cjsEntry = (entry: string) => ({
  build: {
    rollupOptions: {
      input: { index: path.resolve(root, entry) },
      output: { format: 'cjs' as const },
    },
  },
})

/** 开发态 /api、/uploads 代理默认联调机（与 DEFAULT_LOCAL_API_BASE 一致） */
const DEFAULT_DEV_PROXY_TARGET = 'http://8.141.97.65'

function resolveDevProxyTarget(env: Record<string, string>): string {
  const explicit = env.VITE_DEV_PROXY_TARGET?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  const apiBase = env.VITE_API_BASE?.trim()
  if (apiBase) {
    const normalized = apiBase.replace(/\/+$/, '')
    if (normalized.endsWith('/api')) {
      return normalized.slice(0, -'/api'.length)
    }
    try {
      const parsed = new URL(normalized.startsWith('http') ? normalized : `https://${normalized}`)
      return parsed.origin
    } catch {
      /* fall through */
    }
  }

  return DEFAULT_DEV_PROXY_TARGET
}

function createDevProxy(proxyTarget: string) {
  return {
    target: proxyTarget,
    changeOrigin: true,
    configure: (proxy: { on: (event: string, handler: (...args: unknown[]) => void) => void }) => {
      proxy.on('error', (_err, _req, res) => {
        const response = res as { writeHead?: (code: number, headers: Record<string, string>) => void; end?: (body: string) => void } | undefined
        if (!response?.writeHead || !response?.end) return
        response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
        response.end(
          JSON.stringify({
            code: -1,
            message: `开发代理无法连接后端 ${proxyTarget}，请确认 Docker 已启动或配置 VITE_DEV_PROXY_TARGET`,
            data: null,
          }),
        )
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = resolveDevProxyTarget(env)
  const proxy = createDevProxy(proxyTarget)

  return {
    main: {
      resolve: { alias: { '@': src } },
      define: {
        'process.env.VITE_UPLOAD_ORIGIN': JSON.stringify(env.VITE_UPLOAD_ORIGIN ?? ''),
        'process.env.VITE_UPDATE_PUBLISH_URL': JSON.stringify(env.VITE_UPDATE_PUBLISH_URL ?? ''),
        'process.env.VITE_UPDATE_ORIGIN': JSON.stringify(env.VITE_UPDATE_ORIGIN ?? ''),
        'process.env.HAODE_UPDATE_PUBLISH_URL': JSON.stringify(env.HAODE_UPDATE_PUBLISH_URL ?? ''),
      },
      ...cjsEntry('electron/main.ts'),
    },
    preload: cjsEntry('electron/preload.ts'),
    renderer: {
      root: '.',
      define: {
        __APP_VERSION__: JSON.stringify(appVersion),
      },
      build: { rollupOptions: { input: { index: path.resolve(root, 'index.html') } } },
      resolve: {
        alias: {
          '@': src,
          '@haode/ai-core': path.resolve(src, './packages/ai-core/index.ts'),
        },
      },
      plugins: [react()],
      server: { port: 15173, proxy: { '/api': proxy, '/uploads': proxy } },
    },
  }
})
