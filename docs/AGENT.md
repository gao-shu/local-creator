# AGENT · AI 执行规范

本文件约束在 **local-creator** 内协助开发的 AI。人指挥时说「执行 Pn」即激活对应阶段。

## 硬性禁止

1. **禁止修改** `E:\work\project\cangku\haode-ai-client` 的业务代码（除非用户明确说「改公司仓」）。
2. **禁止**把公司 `.env`、API Key、内网地址、客户数据提交进本仓。
3. **禁止**用「隐藏 UI / 环境变量关掉」代替 P2 的**删除**目标（迁移期临时除外，须在清单留 TODO）。
4. **禁止**擅自公开 Gitee/GitHub 或改 `appId` 为正式对外值（占位阶段）；开源 GTM 须 [oss-gtm-decisions.md](oss-gtm-decisions.md) 已锁定且人授权。
5. **禁止**在未读当前阶段档（`phases/P*.md` / `OA|OB|OC-phase-*.md`）时整仓大重构。
6. **禁止**把即梦本地、完全离线大模型塞进 L2 / OA 默认范围。
7. **禁止**在 GTM 节点未满足「审核标准」时宣称该节点或阶段完成；人审项不得代勾。
8. **禁止**阉割开源核主路径以推销商业壳（见 [03-oss-gtm-overview.md](03-oss-gtm-overview.md) 三层结构）。

## 允许

1. 只读参考 `../haode-ai-client`（`rg` / 读片段）。
2. 仅在 `local-creator` 内增删改文件、提交（用户要求时再 commit）。
3. 按阶段跑 `npm run compile`；P5 才打包。

## 每阶段开工模板（AI 须先输出）

```text
Tier: 本阶段任务分级（文档/删耦/打包）
Read: 将读的本仓 docs + 最多 N 个参考文件
Skip: 不读的大文档/外仓无关部分
Verify: 本阶段验收命令
Delete-or-not: 本阶段是否删除公司耦（P2=是）
```

## 对照参考（只读）

| 主题 | 公司仓参考（路径相对 haode-ai-client） |
|------|----------------------------------------|
| 本地登录开关 | `src/lib/auth/login-mode.ts`、`.cursor/skills/local-auth-mode/SKILL.md` |
| 好豆/计费 | `src/lib/auth/haodou-*.ts`、`src/components/settings/haodou-*.tsx` |
| 系统模型 | `src/lib/models/system-model*.ts`、`system-models-service.ts` |
| 产品名 | `src/components/ui/app-logo.tsx`、`electron-builder.yml` |
| 更新 | `electron/main/update-config.ts` |
| 删除清单细目 | 本仓 `docs/delete-inventory.md` |

## 验收口令

- 人说「P2 验收」→ AI 按该阶段「验收」节执行 `rg` + `compile`，列出剩余命中并判是否可勾选完成。
- 人说「OA1 验收」/「OA 阶段验收」→ AI 按 [oss-gtm-review-rubric.md](oss-gtm-review-rubric.md) + 对应节点「审核标准」跑 AI 可执行项，填写验收记录草案；**人审项仅列出待勾选**。
- 未通过不得宣称节点/阶段完成；未过 OA 不得开始 OB（除非人书面特批）。

## Commit 约定（本仓）

- Conventional Commits。
- 不要在 commit 中包含 `好的漫创` 安装包产物、`out/`、密钥。
- 用户未要求 commit 时不要提交。
