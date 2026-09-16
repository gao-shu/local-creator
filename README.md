# 本地漫创（local-creator）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

本地桌面端 AI 漫剧/短剧创作工具：**创作工坊** + **无限画布**。  
**无需登录**；模型 Endpoint / API Key **自备**（BYOK），第三方 API 费用与服务条款由用户自负。本软件不提供云充值或公司后台。

> 品牌名「本地漫创」与 `com.localcreator.app` 当前为**占位**（正式名见发版前决策）。仓库公开须维护者授权；试用阶段可保持私有。

## 商业咨询

开源核（MIT）与可选商业能力的边界见 [docs/appendix-commercial-boundary.md](docs/appendix-commercial-boundary.md)。  
商务 / 支持意向可先开 Issue（模板就绪后）或联系维护者；**不影响**开源核独立使用。

## 环境要求

- Windows 10+（主要验证平台）
- Node.js 20+（建议 LTS）
- npm（仓库含 `package-lock.json`）

## 源码运行

```bash
git clone <本仓库地址>
cd local-creator
npm install
npm run dev
```

首次打开会出现 **首次运行向导**（也可稍后在设置中改）：

1. 选择数据存储目录  
2. 添加至少一个 **LLM 或图片** 模型（Endpoint + API Key）  
3. 点「测试」通过（或确认后跳过）→ 进入首页  

更短说明见 [docs/user-quickstart.md](docs/user-quickstart.md)。

## 截图

| 界面 | 说明 |
|------|------|
| 首页 | 工坊 / 画布入口（见 [docs/images/](docs/images/README.md)，待补 `01-home.png`） |
| 创作工坊 | 剧本→分镜流水线（待补 `02-workshop.png`） |
| 模型设置 | BYOK Endpoint / Key（待补 `03-settings-models.png`） |

> 正式公开前请用当前 UI 实机截图替换占位说明，避免泄露 Key。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发启动 |
| `npm run compile` | 生产构建（主进程 + 渲染进程） |
| `npm run test:e2e:smoke` | Mock E2E 冒烟（需先 compile） |

## 说明

- 成片策略：优先 **剪映/CapCut 草稿导出**；并规划 **最小导出 MP4** 作为无剪映时的兜底（见产品决策 D5）。  
- 无微视专用管道；视频请配置通用 OpenAI 兼容等服务。  
- 自动更新默认关闭（未配置 `VITE_UPDATE_PUBLISH_URL`）。  
- 详细设计与阶段文档在 [docs/](docs/README.md)；开发约定见 [AGENTS.md](AGENTS.md)。

## 许可证与免责

- 源代码以 **MIT** 许可，见 [LICENSE](./LICENSE)。  
- 第三方组件声明见 [NOTICE](./NOTICE)。  
- **免责**：使用本软件调用的任何第三方模型或云服务，其费用、可用性、内容合规与 ToS 均由用户自行承担；作者不对生成内容或第三方服务承担责任。  
- 商业壳与开源核关系：[docs/appendix-commercial-boundary.md](docs/appendix-commercial-boundary.md)。
