# P4 · 占位品牌壳（不对外）

## 目标

运行时与安装元数据统一为占位「本地漫创」；去掉「好的漫创 / Haode」展示。  
图标可先用临时图，正式设计可后补。

## 前置

- [ ] P3 手测通过
- [ ] 阅读 [../brand-placeholder.md](../brand-placeholder.md)

## 操作步骤

### 1. 建立品牌单源（推荐）

新建例如 `src/constants/brand.ts`：

```ts
export const APP_PRODUCT_NAME = '本地漫创'
export const APP_PACKAGE_NAME = 'local-creator'
// appId 只写在 electron-builder.yml，避免两处漂移
```

所有 UI/窗口标题改引用该常量。

### 2. 打包身份

编辑 `electron-builder.yml` / `package.json`：

| 字段 | 占位值 |
|------|--------|
| appId | `com.localcreator.app` |
| productName / executableName / shortcutName | 本地漫创 |
| package.json name | `local-creator` |

### 3. 壳面资源

- [ ] `index.html` title
- [ ] `electron/splash.html`
- [ ] `electron/main.ts` 窗口标题
- [ ] Logo 组件
- [ ] 删除或替换 `website/` 公司下载页与 ICP；开源前可删整站或改成简单私有说明
- [ ] 删除 `site-icp.ts` 公司备案或改为空/自有（无私有备案则去掉页脚）

### 4. 更新先禁用或改占位

- `update-config.ts`：指向空/禁用自动更新，或注释更新入口。  
- 删除公司 TOS/CDN URL。  
- P6 再接 Gitee/网盘。

### 5. 版权头

批量将 `好的AI` / `haode-ai-client` 版权改为例如：

`Copyright (c) local-creator contributors`  
（正式开源时再换组织名）

### 6. 全仓扫

```powershell
rg -n "好的漫创|好的AI|haodeweishi|com\.haode\.ai|Haode AI Client" src electron build package.json electron-builder.yml index.html
```

### 7. compile

```powershell
npm run compile
```

## 验收

- [ ] 开发态窗口标题为「本地漫创」
- [ ] builder 产品名为「本地漫创」
- [ ] 无公司 ICP/下载域名作为默认页脚
- [ ] 自动更新不指向公司地址

## 下一步

人说：**执行 P5**
