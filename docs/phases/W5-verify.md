# W5 · 功能验收（compile + mock e2e + 手测）

> 仓库：`local-creator` · 前置：W0～W4

## 自动化结果（2026-09-10）

| 项 | 结果 |
|----|------|
| `npm run compile` | 通过 |
| Mock E2E `smoke` | 通过 |
| `workshop-project-create` | 通过 |
| `canvas-list-smoke` | 通过 |
| `canvas-project-create` | 通过 |
| 汇总 | **4/4 通过** |

命令：

```text
npm run compile
node scripts/e2e/run.mjs smoke,workshop-project-create,canvas-list-smoke,canvas-project-create
```

## UI 文案

- `src/` 全文无「微视」
- `src/components`、`src/pages` 无「微视」用户可见文案

## 本机 API 探针（补充）

| 项 | 结果 | 说明 |
|----|------|------|
| Agnes LLM HTTP | 未通过 | settings Key 为 `enc:`，shell 无法解密；需应用内手测 |
| Agnes 图 / 拾光视频 | 未通过 | `127.0.0.1:3300` **未监听**（代理未开） |
| 配置修正 | 已做 | 本机拾光 `model` → `minimax_h3`；Agnes 图 `model` → `agnes-image-2.1-flash`（原先误存为显示名；Key 仍为 enc） |

## 应用内手测清单（待你确认）

代理就绪（拾光/图常用 `localhost:3300`）后，在客户端内：

1. **LLM**：用工坊文本步骤或对话跑一轮 Agnes  
2. **图片**：Agnes 生图一张  
3. **视频**：拾光 · minimax_h3 生一段短视频  

勾选后可将下表改为 `[x]`。

- [ ] 手测 LLM  
- [ ] 手测图片  
- [ ] 手测视频  

## 本轮不做

- Live API 自动化套件（方案 2）
- W2b scripts 清扫

## 结论

**W5 自动化验收通过**；真实 Agnes/拾光生成依赖本机代理 + 应用内解密 Key，需你在客户端补三轮手测。

微视删除主线 **W0～W5（自动部分）闭合**；开源前还可做 W2b。
