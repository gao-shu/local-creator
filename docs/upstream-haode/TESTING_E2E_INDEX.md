# Electron E2E 套件速查

> **更新日期**：2026-09-02  
> **权威来源**：`scripts/e2e/register-suites.mjs`（`npm run test:e2e:list`）  
> **覆盖矩阵 / 手工清单**：[`TESTING.md`](./TESTING.md) §3 · **排障 / flaky**：[`FULL_REGRESSION_CHECKLIST.md`](./FULL_REGRESSION_CHECKLIST.md) §5

**前置**：`npm run compile`。单跑：`node scripts/e2e/run.mjs <name>` 或下列 npm 别名。

当前 **46** 套件。历史 flaky 套件见 CHECKLIST §5（2026-09-02 已修）。

---

## 1. 套件一览

| 套件 | 说明 | 常用别名 |
|------|------|----------|
| `smoke` | Electron 启动、IPC、Dashboard / 设置 | `test:e2e:smoke` |
| `workshop-project-create` | 新建项目 → 落盘 → Step1 | `test:e2e:project` |
| `workshop-project-list-search` | 列表搜索 / 分页 / 每页条数 | `test:e2e:phase5-a` |
| `workshop-project-lifecycle` | 编辑标题落盘、移入回收站 | `test:e2e:lifecycle` |
| `canvas-list-smoke` | 画布列表搜索、进入编辑器 | `test:e2e:phase6-b` / `canvas-lifecycle` |
| `workshop-missing-data-root` | 未绑定数据根横幅 / 禁止新建 | `test:e2e:phase5-b` |
| `workshop-capcut-export` | Step4 导出至剪映 mock | `test:e2e:phase6-a-a` |
| `canvas-capcut-export` | 画布导出至剪映 mock | `test:e2e:phase6-a-b` |
| `workshop-capcut-no-clips` | Step4 无成片剪映拦截 | `test:e2e:phase6-a-c` |
| `canvas-capcut-no-clips` | 画布无成功视频剪映拦截 | `test:e2e:phase6-a-d` |
| `canvas-project-create` | 新建画布 → 落盘 → 编辑器 | `test:e2e:canvas-project` |
| `canvas-editor-flow` | 浮动工具栏加节点 + 自动保存 | `test:e2e:canvas-editor` |
| `canvas-restart-persistence` | 关 Electron 再开：节点持久化 | `test:e2e:canvas-restart` |
| `canvas-image-generate` | mock 生图 + 落盘 | — |
| `canvas-image-material-save` | 图片节点保存到全局素材库 | `test:e2e:canvas-material-save` |
| `canvas-image-edit` | Filerobot 编辑回写 | — |
| `canvas-image-edit-toolbar` | 预览展开顶栏更多按钮 | — |
| `canvas-generation-stop` | 停止 mock 生图 | — |
| `canvas-prompt-ai-cancel` | 智能分镜遮罩取消不落盘 | — |
| `canvas-prompt-ai-cancel-queue` | 智能分镜队列取消不落盘 | — |
| `canvas-prompt-extract-cancel` | 提取资产取消不落盘 | — |
| `canvas-agent-smoke` | 助手侧栏 smoke | — |
| `canvas-doubao-web-panel` | 豆包网页侧栏 | — |
| `canvas-video-generate` | mock 生视频 + 落盘 | — |
| `canvas-mock-failure` | mock 生图失败 + 可重试 | — |
| `canvas-agent-chat` | mock LLM 对话 | — |
| `global-libraries-smoke` | 素材/音色库 IPC + 清理 UI | `test:e2e:global-libraries` |
| `workshop-step3-material-import` | Step3 从素材库导入 | `test:e2e:step3-material-import` |
| `workshop-step3-material-save` | Step3 保存到素材库 | `test:e2e:step3-material-save` |
| `workshop-step4-material-reference` | Step4 参考图从素材库 | `test:e2e:step4-material-reference` |
| `workshop-flow` | 预置项目 Step1~4 主流程 | `test:e2e:workshop` |
| `workshop-from-scratch` | 仅剧本 → 分集 → 分镜 | `test:e2e:scratch` |
| `workshop-step1-import` | Step1 导入 .txt | `test:e2e:step1-import` |
| `workshop-step3-regenerate` | Step3 批量重新生成 | `test:e2e:step3-regen` |
| `workshop-step3-asset-crud` | Step3 资产 CRUD | `test:e2e:phase3-b` |
| `workshop-step-nav-during-generation` | 生图中切 Step | `test:e2e:phase4-a` |
| `workshop-step4-batch-video` | 批量 mock 生视频 | `test:e2e:phase4-b` |
| `workshop-step4-workbench` | 推理确认 / 剧本 / 放大窗 | `test:e2e:step4-workbench` |
| `workshop-step4-validate` | 补空间锚点 mock | `test:e2e:step4-validate` |
| `workshop-generation-stop` | 停止生图/生视频 | `test:e2e:stop` |
| `workshop-shot-edit` | 改 prompt / 增删分镜 | —（见 `phase4-c`） |
| `workshop-restart-persistence` | 关 Electron 再开持久化 | `test:e2e:restart` |
| `workshop-task-panel-actions` | 任务浮层终止/删除 | `test:e2e:task-panel` |
| `workshop-mock-failure` | mock 生图失败注入 | `test:e2e:mock-fail` |
| `workshop-multi-episode` | Step2 多集 Tab | `test:e2e:multi-episode` |
| `workshop-step2-episode-plan` | Step2 dirty / 全文预览 | `test:e2e:step2-episode-plan` |

---

## 2. 聚合别名

| 命令 | 含套件 |
|------|--------|
| `test:e2e` / `verify:e2e` | 全部 46 |
| `test:e2e:p0` | mock-failure → restart → task-panel |
| `test:e2e:p1` | list-search、lifecycle、canvas-list-smoke |
| `test:e2e:workshop-full` / `verify:e2e:workshop` | workshop-flow + from-scratch |
| `test:e2e:phase2` | project-create、step3-regen、stop、multi-episode、step2-episode-plan |
| `test:e2e:phase3-a` / `phase3-b` | step1-import / step3-asset-crud |
| `test:e2e:phase4-a` / `b` / `c` | step-nav / batch-video / workbench+shot-edit |
| `test:e2e:phase5` | list-search、lifecycle、missing-data-root |
| `test:e2e:phase6-a` | 剪映 4 套件（a~d） |
| `test:e2e:canvas-phase1`~`4` | 新建 / 编辑器+重启 / 生图侧 / 生视频侧 |
| `test:e2e:canvas-full` | 画布 **19** 套件（`test:e2e` 真子集） |
| `test:e2e:global-libraries-all` | 全局库相关 5 个 E2E |

Phase 对照表见 [`TESTING.md`](./TESTING.md) §3.6。

---

## 3. 排障速记

```bash
# PowerShell 保留现场
$env:HAODE_E2E_KEEP="1"; node scripts/e2e/run.mjs workshop-step4-workbench

# Windows Electron 残留
taskkill /F /IM electron.exe
```

详情：[`FULL_REGRESSION_CHECKLIST.md`](./FULL_REGRESSION_CHECKLIST.md) §5。
