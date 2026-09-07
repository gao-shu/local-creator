# 删除清单 · 公司耦合（开源前必清）

> 来源对照：`../haode-ai-client`。导入本仓后以**本仓路径**为准执行删除。  
> 原则：**删文件 + 断引用 + compile 通过**。隐藏不算完成。

## A. 计费 / 好豆（整域删除）

| 类型 | 路径模式（导入后） |
|------|-------------------|
| 服务 | `src/lib/auth/haodou-*.ts`、`haodou-generation-guard.ts`、`haodou-labels.ts` |
| 展示 | `src/lib/auth/*billing*.ts`、`video-billing-display.ts`、`image-billing-display.ts` |
| UI | `src/components/settings/haodou-*.tsx`、`src/components/ui/haodou-icon.tsx`（若有） |
| 画布扣豆展示 | `src/lib/canvas/canvas-generate-haodou-display.ts` 及所有引用 |
| 账户页好豆区 | `account-tab` 内充值/流水区块 |

**验收 rg：**

```text
haodou|Haodou|好豆|runWithHaodouConsume|/client/haodou
```

期望：无业务命中（注释/历史 changelog 另议，changelog 应改写）。

## B. 系统模型 / 公司代理

| 类型 | 路径模式 |
|------|----------|
| 代理 | `src/lib/models/system-model-proxy.ts` |
| 目录拉取 | `src/lib/models/system-models-service.ts` |
| 路由/展示/单价 | `system-model-routing.ts`、`system-model-display.ts`、`system-model-unit-price*.ts` |
| 合并选择器 | `merged-model-picker.ts` 中 system 分支 |
| 视频 provider | `video-provider.ts` / `video-client.ts` / `video-remote-job.ts` 的 `system` |
| 设置 UI | `models-tab` 系统模型区 |

**验收 rg：**

```text
system-models|proxySystemModel|billingMode|proxyAvailable|source === 'system'
```

保留「用户自定义模型」即可；`ModelConfig.source` 若仅 custom，可简化类型。

## C. 公司登录云

| 类型 | 路径模式 |
|------|----------|
| 微信 | `wechat-auth-service.ts`、登录页微信 UI |
| 会话云刷新 | 依赖公司 `/client/` 的 profile 刷新 |
| 登录页 | 改为本地说明页或直接取消路由（默认进 dashboard） |
| AuthGuard | 仅本地会话 / 无登录 |

**默认策略：** `VITE_LOGIN_REQUIRED` 删除或永远 false；去掉「开启登录打包」公司云路径文档。

**验收 rg：**

```text
VITE_LOGIN_REQUIRED|wechat-auth|/client/auth|offline-local-token
```

`offline-local-token` 可保留为本地占位会话实现，但须改名去公司味（可选 P3）。

## D. 公司文件 / 即梦后台审核

| 类型 | 路径模式 |
|------|----------|
| 上传 | `client-file-service.ts`（`/client/files`） |
| 即梦审核 | `jimeng-asset-service.ts` 及 step3/画布「到即梦审核」 |
| 参考上传 backend_https | 设置项与分支删除，仅保留直连第三方或本地 |

微视 **用户自备 Key 直连**可保留（非公司服务器）。

**验收 rg：**

```text
jimeng-assets|client-file-service|/client/files|到即梦审核
```

## E. 公司品牌 / 站点 / 更新

| 类型 | 路径模式 |
|------|----------|
| 产品名常量 | `app-logo.tsx`、`index.html`、`splash.html`、`electron-builder.yml`、`package.json` |
| appId | `com.haode.ai.client` → 占位如 `com.localcreator.app` |
| ICP/域名 | `site-icp.ts`、`IcpFooter`、`website/` |
| 更新 URL | `update-config.ts`、`official-download-url.ts`、发版 skill |
| 版权头 | 批量替换为新项目版权或 SPDX |

**验收 rg：**

```text
好的漫创|好的AI|haodeweishi|com\.haode\.ai|haode-ai-client
```

开源前须清零（P4+附录）；P2 至少清掉运行时品牌与 API。

## F. 反馈 / 公司运营入口

- `feedback-service`、侧栏反馈若打公司 API → 删或改为 mailto/Issue 模板。
- 愿望箱等同理。

## G. 文档与脚本（导入后清理）

公司仓 docs 中大量「好的漫创 / 发版 TOS / 组织」：

- 策略：开源版 **重写 docs 索引**，删除或移出 `release-ship` 公司流程；保留架构中与本地相关的部分并改名。
- `deploy/`、公司 `DEPLOY.md`：删除或移到商业版私有仓。

## H. 删除顺序建议（降低编译痛苦）

1. 断 UI 入口（设置 tab、侧栏、生成 pill 好豆）  
2. 删服务文件  
3. 改 `video-client` / `llm-client` / `image-client` 去掉 system/haodou 分支  
4. 清类型与 store 字段  
5. 全仓 `rg` + `npm run compile`  
6. 再处理品牌字符串（可与 P4 合并）

## 保留（本地开源版需要）

- Electron + React 工坊 / 画布主流程  
- 用户自定义模型配置（OpenAI 兼容、微视 Key、Grok、智谱等**直连**）  
- 本地文件 / 便携数据目录  
- FFmpeg 抽音等本地能力（注意第三方许可证声明）
