---
name: ota log website
description: 用真实 App 界面呈现温暖、清晰的个人演出记录。
colors:
  paper: "#faf9f6"
  ink: "#232622"
  muted: "#676a66"
  rule: "#dedfd9"
  blue: "#1558d6"
  blue-hover: "#114bb7"
  sky: "#eaf0f7"
  rose: "#f2e4e4"
  soft: "#f0f1ec"
  disabled: "#e5e6e0"
typography:
  display:
    fontFamily: '"Ota Serif", "Songti SC", "Noto Serif CJK SC", serif'
    fontSize: "clamp(34px, 3.6vw, 50px)"
    fontWeight: 500
    lineHeight: 1.55
    letterSpacing: "-.025em"
  headline:
    fontFamily: '"Ota Serif", "Songti SC", "Noto Serif CJK SC", serif'
    fontSize: "clamp(30px, 3.4vw, 44px)"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "16px"
    lineHeight: 1.7
rounded:
  button: "10px"
  stage: "16px"
  device: "32px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "#fff"
    rounded: "{rounded.button}"
    padding: "12px 25px"
  button-primary-hover:
    backgroundColor: "{colors.blue-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.blue}"
    rounded: "{rounded.button}"
  button-disabled:
    backgroundColor: "{colors.disabled}"
    textColor: "{colors.muted}"
---

# Design System: ota log 官网

## Overview

采用用户确认的 Things 式清晰秩序与 Day One 式个人记录感：暖象牙白纸面、克制的蓝色、中文衬线标题，以及少量票根意象。真实 App 截图承担产品说明，文字围绕期待演出、收好拍立得和回看经历展开。

本文件只记录 `publishing/website/` 的独立静态首页，以 `index.html`、`styles.css` 和 `website.js` 为实现依据。隐私与支持页面保留各自已有结构；本规范不替代 App 设计文档，也不修改根目录 `design.md` / `DESIGN.md` 的链接目标。

**Key Characteristics:**

- 阅读顺序清楚，留白充分，蓝色主要服务于动作和选择状态。
- 中文衬线标题增加个人记录的温度，正文与操作保持系统字体的清晰度。
- 实际屏幕完整展示；装饰集中于背景圆面、设备外框和一张票根。

## Colors

浅色基础值见 frontmatter，对应样式表中的同名变量。暖纸色用于主背景，浅蓝用于截图舞台、隐私说明和下载区；浅灰绿承托收藏区，浅玫瑰色用于切册场景。正文使用 ink，辅助文字使用 muted，分隔线使用 rule。

深色模式由 `prefers-color-scheme: dark` 自动切换：纸面 `#191c20`、文字 `#f1f0e9`、辅助文字 `#b2b7be`、分隔线 `#3d424b`、蓝色 `#95baff`、悬停蓝色 `#b3ceff`、浅蓝舞台 `#242e3c`、玫瑰舞台 `#3d3039`、收藏底色 `#20252a`、禁用底色 `#343a43`。深色主按钮文字为 `#192337`。截图保持原始浅色外观，不反色。

## Typography

标题字体 `Ota Serif` 来自自托管 Noto Serif SC 字体子集，字重（500），`font-display: swap`，回退到本机宋体或衬线字体。字体文件及 OFL 许可证随站点发布，不访问外部字体服务。修改标题时需检查新增字符是否在子集中。

桌面主标题与二级标题使用 frontmatter 的字号；主标题在移动端改为 `clamp(28px, 7.6vw, 40px)`，最窄断点为（27px）。正文默认系统字体，章节正文约（14–17px），辅助标注约（10–12px）。标题使用平衡换行；桌面主标题保留两行构图，窄屏允许自然换行。

## Layout

主容器最大宽度（1240px），桌面左右各留（48px），在（1100px）、（820px）、（600px）断点分别调整为（32px）、（24px）、（20px）。导航吸顶，宽屏高度（88px），手机为（68px）。手机隐藏章节导航，保留品牌与获取 App 入口。

