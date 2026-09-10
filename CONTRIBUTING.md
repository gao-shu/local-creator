# 贡献指南

> 试用阶段仓库；品牌「本地漫创」为占位。

## 开发环境

```bash
npm install
npm run dev
```

要求：Node.js 20+，npm 9+。见根目录 [`README.md`](./README.md)。

## 提交

- 默认在 `master` / `main` 上开发
- Conventional Commits：`feat:` / `fix:` / `docs:` / `refactor:` / `chore:`
- **不要**提交 `.env`、API Key、本机 `settings.json`

## 自测

| 改动 | 最低要求 |
|------|----------|
| 小 fix | `npm run compile` |
| 工坊 / 画布流程 | `npm run compile` 后按需 `npm run test:e2e:smoke` |
| 打包相关 | `npm run build:win`（本机） |

更完整说明见 [`docs/user-quickstart.md`](./docs/user-quickstart.md)。
