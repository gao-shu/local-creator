/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端 API 根地址，打包后客户端默认使用 */
  readonly VITE_API_BASE: string
  /** uploads 静态资源 Origin，可选 */
  readonly VITE_UPLOAD_ORIGIN?: string
  /** 开发态 Vite 代理目标（仅 electron-vite.config 读取） */
  readonly VITE_DEV_PROXY_TARGET?: string
  /** 环境标识 */
  readonly VITE_APP_ENV?: string
  /** 可选：TOS/CDN 公网 Origin，用于识别已上传对象存储 URL */
  readonly VITE_TOS_PUBLIC_ORIGIN?: string
  /** 桌面端自动更新 feed URL（下载与更新共用；改域名优先改此项） */
  readonly VITE_UPDATE_PUBLISH_URL?: string
  /** 侧边栏「官网」链接（HTML 落地页；勿填 TOS 对象存储地址） */
  readonly VITE_OFFICIAL_WEBSITE_URL?: string
  /** 站点根地址；未设 VITE_UPDATE_PUBLISH_URL 时自动拼 /haode-client/download */
  readonly VITE_UPDATE_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
