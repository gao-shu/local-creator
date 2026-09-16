# 附录 · 开源公开发布前（后期）

L2 私有开发完成后，公开前再执行。  
**执行主线已升级为 OA→OC**：见 [03-oss-gtm-overview.md](03-oss-gtm-overview.md) 与 [phases/OA-phase-a.md](phases/OA-phase-a.md)。本页保留为检查表；OA 期间逐项勾掉。

## 必须完成

- [ ] `delete-inventory.md` 全节 `rg` 清零（含品牌公司名）
- [ ] 选定许可证并添加 `LICENSE`
- [ ] 第三方声明：Electron、FFmpeg、字体、npm 依赖（`NOTICE` 或 docs）
- [ ] 无密钥、无内网 IP、无客户项目样例
- [ ] README：如何配置自有 API Key、免责声明（第三方服务费用与 ToS）
- [ ] 贡献指南 / Code of Conduct（可选）
- [ ] 私有历史中若曾误提交密钥：轮换密钥并用历史清理工具（预防）

## 建议完成

- [ ] 最小可运行截图
- [ ] Issue 模板
- [ ] 与商业版边界说明（本附录与 `appendix-commercial.md` 互链）

## 公开渠道

- Gitee 公开仓 + 自有网盘发安装包（决策 #6）
- 应用内更新：指向你控制的 `latest.yml` / 网盘直链策略
