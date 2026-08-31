# ota log 官网首页 Demo

面向首次了解 ota log 的用户，沿用 App 默认极简主题。当前是独立静态首页，不依赖 Expo，也不需要安装额外依赖或构建。

## 本地预览

在仓库根目录运行（需要 Python 3）：

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory design/website-demo
```

访问 <http://127.0.0.1:4173/>，按 `Ctrl+C` 停止。服务器只提供 Demo 目录，不暴露整个仓库。

## 文件与内容

- `index.html`：首页内容、响应式样式及下载占位提示交互。
- `icon.png`：来自 App 的 `assets/icon.png`，保留本地副本以便独立预览与部署。
- 文案来源：[`App Store Connect 元数据快照`](../../docs/marketing/app-store-connect.zh-Hans.md)。

首页包含产品介绍、记录流程、主要功能、本地存储与数据备份说明，以及 iOS / Android 获取入口。

## 当前边界

- 只制作首页；隐私政策独立页面、支持页面和未来更新计划不在本版范围。
- App 界面及记录数据均为示意，页面已有标注；真实截图后续替换。
- TestFlight 和 APK 尚未接入真实地址，按钮只显示提示，不会下载文件。
- 展示版本号来自采集时资料，不是自动获取的最新版本。
- 正式发布前需核对功能文案与隐私说明，接入下载地址，并更新版本号、更新时间、APK 大小和校验值。
- 审阅截图位于仓库的 `.impeccable/review/`，属于本地产物，不纳入源码管理。
