# ota log 官网首页 Demo

面向首次了解 ota log 的用户，沿用 App 默认极简主题。当前是独立静态首页，不依赖 Expo，也不需要安装额外依赖或构建。

## 本地预览

在仓库根目录运行（需要 Python 3）：

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory publishing/website
```

访问 <http://127.0.0.1:4173/>，按 `Ctrl+C` 停止。服务器只提供 Demo 目录，不暴露整个仓库。

## 文件与内容

- `index.html`：首页内容、响应式样式及 iOS / Android 下载入口。
- `privacy/index.html`：可独立部署和访问的隐私政策页面。
- `support/index.html`：App Store 技术支持页面和问题反馈入口。
- `icon.png`：来自 App 的 `assets/icon.png`，保留本地副本以便独立预览与部署。
- 文案来源：[`App Store Connect 元数据快照`](../app-store/metadata/zh-Hans.md)。

首页包含产品介绍、记录流程、主要功能、本地存储与数据备份说明，以及 iOS / Android 获取入口。

## 当前边界

- 已包含最小可用的隐私政策和技术支持页面；未来更新计划不在本版范围。
- App 界面及记录数据均为示意，页面已有标注；真实截图后续替换。
- Android APK 地址由部署时的 `android-download.js` 配置提供；未配置时按钮不可点击。TestFlight 已接入公开测试入口。
- 展示版本号来自当前发布资料，不会自动更新。
- 后续发布需核对功能文案与隐私说明，并核对展示版本号。
- 审阅截图位于仓库的 `.impeccable/review/`，属于本地产物，不纳入源码管理。

## 服务器部署

```sh
./scripts/deploy-website.sh --apk-url 'https://example.com/download/android'
```

支持下载网页和 APK 直链；带查询参数的 URL 请加引号。也可设置 `OTA_LOG_APK_URL`，命令行参数优先。
脚本在临时目录生成配置并部署，结束后清理，不修改仓库 HTML 或配置文件。
每次部署（含 `--dry-run`）必须提供地址，避免意外清空下载入口。

```sh
./scripts/deploy-website.sh --check-only
./scripts/deploy-website.sh --check-only --apk-url 'https://example.com/app.apk'
./scripts/deploy-website.sh --dry-run --apk-url 'https://example.com/app.apk'
```

`--check-only` 不连接服务器；提供 URL 时同时校验地址及生成后的站点。
本地直接预览和下面的 GitHub Pages 工作流使用默认空配置，Android 按钮不可点击。
如需在这些环境启用下载，请在发布产物中设置 `android-download.js` 的 `window.OTA_LOG_APK_URL`。

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
