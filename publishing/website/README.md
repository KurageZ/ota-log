# ota log 官网首页 Demo

面向首次了解 ota log 的用户，沿用 App 默认极简主题。当前是独立静态首页，不依赖 Expo，也不需要安装额外依赖或构建。

## 本地预览

在仓库根目录运行（需要 Python 3）：

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory publishing/website
```

访问 <http://127.0.0.1:4173/>，按 `Ctrl+C` 停止。服务器只提供 Demo 目录，不暴露整个仓库。

## 文件与内容

- `index.html`：首页内容、响应式样式及下载占位提示交互。
- `privacy/index.html`：可独立部署和访问的隐私政策页面。
- `support/index.html`：App Store 技术支持页面和问题反馈入口。
- `icon.png`：来自 App 的 `assets/icon.png`，保留本地副本以便独立预览与部署。
- 文案来源：[`App Store Connect 元数据快照`](../app-store/metadata/zh-Hans.md)。

首页包含产品介绍、记录流程、主要功能、本地存储与数据备份说明，以及 iOS / Android 获取入口。

## 当前边界

- 已包含最小可用的隐私政策和技术支持页面；未来更新计划不在本版范围。
- App 界面及记录数据均为示意，页面已有标注；真实截图后续替换。
- TestFlight 和 APK 尚未接入真实地址，按钮只显示提示，不会下载文件。
- 展示版本号来自采集时资料，不是自动获取的最新版本。
- 正式发布前需核对功能文案与隐私说明，接入下载地址，并更新版本号、更新时间、APK 大小和校验值。
- 审阅截图位于仓库的 `.impeccable/review/`，属于本地产物，不纳入源码管理。

## GitHub Pages 部署

仓库已包含 `.github/workflows/deploy-website-pages.yml`，会将 `publishing/website` 发布到 GitHub Pages。

1. 将相关文件提交并推送到 `main` 分支。
2. 打开 GitHub 仓库的 **Settings → Pages**。
3. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
4. 打开 **Actions**，等待 **Deploy website to GitHub Pages** 完成；如未自动运行，可手动运行该工作流。

部署完成后可访问：

- 官网：`https://kuragez.github.io/ota-log/`
- 隐私政策：`https://kuragez.github.io/ota-log/privacy/`
- 技术支持：`https://kuragez.github.io/ota-log/support/`
