# 去 haode* 产品命名

> 日期：2026-09-10 · `local-creator`

## 目标

产品运行时与 E2E **不再出现** `haode` / `HAODE` / `haodou` / `浩德` 作为品牌前缀或环境变量名。

## 已完成（src / electron / e2e / 配置）

| 原 | 现 |
|----|-----|
| `haode:*` 事件 / sessionStorage | `lc:*` |
| `HAODE_E2E*` / `__HAODE_E2E_*__` | `LC_E2E*` / `__LC_E2E_*__` |
| `haode-capcut-drag` / `haode-updates` / `haode-data` | `lc-*` |
| `@haode/ai-core` | `@local-creator/ai-core` |
| `HAODE_UPDATE_PUBLISH_URL` define | `LC_UPDATE_PUBLISH_URL`（更新主路径仍用 `VITE_UPDATE_*`） |
| Copyright `Haode AI`（触及文件） | `local-creator contributors` |
| `probe:haodou` npm scripts | 已移除入口 |

陈旧公司域名清洗仍保留（`api-base.ts` 内拆字拼接，源码无连续 `haode` 字面量）。

## 验收

```text
# 期望 0
rg -n "haode|Haode|HAODE|haodou|浩德" src electron scripts/e2e package.json tsconfig.json electron.vite.config.ts
npm run compile
npm run test:e2e:smoke
```

- [x] 上列路径 0 命中  
- [x] compile + smoke 通过  

## 未做（W2b）

`scripts/` 下仍有大量废弃好豆/计费 probe（约 260+ 命中），**不进客户端包**。开源前可整批删除或移出仓库。
