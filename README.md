# 本地漫创（local-creator）

本地桌面端 AI 漫创工具：创作工坊 + 无限画布。  
**无需登录**；模型 Endpoint / API Key **自备**，第三方费用自理。本软件不提供云充值或公司后台。

> 当前为试用阶段仓库（建议保持私有）。品牌名「本地漫创」为占位。

## 环境要求

- Windows 10+（主要验证平台）
- Node.js 20+（建议 LTS）
- npm（仓库含 `package-lock.json`）

## 源码运行（试用）

```bash
git clone <本仓库地址>
cd local-creator
npm install
npm run dev
```

首次打开后：

1. **设置 → 存储位置**：选一个数据目录  
2. **设置 → 模型**：添加 LLM / 图片 / 视频（OpenAI 兼容等）并填 Key  
3. 点「测试」通过后，再进工坊或画布生成  

更短说明见 [docs/user-quickstart.md](docs/user-quickstart.md)。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发启动 |
| `npm run compile` | 生产构建（主进程 + 渲染进程） |
| `npm run test:e2e:smoke` | Mock E2E 冒烟（需先 compile） |

## 说明

- 无微视专用管道；视频请配置通用 OpenAI 兼容等服务。  
- 自动更新默认关闭（未配置 `VITE_UPDATE_PUBLISH_URL`）。  
- 详细设计与阶段文档在 [docs/](docs/README.md)；开发约定见 [AGENTS.md](AGENTS.md)。

## 许可证

试用阶段暂未选定开源许可证；未经许可请勿二次公开发布商业发行版。
