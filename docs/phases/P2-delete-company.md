# P2 · 删除公司耦合（开源底子关键）

## 目标

删除好豆、公司系统模型代理、公司云登录/上传/即梦审核主路径及相关 UI；**不是**长期隐藏。  
完成后业务上只保留：本地会话 + 用户自定义模型直连 + 工坊/画布。

## 前置

- [x] P1 `compile` 通过
- [x] 已读 [../delete-inventory.md](../delete-inventory.md)

## 总原则

1. 按清单 **A→F** 分域删除。  
2. 每域：删入口 → 删实现 → 修编译 → `rg` 验收。  
3. 禁止 `if (false)` 充当完成。  
4. 对照只读 `../haode-ai-client`，改的是**本仓**。

---

## 第 1 节 · 好生成路径上的好豆

### 步骤

1. `rg "runWithHaodouConsume|haodou|好豆" src electron`
2. 从 `video-client` / `image-client` / `llm-client` / canvas generate 调用链移除 guard。
3. 删除 `src/lib/auth/haodou-*.ts`、`haodou-generation-guard.ts` 等。
4. 删除/改造 `canvas-generate-haodou-display.ts`、生成 pill 上好豆展示 props。
5. `npm run compile`

### 验收

```powershell
rg -n "runWithHaodouConsume|/client/haodou|好豆" src electron
```

无业务命中。

---

## 第 2 节 · 系统系统模型

### 步骤

1. `rg "system-models|proxySystemModel|provider === 'system'|billingMode|proxyAvailable" src`
2. 删除 `system-model-proxy.ts`、`system-models-service.ts` 及 unit-price/display/routing。
3. `merged-model-picker` / settings `models-tab`：只保留 custom 模型列表。
4. `video-client` / `video-remote-job` / types：去掉 `system` provider 与 job API。
5. Store 中 `systemModelsByKind` 等字段删除并清理 hydrate。
6. `npm run compile`

### 验收

```powershell
rg -n "system-models|proxySystemModel|SystemModelVideo" src electron
```

---

## 第 3 节 · 删除公司登录与账户云能力

### 步骤

1. 登录路由：默认进入 dashboard；删除或掏空微信/短信公司云逻辑。
2. `auth-store`：仅本地 bootstrap；删除依赖公司 `/client/` 的 refresh（或改为 no-op）。
3. 设置页去掉「账户/充值」或整页删除；侧栏用户区改为「本地模式」。
4. 删除 `wechat-auth-service` 等。
5. `npm run compile`

### 验收

- 启动后无二维码登录墙（dev：`npm run dev` 人测）。
- `rg "wechat-auth|/client/auth"` 无业务命中。

---

## 第 4 节 · 删除公司上传与即梦审核

### 步骤

1. 删除 `client-file-service` 调用点；参考图改为本地/第三方直传策略（对齐原 local-auth-mode 行为并固化为唯一路径）。
2. 删除 `jimeng-asset-service` 与 UI「到即梦审核」。
3. 设置中删除 `backend_https` 上传模式。
4. `npm run compile`

### 验收

```powershell
rg -n "jimeng-assets|client-file-service|backend_https" src
```

---

## 第 5 节 · 反馈/运营入口

### 步骤

1. 删除打公司 API 的 feedback/愿望箱，或改为打开 GitHub/Gitee Issue URL（占位可先删）。
2. `compile`

---

## 第 6 节 · 全量 rg 闸门

```powershell
cd E:\work\project\cangku\local-creator
rg -n "好豆|haodou|/client/haodou|system-models|proxySystemModel|jimeng-assets|/client/files|wechat-auth|haodeweishi|com\.haode\.ai" src electron
npm run compile
```

允许残留：本仓 `docs/` 规划文中的说明性提及；**不允许** `src/`/`electron/` 业务残留。

品牌中文「好的漫创」可留到 P4 一并替换，但 **API 与好豆必须本阶段清完**。

## 提交建议

```text
refactor: remove company billing, system models, and cloud auth for open-source base
```

## 验收清单

- [x] delete-inventory A–D、F 在 `src`/`electron` 无业务命中
- [x] `npm run compile` 通过
- [x] 模型设置仅自定义模型
- [x] 无好豆 UI

完成记录：本地会话 + 自定义模型直连；公司 `/client/auth`、好豆、系统模型代理、即梦审核入口、`backend_https` 已移除。品牌/appId 留 P4。

## 下一步

人说：**执行 P3**
