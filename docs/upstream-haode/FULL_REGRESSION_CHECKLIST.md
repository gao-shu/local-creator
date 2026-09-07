# 全量回归勾选表

> **更新日期**：2026-09-02  
> **职责**：今天跑什么、发版签字、排障。命令细节见 [`TESTING.md`](./TESTING.md)。

**只记三句**：① 改完代码 `npm run compile` → ② 发版前 `npm run verify:all` → ③ 偶发红了看 **§5**，再查 [`TESTING_E2E_INDEX.md`](./TESTING_E2E_INDEX.md)（baseline 见 **§0.5**）。

---

## 0. 命令怎么选（避免混淆）

### 五个主命令（优先记这些）

| 命令 | 何时用 |
|------|--------|
| `npm run compile` | **每次改代码后** |
| `npm run verify:all` | **正式发版**（P0 → P1） |
| `npm run verify:full` | 只跑 P0 Mock 主线 |
| `npm run verify:e2e` | 只跑 46 个 E2E + compile |
| `npm run verify` | compile + 浏览器 UI（需先 `dev`） |

专项：`verify:p1`（P1 单跑）、`verify:ui` / `verify:canvas-ui`（见 §3，**不进 verify:all**）。

**历史别名**（勿优先使用）：`verify:release` = `verify:full`，`verify:release:all` = `verify:all` — 见 [`TESTING.md`](./TESTING.md) §8.1。

**Phase 2–6 / `test:e2e:phase*`**：缩小 E2E 范围用；套件表见 [`TESTING_E2E_INDEX.md`](./TESTING_E2E_INDEX.md) §2。发版以 P0/P1/`verify:all` 为准。

---

## 0.5 当前 baseline（**当前应全绿 · 2026-09-02**）

> **发版签字条件**见 **§1.5**。下列 P0 脚本与主要 flaky E2E 已于 2026-09-02 批 1–3 修复并通过本地验收；**发版前仍须**跑通 `npm run verify:all`（无登录：`VERIFY_ALL_SKIP_AUTH=1` 并记录原因）。

| 批次 | 范围 | 状态 |
|------|------|------|
| 批 1 | P0 纯逻辑：`test-storyboard-all`、`test:ffmpeg-layer-a`、`smoke:billing` | ✓ |
| 批 2 | E2E：`workshop-missing-data-root`、`workshop-step4-workbench`、`canvas-capcut-export` | ✓ |
| 批 3 | E2E：`canvas-capcut-no-clips`、`canvas-prompt-extract-cancel`、`canvas-doubao-web-panel` | ✓ |

全绿耗时约 **5–15 分钟**。

---

## 1. P0 自动化（`verify:full`）

| # | 线 | 勾选 |
|---|-----|------|
| A | compile | |
| B | E2E 全套 **46** 套件（Mock AI，含 P1 列表三件套） | |
| C | `test:canvas-p0` | |
| D | `test:global-libraries`（E2E 五件套已在 B 中） | |
| E | `test:storyboard-all` | |
| F | `test:ffmpeg-layer-a`（6 项，非 FFmpeg 全量；见 [`TESTING_FFMPEG.md`](./TESTING_FFMPEG.md)） | |
| G | 计价：`smoke:billing` 一次 + 图片/视频 Layer A | |

```bash
npm run verify:full
```

**耗时**：全绿约 **5–15 分钟**（视机器；E2E 占大部分）。

跳过：

```bash
VERIFY_FULL_SKIP_E2E=1 npm run verify:full
VERIFY_FULL_SKIP_PRICING=1 npm run verify:full
```

---

## 1.5 发版签字（Tier S 门禁）

### 必须（签字范围内，目标全绿）

- [ ] `npm run verify:all` 通过（本地无登录：`VERIFY_ALL_SKIP_AUTH=1`，并记录原因）
- [ ] §1 P0 七线（A–G）与 §2 P1 四线（P1-A 可因 full 已跑而跳过）无新增失败
- [ ] §0.5 baseline 仍为「当前应全绿」（若有新增红项须更新 §0.5 后再签）

### 强烈建议（Tier B，**不挡签字**）

