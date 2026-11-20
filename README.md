# 本地漫创（local-creator）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

本地桌面端 AI 漫剧/短剧创作工具：**创作工坊** + **无限画布**。  
**无需登录**；模型 Endpoint / API Key **自备**（BYOK）。第三方 API 费用与服务条款由用户自负；本软件不提供云充值或托管模型。

> 品牌名「本地漫创」与 `com.localcreator.app` 当前为**占位名**，正式品牌以维护者后续公告为准。

## 功能边界

| 有 | 无（本期） |
|---|---|
| 创作工坊（剧本 → 分镜） | 公司账号 / 微信登录 |
| 无限画布 | 云充值、系统代理模型 |
| 自配 LLM / 生图 / 视频（OpenAI 兼容等） | 微视专用管道、完全离线大模型推理 |
| 导出剪映（CapCut）草稿 | 打包进仓的安装包二进制 |

## 环境要求

- Windows 10+（主要验证平台）
- Node.js 20+（建议 LTS）
- npm（仓库含 `package-lock.json`）

## 源码运行

```bash
git clone https://github.com/gao-shu/local-creator.git
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

> 实机截图由维护者补齐后替换下列占位；拍摄时请打码真实 API Key。清单见 [docs/images/README.md](docs/images/README.md)。

| 界面 | 占位 | 说明 |
|------|------|------|
| 首页 | `docs/images/01-home.png` | 工坊 / 画布入口 |
| 创作工坊 | `docs/images/02-workshop.png` | 剧本 → 分镜流水线 |
| 模型设置 | `docs/images/03-settings-models.png` | BYOK Endpoint / Key |

当前仓库尚未附带 PNG；欢迎按上表尺寸与内容贡献截图（Issue / PR）。

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发启动 |
| `npm run compile` | 生产构建（主进程 + 渲染进程） |
| `npm run build:win` | Windows NSIS 安装包（产物在 `release/`，勿提交） |
| `npm run test:e2e:smoke` | Mock E2E 冒烟（需先 compile） |

## 说明

- 成片：优先 **剪映/CapCut 草稿导出**；规划中的 **最小导出 MP4** 作为无剪映时的兜底。  
- 视频请自行配置通用 OpenAI 兼容等服务（无品牌内置视频管道）。  
- 自动更新默认关闭（未配置 `VITE_UPDATE_PUBLISH_URL`）。  
- 设计与阶段文档：[docs/](docs/README.md)；Agent 约定：[AGENTS.md](AGENTS.md)。

## 商业咨询

开源核（MIT）与可选商业能力的边界见 [docs/appendix-commercial-boundary.md](docs/appendix-commercial-boundary.md)。  
商务 / 支持意向请开 [Issue](https://github.com/gao-shu/local-creator/issues)；**不影响**开源核独立使用。

## 许可证与免责

- 源代码以 **MIT** 许可，见 [LICENSE](./LICENSE)。  
- 第三方组件声明见 [NOTICE](./NOTICE)。  
- **免责**：使用本软件调用的任何第三方模型或云服务，其费用、可用性、内容合规与 ToS 均由用户自行承担；作者不对生成内容或第三方服务承担责任。  
- 贡献默认按本仓库 MIT 许可授权；重大变更请先开 Issue 讨论。
