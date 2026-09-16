# OA6 · Win 包与更新源（证据）

## 更新源行为（代码）

- 配置：`electron/main/update-config.ts`、`src/lib/update/update-policy.ts`
- 未设置 `VITE_UPDATE_PUBLISH_URL` / `VITE_UPDATE_ORIGIN` 时：`isAutoUpdateEnabled() === false`
- 手动检查更新提示文案：`AUTO_UPDATE_DISABLED_HINT`  
  > 当前未配置更新地址（私有阶段默认关闭）。新版本请使用发布者提供的安装包。

## 本机执行记录（2026-09-15）

| 项 | 结果 | 备注 |
|----|------|------|
| `npm run compile` | 通过 | |
| `npm run build` | Setup 已产出；曾因 `website/version.json` 缺失 exit 1，已修脚本跳过 | `scripts/build-desktop.mjs` |
| 产物 | `release/本地漫创 Setup 0.1.28.exe`（约 122 MB） | **勿提交 Git** |
| `latest.yml` | 已生成于 `release/` | 未配置公网 feed 时仅本地 |
| SHA256 | `9705077F045E47A11C7E1CB364F45BB99A0B519709748FA6AF290D6C6AF0D4D2` | 见 `release/*.sha256` |
| winCodeSign symlink | 本机无特权；`electron-builder.yml` 设 `signAndEditExecutable: false`（未签名发版） | |
| 干净环境安装手测 | **待人** L5 | |
| 未配置更新时手动检查提示 | **待人** L4 | 文案已在代码中 |

## 操作备忘

```powershell
cd E:\8.cangku\local-creator
taskkill /F /IM "本地漫创.exe" /T
npm run build
Get-FileHash "release\本地漫创 Setup *.exe" -Algorithm SHA256
```

可选更新 feed：上传 Setup + `latest.yml`，构建时设 `VITE_UPDATE_PUBLISH_URL`。