- [ ] `dev` + `npm run verify:ui`（改路由/壳层；**Windows 发版前推荐**）
- [ ] `npm run test:ffmpeg-layer-b`（抽音 UI 入口；**微视无关**，不进 `verify:full`）
- [ ] `npm run verify:ffmpeg-win-pack`（Windows 打包发版）
- [ ] §4 手工：按本次改动选 Q–V 中相关项（**微视开白 / 微视审核除外**；抽音 / 真实 API 计价等仍建议）

### 不纳入签字（Tier B，6～7 分即可）

CI 远端流水线、`scan:security`、live API E2E、设置页 CRUD E2E、分镜审核自动化 — 见 §7 规划项。

与 [`RELEASE.md`](./RELEASE.md) §2 步骤 0 / 0b 对齐。

---

## 2. P1 自动化（`verify:p1`）

| # | 线 | 勾选 | 说明 |
|---|-----|------|------|
| P1-A | `test:e2e:p1` 或 phase5-a / lifecycle / phase6-b | | 已在 P0 `test:e2e` 中；`verify:all` 默认**跳过**重复跑 |
| P1-B | `test:video-progress-reopen` | | 视频重开进度纯逻辑 |
| P1-C | `test:canvas-logic-extra` | | 队列排序 / 运行历史 / 拖入脚本 |
| P1-D | `verify:auth` | | 登录 API + UI |

```bash
npm run verify:p1
```

跳过：

```bash
VERIFY_P1_SKIP_E2E=1 npm run verify:p1
VERIFY_P1_SKIP_AUTH=1 npm run verify:p1
VERIFY_P1_SKIP_CANVAS_LOGIC=1 npm run verify:p1
VERIFY_P1_SKIP_COMPILE=1 npm run verify:p1
```

**完整发版**：

```bash
npm run verify:all
VERIFY_ALL_SKIP_AUTH=1 npm run verify:all          # 本地无登录
VERIFY_ALL_RUN_P1_E2E=1 npm run verify:all         # 强制再跑 P1 三件套 E2E
VERIFY_ALL_SKIP_CANVAS_LOGIC=1 npm run verify:all
```

**P1 怎么跑（避免重复 E2E）**：

| 情况 | 命令 |
|------|------|
| 刚跑完 `verify:full` | `VERIFY_P1_SKIP_E2E=1 npm run verify:p1`（或直接用 `verify:all`） |
| 只改了列表 / 生命周期 / 画布列表 | `npm run test:e2e:p1` |
| 只改了登录 / 视频进度 / 画布队列 | `VERIFY_P1_SKIP_E2E=1 npm run verify:p1` |
| 本地无微信登录 | `VERIFY_ALL_SKIP_AUTH=1 npm run verify:all` |

---

## 3. 发版可选（不进 verify:all · 不挡 §1.5 签字）

> **`verify:ui` 不在 `verify:all` 内**（需先 `dev`）。**Windows 正式发版：强烈建议** `dev` + `npm run verify:ui`（见 §1.5）。

| # | 场景 | 命令 |
|---|------|------|
| I | 浏览器 UI 冒烟 | `dev` + `npm run verify:ui` |
| J | 画布 UI 布局 | `npm run verify:canvas-ui` |
| K | 安全扫描 | `npm run scan:security` |
| L | Windows FFmpeg 打包 | `npm run verify:ffmpeg-win-pack` |
| M | 视频能力纯逻辑 | `npm run test:video-capability` |
| N | 改画布 E2E 全集 | `npm run verify:e2e:canvas-full`（19 套件，见 [`TESTING_E2E_INDEX.md`](./TESTING_E2E_INDEX.md)） |
| O | 改工坊主流程 | `npm run verify:e2e:workshop` |
| P | 画布 E1 历史专项 | `verify:canvas-e1` / `verify:canvas-e1-1`（见 TESTING §4） |

---

## 4. 手工（真实 API）

