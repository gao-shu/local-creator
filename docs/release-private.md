# 私有发版备忘（Gitee / 网盘）

面向熟人私发，**不公开**仓库。公司 TOS/CDN 不使用。

## 日常发版步骤

1. **升版本号**  
   - 改 `package.json` 的 `version`  
   - 在 `src/constants/release-changelog.ts` 增加同版本条目  

2. **打包**  
   ```powershell
   cd E:\work\project\cangku\local-creator
   npm run build
   ```  
   产物：`release/本地漫创 Setup x.x.x.exe`（已 gitignore）

3. **上传网盘**  
   - 把 Setup 传到你自己的网盘/对象存储  
   - 把下载说明与 [user-quickstart.md](user-quickstart.md) 一并发给熟人  

4. **（可选）Gitee Release**  
   - 在私有仓创建 Release，挂上 Setup 与 `latest.yml`（若启用应用内更新）  
   - 将 `VITE_UPDATE_PUBLISH_URL` 设为 Release 资产目录或网盘静态目录（末级需可访问 `latest.yml`）  
   - 重新打包后，客户端才会开启「检查更新」  

## 自动更新开关

| 状态 | 条件 | 行为 |
|------|------|------|
| 关闭（L2 默认） | 未设 `VITE_UPDATE_PUBLISH_URL` | 启动不检查；手动检查提示未配置 |
| 开启 | 已设自有 feed URL | electron-updater generic provider |

## Git 远端

```powershell
git remote add origin https://gitee.com/<你的命名空间>/local-creator.git
git push -u origin master
```

确认 Gitee 仓库为**私有**。公开前见 [appendix-open-source.md](appendix-open-source.md)。
