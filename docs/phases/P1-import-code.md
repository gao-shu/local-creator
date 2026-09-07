# P1 · 从 haode-ai-client 导入代码

## 目标

本仓出现可安装依赖、可 `compile` 的完整应用树；此时仍带公司耦（留给 P2 删）。

## 前置

- [ ] P0 验收通过
- [ ] 磁盘空间充足（含 `node_modules`）
- [ ] 关闭正在占用公司仓输出目录的打包进程

## 操作步骤

### 1. 确认目录

```powershell
cd E:\work\project\cangku
dir haode-ai-client
dir local-creator
```

### 2. 复制策略（推荐 robocopy，排除重物）

在 `cangku` 下执行（PowerShell）：

```powershell
$src = "E:\work\project\cangku\haode-ai-client"
$dst = "E:\work\project\cangku\local-creator"

# 先备份本仓已有 docs（复制可能覆盖根 README —— 复制后恢复 docs）
Copy-Item -Recurse "$dst\docs" "$env:TEMP\local-creator-docs-backup" -Force

robocopy $src $dst /E /XD .git node_modules out .pack-tmp dist release .codegraph `
  /XF .env .env.local .env.production.local *.exe *.blockmap

# 恢复开源规划文档（覆盖被拷来的公司 docs 索引可接受：下一步会整理）
# 若 robocopy 覆盖了 docs 里我们的规划，从备份合并：
Copy-Item -Recurse "$env:TEMP\local-creator-docs-backup\*" "$dst\docs\" -Force
```

**必须排除：** `.git`、`node_modules`、`out`、打包产物、`.env*` 密钥。

**坑：** `robocopy /XD release` 会排除**任意**名为 `release` 的目录，包括 `src/lib/release`。导入后若缺 `changelog-read.ts`，需单独拷贝该目录，并在 `.gitignore` 用 `!/src/lib/release/` 反包含。

**安全：** 勿复制 `.env.production`（可能含密钥）。本仓执行记录见 [../P1-import-security-note.md](../P1-import-security-note.md)。

### 3. 恢复本仓身份文件

复制后检查并保留/写回：

- 本仓 `docs/**`（规划文档优先于公司 docs）
- 根 `README.md` 用「本地漫创」版（可与公司 README 并存为 `docs/upstream-readme-ref.md` 可选）

建议：将公司原 `docs/` 整目录改名为 `docs/upstream-haode/` 或删除发版/组织类文档，避免开源混淆（可在 P1 末或 P2 初做）。

### 4. 初始化依赖

```powershell
cd E:\work\project\cangku\local-creator
npm install
npm run compile
```

### 5. Git

```powershell
git add -A
git status   # 确认无 .env、无 key
git commit -m "chore: import application tree from haode-ai-client (pre-strip)"
```

## AI 注意

- 本阶段**不要**开始大删好豆（除非 compile 被无关错误挡住）。
- 不要把公司 remote 设为 origin；origin 稍后 P6 再配你的 Gitee。

## 验收

- [ ] `npm run compile` 退出码 0
- [ ] `src/`、`electron/`、`package.json` 存在
- [ ] `docs/00-decisions.md` 等规划文档仍在
- [ ] `git status` 干净或仅余已知忽略
- [ ] 未向 `haode-ai-client` 写入

## 失败排查

| 现象 | 处理 |
|------|------|
| robocopy 漏文件 | 对照公司仓 `package.json` scripts 所需目录 |
| compile 缺原生模块 | 删 `node_modules` 重装；检查 Electron 版本 |
| docs 被覆盖 | 从 `%TEMP%\local-creator-docs-backup` 恢复 |

## 下一步

人说：**执行 P2**
