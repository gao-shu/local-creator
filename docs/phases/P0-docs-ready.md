# P0 · 文档与仓库规矩就位

## 目标

决策、阶段、删除清单、AI 规范齐套；本仓仍无应用源码。

## 状态

骨架已写入 `docs/`。本阶段由人确认文档可读即可。

## 操作步骤（人）

1. 打开 [../00-decisions.md](../00-decisions.md)，确认与口头决策一致。
2. 打开 [../delete-inventory.md](../delete-inventory.md)，知道开源前要删什么。
3. 打开 [../AGENT.md](../AGENT.md)，认可 AI 禁区。
4. （可选）本仓执行：

```powershell
cd E:\work\project\cangku\local-creator
git status
git add docs README.md
git commit -m "docs: lock L2 open-source-ready roadmap and delete inventory"
```

## 验收

- [ ] 决策表含：A 导入、L2、删除非隐藏、占位品牌、脱离公司、Gitee+网盘、工作区仍开公司仓
- [ ] `phases/` 下 P0–P6 文件存在
- [ ] 未修改 `haode-ai-client` 业务代码

## 下一步

人说：**执行 P1**
