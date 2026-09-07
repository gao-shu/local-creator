# 占位品牌与正式改名

## 当前占位（私有阶段）

| 项 | 值 |
|----|-----|
| 仓库/文件夹 | `local-creator` |
| 产品展示名 | 本地漫创 |
| package.name（建议） | `local-creator` |
| productName | 本地漫创 |
| appId（建议占位） | `com.localcreator.app` |
| 对外公开 | 否 |

## 正式改名时（一页检查表）

- [ ] `electron-builder.yml`：`appId`、`productName`、`executableName`、`shortcutName`
- [ ] `package.json`：`name`、`productName`
- [ ] `src/components/ui/app-logo.tsx`（或品牌常量文件）
- [ ] `index.html` / `electron/splash.html` 标题与文案
- [ ] 窗口标题（`electron/main.ts`）
- [ ] 更新 URL 与安装包文件名规则
- [ ] 数据目录/导出 zip 默认前缀
- [ ] 图标：`build/icon.ico` / `icns` / 安装器图标
- [ ] README / website（若有）
- [ ] 全仓 `rg` 旧名

## 开源注意

- `appId` 一旦有熟人安装，再改等于新产品；**公开前定死一次**。
- 勿使用「好的」「Haode」等公司商标。
