# OA 阶段汇总（AI 自检 · 2026-09-15）

> 门禁 D 已锁定（MIT / 占位品牌 / 双发托管 / 剪映+MP4 / 商业切口 OC 再定）。  
> **默认未公开仓库**。人审项见各节点与下方清单。

## 安全最小集

```powershell
rg -n -i "sk-[a-zA-Z0-9]{10,}|api[_-]?key\s*[:=]\s*['\"][^'\"]{8,}" --glob "!node_modules/**" --glob "!package-lock.json" --glob "!docs/**"
rg -n -i "haodou|weishi_api|好的漫创" --glob "!node_modules/**" --glob "!docs/**" --glob "!scripts/**" src electron
```

- 密钥扫描：仅测试夹具 / CLI 参数解析（见 [OA2-rg.md](OA2-rg.md)）
- `src/` + `electron/`：公司禁词 / `weishi_api` 无命中
- `scripts/` 历史计价探针：记例外，不阻塞 OA2

## 节点状态

| 节点 | AI自检 | 人审 | 证据 |
|------|--------|------|------|
| OA1 许可证/边界 | 通过 | **待人** | `LICENSE`、`docs/appendix-commercial-boundary.md`、`README.md`、`package.json` license=MIT |
| OA2 清残留 | 通过（A2.2 待人） | **待人** | [OA2-rg.md](OA2-rg.md) |
| OA3 NOTICE | 通过（A3.3 文档路径说明；关于页写明根目录 NOTICE） | **待人** | 根 `NOTICE`；`agreement-tab.tsx` |
| OA4 README/截图 | 文案通过；截图 **待人** | **待人** | README；[OA4-screenshots.md](OA4-screenshots.md) |
| OA5 首次向导 | 通过（L2+L3）；L4 待人 | **待人** | `src/components/onboarding/`；`npm run test:first-run-onboarding` |
| OA6 Win 包 | Setup+SHA256 产出；安装/更新手测待人 | **待人** | [OA6-pack.md](OA6-pack.md)；`release/`（gitignore） |

## 构建命令结果

| 命令 | 结果 |
|------|------|
| `npm run compile` | 通过 |
| `npm run test:first-run-onboarding` | 通过 |
| `npm run build` | Setup 已写入 `release/`；`website/version.json` 同步已改为目录不存在则跳过 |

## 人须尽快完成的手测

1. 新数据目录启动 → 向导四步（OA5）  
2. 设置/工坊确认无「即梦」展示名（OA2）  
3. 设置→用户协议可见 LICENSE/NOTICE 说明（OA3）  
4. 实机截三张图放入 `docs/images/`（OA4）  
5. 安装 `release/本地漫创 Setup 0.1.28.exe`；检查更新提示未配置文案（OA6）  

完成后在 [phases/OA-phase-a.md](../phases/OA-phase-a.md) 勾人审与阶段验收。
