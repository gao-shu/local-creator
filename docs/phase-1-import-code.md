# Phase 1 · 迁入代码

状态：未开始  
前置：Phase 0 完成  
禁止：本阶段不删公司功能、不大改品牌（只迁入 + 能装依赖 + 能 compile）

## 目标

把 `../haode-ai-client` 的**可构建源码**落到本仓，成为独立 git 历史的起点（可保留一次 import commit）。

## 操作步骤（人 / AI）

### 1.1 确认磁盘

- 源：`E:\work\project\cangku\haode-ai-client`
- 目标：`E:\work\project\cangku\local-creator`
- 目标目前应几乎只有 `README.md`、`docs/`、`.git`

### 1.2 复制范围

**复制：**

- `electron/`
- `src/`
- `build/`（图标等打包资源）
- `scripts/`（构建脚本；迁入后可再删公司专用脚本）
- `vendor/`（若存在 ffmpeg 等，按源仓实际）
- `package.json`、`package-lock.json` 或 `pnpm-lock.yaml`（与源仓锁文件策略一致）
- `electron.vite.config.*`、`tsconfig*.json`、`tailwind*`、`postcss*`、`components.json` 等构建配置
- `electron-builder.yml`
- `index.html`（若在根或 src 旁，按源仓结构）
- `.gitignore`（合并：保留本仓 docs，勿忽略 `docs/`）
- `resources/`（若有）

**不要复制：**

- `node_modules/`
- `out/`、`.pack-tmp/`、`dist/`、发布产物
- `.env`、`.env.*.local`（含密钥）
- `.git/`（不要嵌套；在目标仓用当前 git）
- `.codegraph/`、`.cursor/` 大缓存（可选：可复制 `.cursor/rules` 中与本地产品有关的精简规则，**不要**复制公司发版密钥类 skill 内容）
- `website/` 可先复制，Phase 4 再删或重写（若复制，验收时勿依赖公司域名）

### 1.3 推荐复制命令（PowerShell）

在确认用户已说「执行 Phase 1」后执行。示例（按需调整排除项）：

```powershell
$src = "E:\work\project\cangku\haode-ai-client"
$dst = "E:\work\project\cangku\local-creator"
$exclude = @('node_modules','out','.pack-tmp','dist','.git','.codegraph','.env','.env.local','.env.production.local')
# 使用 robocopy 或逐目录 Copy-Item；复制后检查 .gitignore 合并
```

> 具体命令由执行 AI 根据源仓现状拟定；复制后立刻 `git status` 确认无密钥文件。

### 1.4 合并 README / docs

- 保留本仓 `docs/**` 不被覆盖
- 根 `README.md`：保留「本地漫创」说明，可增加「源码已从 haode-ai-client 迁入，正在清洗」

### 1.5 安装依赖并编译

```powershell
cd E:\work\project\cangku\local-creator
npm install   # 或与源仓一致的 pnpm i
npm run compile
```

### 1.6 提交（仅当用户要求）

```text
chore: import codebase from haode-ai-client as local-creator baseline
```

## 验收

- [ ] `npm run compile` 通过
- [ ] 无 `.env` / 密钥进 git
- [ ] `docs/` 仍在且内容完整
- [ ] 工作区约定未破坏（未改公司仓业务）

## 失败处理

- compile 失败：先修路径/依赖，本阶段不借机大删功能
- 误拷 `node_modules`：删除后重装

## 下一步

[phase-2-rebrand.md](phase-2-rebrand.md)
