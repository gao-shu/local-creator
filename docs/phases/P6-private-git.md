# P6 · 私有 Git 与更新预留

## 目标

本仓对接**你自己的私有 Gitee**；更新体系预留网盘/Gitee 发布，不接公司 CDN。

## 前置

- [ ] P5 冒烟通过
- [ ] 已有 Gitee 私有仓库（空仓）

## 操作步骤

### 1. 绑定私有远端

```powershell
cd E:\work\project\cangku\local-creator
git remote -v
# 若误带公司 origin，更换：
git remote remove origin   # 若存在且指向公司
git remote add origin https://gitee.com/<你的命名空间>/local-creator.git
git push -u origin HEAD
```

确认：**私有**、未开开源许可公开浏览。

### 2. 自动更新策略（二选一）

| 策略 | 做法 |
|------|------|
| L2 先关 | UI 去掉检查更新；`update-config` 禁用 |
| 预留自建 | `latest.yml` + Setup 放 Gitee Release 或网盘；配置可改 base URL |

公司 TOS 地址必须已在 P4 清除。

### 3. 网盘发版备忘

在本仓增加简短 `docs/release-private.md`（可本阶段写）：

1. 升版本号  
2. 打包  
3. 上传网盘  
4. （可选）更新 Gitee Release 资产  

### 4. 开源开关未到

- 不要点「公开仓库」。  
- 公开前走 [../appendix-open-source.md](../appendix-open-source.md)。

## 验收

- [ ] `git remote` 为自己的 Gitee 私有地址
- [ ] push 成功
- [ ] 无公司更新域名残留（`rg` 再扫 update 相关）

## 本路线 L2 结束

之后可选：

- 人说：**补 user-quickstart**  
- 人说：**准备开源附录验收**  
- 人说：**商业版另仓方案**（只讨论/写附录，不混进开源底子）