| # | 场景 | 参考 |
|---|------|------|
| Q | Step4 主闭环 | TESTING §3 |
| R | 画布智能分镜 P0 | TESTING §3 |
| S | 分镜审核（非微视路径） | TESTING §3.4 手工；**微视开白不纳入发版必测**（见 [`STORYBOARD_IMAGE_REVIEW.md`](./STORYBOARD_IMAGE_REVIEW.md)） |
| T | 图片分档真实扣费 | [`TESTING_PRICING.md`](./TESTING_PRICING.md) §2.2 |
| U | 画布 / Step4 抽音 | [`TESTING_FFMPEG.md`](./TESTING_FFMPEG.md) §2 |
| V | 真实视频（Agnes 2.5 等） | `npm run test:agnes-video-25`（Key 勿提交） |

---

## 5. 排障 / 环境 / 已知问题

### E2E 偶发超时（历史 flaky 已修；仍失败时单套件重跑）

| 套件 | 常见现象 |
|------|----------|
| `workshop-missing-data-root` | 设置页加载 / 便携目录输入框超时 |
| `workshop-step4-workbench` | 推理确认 / 放大编辑窗 / 手动保存超时 |
| `canvas-capcut-export` / `canvas-capcut-no-clips` | 导出成片弹窗 / 剪映 mock 控件超时 |
| `canvas-prompt-extract-cancel` | 取消遮罩点击不稳定 |
| `canvas-doubao-web-panel` | 豆包侧栏 `getState` 与 React 壳不同步 |

**Windows**：上一套件 Electron 未退出时下一套件会卡住 → `taskkill /F /IM electron.exe` 后重跑。  
**保留现场**：`$env:HAODE_E2E_KEEP="1"; node scripts/e2e/run.mjs <套件名>`

### 前置条件

| 项 | 要求 |
|----|------|
| E2E | 先 `npm run compile`；勿并行多个 E2E |
| FFmpeg Layer A | `vendor/ffmpeg/win/ffmpeg.exe` + `ffprobe.exe` |
| `verify:ui` / `verify:canvas-ui` | 先 `npm run dev`，设 `UI_BASE_URL` |
| 计价 Layer C | 兄弟仓 `haode-ai-admin/backend` + pytest（可选） |

---

## 6. 按需脚本（未进 verify:full / verify:p1）

改相关模块时手动跑；**发版不强制**。

| 命令 | 用途 |
|------|------|
| `npm run test:ffmpeg-layer-b` | 抽音 UI 入口 / 音色库 / 范围（发版建议；不进 verify:full） |
| `npm run test:video-capability` | 视频能力 F/G/H 纯逻辑 |
| `npm run test:agnes-video-25` | Agnes 2.5 真实 API |
| `npm run test:agnes-litellm-poll-id` | Agnes LiteLLM 轮询 ID |
| `npm run test:dev-adhoc` | 开发用杂项脚本聚合（= `test:dev-scripts`） |
| `npm run verify:global-libraries` | 全局库 compile + 纯逻辑 + E2E 五件套 |

---

## 7. 规划项（Tier B · 不挡发版签字）

下列能力 **6～7 分即可**；未自动化不视为发版缺陷。详见 §1.5「不纳入签字」。

| 能力 | 状态 |
|------|------|
| 组织项目新建 | 产品已弱化；文档/E2E 不覆盖 |
| 视频任务恢复 vs 节点 UI（E2E） | 纯逻辑已有；完整 E2E 待补 |
| 分镜审核（通用 UI） | 可选手工；**微视开白 / assets 上传不挡签字** |
| 设置页模型 CRUD | 无专项 E2E |
| 真实 API live E2E | P2 `workshop-live` 未实现 |
| Mock 部分成功 / 超时 | P2 增强 |

---

## 8. 相关文档

- 命令百科：[`TESTING.md`](./TESTING.md)
- E2E 套件速查：[`TESTING_E2E_INDEX.md`](./TESTING_E2E_INDEX.md)
- 计价：[`TESTING_PRICING.md`](./TESTING_PRICING.md)
- FFmpeg 抽音：[`TESTING_FFMPEG.md`](./TESTING_FFMPEG.md)
- 画布：[`CANVAS_MODULE_REVIEW_AND_CHECKLIST.md`](./CANVAS_MODULE_REVIEW_AND_CHECKLIST.md)
- 发版：[`RELEASE.md`](./RELEASE.md)
