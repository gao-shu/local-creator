# P5 · 打包与冒烟（熟人私发）

## 目标

打出 Windows 安装包，本机干净安装后能完成最小创作路径；仍**不公开**仓库。

## 前置

- [x] P4 验收通过
- [x] 本机可跑打包链路（`scripts/build-desktop.mjs`）

## 操作步骤

### 1. 对齐打包脚本

1. `npm run ship:win` = **仅本地打包**（不上传 TOS/公司服务器）。
2. 需要上传时再配置 `.env.production` 后执行 `npm run ship:win:upload` / `npm run upload`。
3. 产物目录：`release/`（例：`本地漫创 Setup 0.1.28.exe`）。

### 2. 打安装包

```powershell
cd E:\work\project\cangku\local-creator
npm run build
# 或
npm run ship:win
```

### 3. 本机冒烟（建议用虚拟机或另目录）

- [ ] 安装成功，桌面快捷方式「本地漫创」
- [ ] 启动无登录墙
- [ ] 设置添加模型 Key
- [ ] 工坊或画布：完成一次生图 **或** 生视频
- [ ] 卸载入口名称正常

说明见 [../user-quickstart.md](../user-quickstart.md)。

### 4. 熟人私发（可选）

- 网盘传递 `release/本地漫创 Setup *.exe`；附上 `docs/user-quickstart.md`。
- 声明：第三方 API 费用自理；软件无公司云服务。

## 验收

- [x] 安装包已产出：`release/本地漫创 Setup 0.1.28.exe`（约 144MB）
- [ ] 安装包可安装/可卸载（需你本机手测）
- [ ] 冒烟清单全勾（需你本机手测 + 自备 Key）
- [x] 安装包文件名不含「好的漫创」

完成记录：`npm run build` 退出码 0；`ship:win` 不再默认 upload。

## 下一步

人说：**执行 P6**
