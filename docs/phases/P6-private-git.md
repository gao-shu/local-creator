# P6 · 私有 Git 与更新预留

## 目标

本仓对接**你自己的私有 Gitee**；更新体系预留网盘/Gitee 发布，不接公司 CDN。

## 前置

- [x] P5 安装包已产出（安装手测可另做）
- [ ] 已有 Gitee 私有仓库（空仓）— 建议：`honden/local-creator`（与公司仓同命名空间）

## 操作步骤

### 1. 绑定私有远端

```powershell
cd E:\work\project\cangku\local-creator
git remote -v
# 若误带公司 origin，更换：
# git remote remove origin
git remote add origin https://gitee.com/honden/local-creator.git
git push -u origin HEAD
```

确认：**私有**、未开开源许可公开浏览。

### 2. 自动更新策略（L2 已选：先关）

| 策略 | 状态 |
|------|------|
| L2 先关 | ✅ 未设 `VITE_UPDATE_PUBLISH_URL` 时启动不检查；手动检查提示未配置 |
| 预留自建 | 见 [../release-private.md](../release-private.md) |

公司 TOS 地址已在 P4/P5 清除。

### 3. 网盘发版备忘

已写：[../release-private.md](../release-private.md)

### 4. 开源开关未到

- 不要点「公开仓库」。  
- 公开前走 [../appendix-open-source.md](../appendix-open-source.md)。

## 验收

- [ ] `git remote` 为自己的 Gitee 私有地址
- [ ] push 成功
- [x] 无公司更新域名作为默认 feed（update-config / sync-version 已清）
- [x] L2 自动更新默认关闭

## 本路线 L2 结束

之后可选：

- 人说：**准备开源附录验收**  
- 人说：**商业版另仓方案**（只讨论/写附录，不混进开源底子）
