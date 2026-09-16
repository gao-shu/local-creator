# OA2 · rg 证据（2026-09-15）

## 命令与结果摘要

### 1. 用户可见「即梦」文案（产品代码）

```powershell
rg -n "即梦" --glob "!node_modules/**" --glob "!docs/**" src electron
```

**结果（2026-09-15 复跑）**：无命中。

兼容保留（非 UI 文案）：

| 项 | 说明 |
|----|------|
| `layout_character_jimeng_three` | settings key，避免旧配置失效；UI 名「大头+三视图」 |
| `jimengAssetId` / `jimengAssetStatus` | 旧项目只读字段名 |
| `ReviewProvider = 'jimeng'` | 内部枚举；UI `providerLabel = '外部审核'` |

### 2. 公司禁词 / weishi（排除 docs）

```powershell
rg -n -i "weishi_api|好的漫创|Haode|haodou|好豆|好的 AI" --glob "!node_modules/**" --glob "!out/**" --glob "!docs/**" src electron
```

**结果（2026-09-15 复跑）**：`src/` / `electron/` **无命中**。  
（已修：`src/lib/video/openai-video-client.ts` 版权头改为 local-creator contributors。）

README 中「无微视专用管道」为说明性否定句，允许保留。

### 3. 例外：scripts 计价 / 探针回归

`scripts/` 下仍含历史 `haodou` / `weishi_api` / 好豆字样（如 `billing-*`、`test-*-pricing*`），且部分脚本仍 `import` 已删除的 `haodou-consume-service`。  
**判定**：非用户可见产品面；OA2 **记为例外不阻塞**。建议后续清理任务删除或改写（不在本节点扩大删脚本范围）。

### 4. 密钥模式扫描

```powershell
rg -n -i "sk-[a-zA-Z0-9]{10,}|api[_-]?key\s*[:=]\s*['\"][^'\"]{8,}" --glob "!node_modules/**" --glob "!package-lock.json" --glob "!docs/**"
```

**命中摘要（可解释）**：

| 文件 | 说明 |
|------|------|
| `scripts/lib/billing-call-fixtures.ts` | 测试夹具 `apiKey: 'sk-probe-test'` |
| `scripts/test-zhipu-video-live.mjs` | CLI 参数解析 `--api-key=`，非硬编码密钥 |

无真实生产密钥提交。

## 代码改动（本节点相关）

- `layout-presets.ts`：展示名「大头+三视图」
- `asset-review-status.ts`：`providerLabel = '外部审核'`
- `openai-video-client.ts`：去「好的 AI」版权头
- 注释去品牌化（workflow / settings-defaults 等）
- `build/installer.nsh`：首行注释改为 `local-creator`（去 Haode）

## AI 自检

| 标准 | 结果 |
|------|------|
| A2.1 产品路径禁词 | 通过（`src/` / `electron/` 无命中；`scripts/` 记例外） |
| A2.3 compile | 通过（2026-09-15 `npm run compile`） |
| A2.4 密钥扫描 | 通过（夹具已解释） |
| A2.2 UI 无「即梦」 | **待人** L4 |