首屏为文字与两张截图的双栏布局，在（820px）以下变为居中单栏；章节预览在（600px）以下改为纵向。桌面章节垂直留白约（80–125px），手机约（60–65px）。收藏区桌面为三列，中央截图稍向下错位；手机改为有滚动吸附的横向截图列表。下载动作在手机上纵向堆叠。

## Elevation & Depth

页面主要以底色区分章节、以细线分隔内容。设备使用 `0 22px 40px -16px rgba(30,42,57,.27)` 阴影；深色改为同尺寸的 `rgba(0,0,0,.55)`。票根拥有更轻的小范围阴影。首屏两台设备分别旋转（−6°）和（6°），以实体照片与票根的轻微错位增加温度。

动态只用于首屏进入、按钮和截图悬停、预览底色变化。`prefers-reduced-motion: reduce` 禁用动画、过渡及平滑滚动。

## Shapes

操作按钮使用温和圆角，截图舞台使用较大圆角。设备外框默认（32px）圆角、屏幕内侧（27px）；较小显示尺寸随断点缩减。截图保持（1320 / 2868）比例并使用 `object-fit: contain`，不拉伸屏幕。背景圆面和带虚线的票根是少量品牌装饰，不作为交互元素。

## Components

### Navigation and buttons

导航锚点通向功能、界面、常见问题和下载。页面提供键盘可见的跳过导航入口。链接、按钮和 FAQ 标题聚焦时显示（3px）蓝色轮廓与（6px）外偏移；主按钮悬停上移（2px）。下载区 Android 使用描边变体。

Android 下载地址读取 `window.OTA_LOG_GITHUB_RELEASES_URL` 和 `window.OTA_LOG_QUARK_URL`。仅接受无用户名密码的 HTTP(S) 地址；空值或无效值维持无链接的禁用状态，并提供文字说明。有效下载及 App Store 在新标签页打开。

### Scene preview and screenshot collection

三个原生按钮通过 `aria-pressed` 标注当前场景，切换首页、电子切册或统计的图片、替代文字、放大链接与说明；说明区域使用礼貌级实时播报。预览和收藏区截图链接可在新标签页打开对应 WebP；首屏截图承担展示用途。选中场景同时改变文字、上边线与箭头，不只依赖颜色。

六张网站截图来自 [2026-09-09 原始 iPhone 截图](../app-store/screenshots/2026-09-09/README.md)，由当日真实本地 Debug iOS App（原生 2.0.0 / Build 1 容器）加载当前 2.0.1 工作区代码采集；切册与日历使用最新三张拍立得样式图片，并非直接从 TestFlight 提审二进制采集。人物及记录是虚构演示数据，人物图像由 ImageGen 生成，设定为（25–26岁）的虚构成年演出者。界面、统计和计数由 App 自身渲染，没有用 HTML 或绘图伪造产品 UI。

派生文件使用 `cwebp -q 88 -resize 792 0` 转为（792 × 1721）WebP，保留原始比例和屏幕内容；仅外加 CSS 边框及装饰。原始截图和 QA 产物保留既有忽略边界，网站只依赖自身 `assets/`。页面标注真实 iOS 界面、虚构演示数据以及 Android 细节可能不同；更换发布版本时仍需复核截图。

### FAQ and footer

FAQ 使用原生 `details` / `summary`，加减符号体现展开状态，无需 JavaScript 即可操作。页脚提供隐私、支持、GitHub 和备案链接；JavaScript 更新年份，HTML 留有静态回退。

## Do's and Don'ts

- 保留温暖纸面、清晰层次、真实屏幕与克制蓝色之间的关系。
- 保留下载配置、可访问状态、移动端横向浏览和减少动态效果支持。
- 为新截图记录来源、采集版本与演示数据边界，逐张检查完整屏幕比例。
- 不用假 UI 替代实际截图，不把这些历史截图称为最新 2.0.1 截图。
- 不将 iOS 浅色截图描述成 Android 或深色界面的实拍。
- 不增加外部字体服务，不将网站设计写回 App 文档的根目录软链接。
