# 图片 / 视频模型分档计价测试

> **更新日期**：2026-09-02  
> **不进 verify:full 的扩展说明**（Layer A 已在 P0；Layer B 在 full 内去重）。  
> 发版勾选见 [`FULL_REGRESSION_CHECKLIST.md`](./FULL_REGRESSION_CHECKLIST.md) · 入口索引 [`TESTING.md`](./TESTING.md)

---

## 1. Layer B 去重（verify:full）

`verify:full` 内对图片/视频计价 **只跑一次** `smoke:billing`，再跑两路 Layer A（`PROBE_SKIP_BILLING=1`）。  
单独 `verify:image-pricing` / `verify:video-pricing` 仍会各自跑 billing。

```bash
PROBE_SKIP_BILLING=1 npm run verify:image-pricing
PROBE_SKIP_BILLING=1 npm run verify:video-pricing
```

**baseline**：`smoke:billing` 已于 2026-09-02 全绿，见 CHECKLIST §0.5。

---

## 2. 图片模型分档计价（Phase D Step 12）

设计文档（admin 仓）：`docs/design/image-model-pricing-client.md`

### 2.1 自动化

```bash
npm run verify:image-pricing
```

| Layer | 命令 | 覆盖 |
|-------|------|------|
| A | `test:image-pricing` | 分档 meta 映射、quote 同步、分组下拉、tier UI helper、代理 payload、费用预览文案 |
| B | `compile` + `smoke:billing` | 计费矩阵 T1–T8 + 图片 `group_name` / `pricing_summary` 下拉 |
| C | admin `pytest`（兄弟仓存在时） | `/client/models` · quote · 代理按 resolution/quality 扣豆 |

```bash
npm run test:image-pricing          # 仅 Layer A
PROBE_SKIP_COMPILE=1 npm run verify:image-pricing
PROBE_SKIP_BACKEND=1 npm run verify:image-pricing
PROBE_SKIP_BILLING=1 npm run verify:image-pricing
```

### 2.2 手工验收（真实 API · 约 15 分钟）

**前置**：测试环境已部署 Phase C 后端；客户端 dev 或打包版；内部员工账号 + 足够好豆。

| # | 场景 | 操作 | 预期 |
|---|------|------|------|
| 1 | flat 模型 | 设置页查看 flat 图片模型 → 生图（默认参数） | 列表豆数、费用预览、实扣与改前一致；无分辨率/质量下拉 |
| 2 | by_resolution | 选 by_resolution 模型 → 1K / 4K 各生一张 | quote 与预览一致；代理实扣相同 |
| 3 | by_quality_resolution | 切换质量 + 分辨率 | 预览随选择变化；实扣与 `POST /client/models/quote` 一致 |
| 4 | 同组多通道 | 同 `group_name` 两渠道切换 | 下拉分组正确；切换后 tier 控件与计价摘要更新 |
| 5 | 代理失败退还 | 故意触发代理失败（断网或无效 key） | 预扣好豆退还；toast 明确 |
| 6 | 旧客户端兼容 | 未升级包登录（若有） | 可登录；flat 模型仍可用 |

```bash
npm run verify:image-pricing
```

---

## 3. 视频模型分档计价（Phase 5 Step 11）

设计文档（admin 仓）：`docs/design/video-model-pricing-client.md`

### 3.1 自动化

```bash
npm run verify:video-pricing
```

| Layer | 命令 | 覆盖 |
|-------|------|------|
| A | `test:video-pricing` | 5A–5G：DTO 映射、好豆预估、代理 payload、设置页/下拉、分辨率选择器、费用预览 |
| B | `compile` + `smoke:billing` | 计费矩阵 T1–T8 + 视频分档 Phase4b smoke |
| C | admin `pytest`（兄弟仓存在时） | `/client/models` · quote · 代理/消耗按 resolution 扣豆 |

```bash
npm run test:video-pricing              # 仅 Layer A（5A–5G 全量）
npm run test:video-pricing-5g           # 单步调试
PROBE_SKIP_COMPILE=1 npm run verify:video-pricing
PROBE_SKIP_BACKEND=1 npm run verify:video-pricing
PROBE_SKIP_BILLING=1 npm run verify:video-pricing
```
