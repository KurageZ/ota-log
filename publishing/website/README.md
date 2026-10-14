# ota log 官网

面向首次了解 ota log 的用户，以暖象牙白、克制的蓝色和个人记录感介绍产品。首页使用真实 App 截图，按演出之前、演出之后和回顾记录展开。整个目录可独立部署，不依赖 Expo，也不需要安装额外依赖或构建。

## 本地预览

在仓库根目录运行（需要 Python 3）：

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory publishing/website
```

访问 <http://127.0.0.1:4173/>，按 `Ctrl+C` 停止。服务器只提供官网目录，不暴露整个仓库。

## 文件与内容

- `index.html`：首页内容、实际界面预览及 iOS / Android 下载入口。
- `styles.css`：响应式布局、浅色 / 深色主题与减少动态效果支持。
- `website.js`：场景截图切换、Android 下载配置校验和页脚年份。
- `android-download.js`：Android 下载配置，包含 GitHub Releases 和夸克网盘入口。
- `assets/`：网站专用 WebP 截图、自托管中文衬线字体子集和字体许可证。
- `DESIGN.md`：本站已实现的设计规范与截图使用边界。
- `privacy/index.html`：可独立部署和访问的隐私政策页面。
- `support/index.html`：App Store 技术支持页面和问题反馈入口。
- `changelog/index.html`：面向用户的更新日志，首版收录 2.0.0 至 2.1.0 的正式版本；专用布局在 `changelog/changelog.css`，颜色与基础样式复用官网。
- `icon.png`：来自 App 的 `assets/icon.png`，保留本地副本以便独立预览与部署。
- 文案来源：[`App Store Connect 元数据快照`](../app-store/metadata/zh-Hans.md)。

首页包含产品介绍、记录流程、主要功能、本地存储与数据备份说明，以及 iOS / Android 获取入口。

## 当前边界

- 更新日志为无需 JavaScript 的静态页面。发版时依据根目录 `CHANGELOG.md`，在页面顶部补充版本、日期及用户可感知的变化；不自动生成，也不展示内部构建与依赖变更。更早版本通过完整更新日志链接查看。

- 已包含最小可用的隐私政策和技术支持页面；未来更新计划不在本版范围。
- App 界面是真实 iOS 截图；人物与记录为虚构演示数据，页面已有标注。来源与版本限制见下文。
- Android 下载提供 GitHub Releases 和夸克网盘两个入口；夸克链接需在 `android-download.js` 中配置。iOS 已接入 App Store 正式版入口。
- 首页不展示发布版本号；后续发布仍需核对功能文案、截图与隐私说明。
- 审阅截图属于本地产物，不纳入源码管理；本次浏览器 QA 位于 `/private/tmp/ota-website-review/`。

## 截图与字体资源

六张 `assets/01-home.webp` 至 `06-stats.webp` 来自 [2026-09-09 截图记录](../app-store/screenshots/2026-09-09/README.md) 的 `raw/iphone/` 原始截图：真实 iOS 模拟器 App 界面，使用原生 2.0.0 / Build 1 Debug 容器加载当前 2.0.1 工作区代码。切册与日历已使用三张新生成的拍立得样式图片；这些截图不能作为当前 TestFlight 二进制界面完全一致的证明。Android 系统控件和布局可能不同；截图本身均为浅色，不随网站深色模式变色。

人物、团体、活动、场地和用户资料均为虚构。人物图像由 ImageGen 生成，设定为 25–26 岁的虚构成年演出者；记录、计数和图表由真实 App 渲染，没有重绘或伪造 UI。网站保留屏幕内容与比例，仅通过 CSS 加设备边框、阴影与少量旋转。

网站派生图使用 `cwebp -q 88 -resize 792 0` 转为 WebP，尺寸为 792 × 1721。示例（需要本地原始素材与 `cwebp`）：

```sh
cwebp -q 88 -resize 792 0 publishing/app-store/screenshots/2026-09-09/raw/iphone/01-home.png -o publishing/website/assets/01-home.webp
```

原始 PNG、营销排版成品、QA 数据及 ZIP 保持原有忽略规则；此目录只使用网站需要的压缩派生资源，不依赖被忽略目录才能部署。若需重拍，先按 [截图工作流](../../docs/workflows/app-store-screenshots.md) 使用隔离模拟器，并复核实际发布界面。

标题使用自托管 Noto Serif SC 子集 `assets/noto-serif-sc-subset.ttf`（CSS 名称 `Ota Serif`），许可证为 [SIL Open Font License 1.1](./assets/OFL-NotoSerifSC.txt)。正文使用系统字体；不调用外部字体服务。更新标题文案时检查新增汉字是否包含在子集中，必要时重建子集并保留许可证。

首页场景按钮切换首页、电子切册和统计截图；预览与收藏区截图可在新标签页放大。常见问题使用原生折叠控件。移动端收藏区可横向滑动，页面随系统切换深浅色，并尊重减少动态效果设置。

## 服务器部署

```sh
./scripts/deploy-website.sh --apk-url 'https://pan.quark.cn/s/example'
```

`--apk-url` 配置 Android 下载入口（当前为夸克网盘链接）；带查询参数的 URL 请加引号。也可设置 `OTA_LOG_APK_URL`，命令行参数优先。GitHub Releases 默认使用仓库的 `releases/latest`，也可通过 `OTA_LOG_GITHUB_RELEASES_URL` 覆盖。
脚本在临时目录生成配置并部署，结束后清理，不修改仓库 HTML 或配置文件。
每次部署（含 `--dry-run`）必须提供地址，避免意外清空下载入口。

```sh
./scripts/deploy-website.sh --check-only
./scripts/deploy-website.sh --check-only --apk-url 'https://example.com/app.apk'
./scripts/deploy-website.sh --dry-run --apk-url 'https://example.com/app.apk'
```

`--check-only` 不连接服务器，只校验本地网站文件。
本地直接预览和下面的 GitHub Pages 工作流使用默认空配置，Android 按钮不可点击。
如需在这些环境启用下载，请在发布产物中设置 `android-download.js` 的 `window.OTA_LOG_APK_URL`。

## GitHub Pages 部署

仓库已包含 `.github/workflows/deploy-website-pages.yml`，会将 `publishing/website` 发布到 GitHub Pages。

1. 将相关文件提交并推送到 `main` 分支。
2. 打开 GitHub 仓库的 **Settings → Pages**。
3. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
4. 打开 **Actions**，等待 **Deploy website to GitHub Pages** 完成；如未自动运行，可手动运行该工作流。

部署完成后可访问：

- 官网：`https://www.otalog.com/`
- 隐私政策：`https://www.otalog.com/privacy/`
- 技术支持：`https://www.otalog.com/support/`
