# P5 · 打包与冒烟（熟人私发）

## 目标

打出 Windows 安装包，本机干净安装后能完成最小创作路径；仍**不公开**仓库。

## 前置

- [ ] P4 验收通过
- [ ] 本机可跑原公司仓打包链路（对照只读 `../haode-ai-client` 的 `package.json` scripts / `scripts/build-desktop.mjs`）

## 操作步骤

### 1. 对齐打包脚本

1. 确认本仓 `npm run build` / `ship` 类脚本不再引用公司发版 skill 的 TOS 上传（删掉或改成 no-op）。
2. 本地只产出 Setup.exe 到约定目录。

### 2. 打安装包

```powershell
cd E:\work\project\cangku\local-creator
# 以本仓实际 script 为准，例如：
npm run compile
npm run build
# 或项目内文档写明的 Windows 打包命令
```

### 3. 本机冒烟（建议用虚拟机或另目录）

- [ ] 安装成功，桌面快捷方式「本地漫创」
- [ ] 启动无登录墙
- [ ] 设置添加模型 Key
- [ ] 工坊或画布：完成一次生图 **或** 生视频
- [ ] 卸载入口名称正常

### 4. 熟人私发（可选）

- 网盘传递 Setup；附「如何填 API Key」一页（可放 `docs/user-quickstart.md`，P5 可补）。
- 声明：第三方 API 费用自理；软件无公司云服务。

## 验收

- [ ] 安装包可安装/可卸载
- [ ] 冒烟清单全勾
- [ ] 安装包文件名不含「好的漫创」

## 下一步

人说：**执行 P6**
