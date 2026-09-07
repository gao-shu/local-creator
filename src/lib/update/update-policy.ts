// Copyright (c) local-creator contributors. All rights reserved.

/**
 * L2：未配置自有更新地址时关闭应用内自动更新。
 * P6 接 Gitee Release / 网盘后设置 VITE_UPDATE_PUBLISH_URL 即可启用。
 */
export function isAutoUpdateEnabled(): boolean {
  const url = String(import.meta.env.VITE_UPDATE_PUBLISH_URL || '').trim()
  return Boolean(url)
}

export const AUTO_UPDATE_DISABLED_HINT =
  '当前未配置更新地址（私有阶段默认关闭）。新版本请使用发布者提供的安装包。'
