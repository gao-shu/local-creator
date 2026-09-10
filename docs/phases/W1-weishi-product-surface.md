# W1 · 去微视产品面（已完成）

## 目标

设置/预设/内置项中不再出现「微视」入口；读盘剔除 weishi 模型。运行时管道留给 W2。

## 已完成

- [x] `settings-defaults`：无内置微视；`stripWeishiVideoModels` 读盘剔除
- [x] `models-tab`：去掉「微视API」按钮；列表过滤 weishi；保存拒绝 weishi
- [x] `model-config-dialog`：无微视专用 UI；拒存 `weishi_api`
- [x] `video-model-extra-fields`：不再挂微视专用表单
- [x] 删除 `weishi-model-config-fields.tsx`（产品面文件）
- [x] `system-tab` 调试文案去微视
- [x] `src/components` 下 `rg 微视` 为零

## 验收

```text
rg -n "微视" src/components
npm run compile
```

## 下一步

人说：`执行 W2`（或 `执行 W2.1` 断运行时入口）。
