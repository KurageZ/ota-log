# ota log 首次上架截图 · 简体中文

长期通用流程见 [`docs/workflows/app-store-screenshots.md`](../../../../docs/workflows/app-store-screenshots.md)；本文只记录 2026-08-31 这次生成的设备、数据、命令和产物。

本套素材使用本地 iOS 模拟器采集真实 App 界面，再由 Koubou 0.20.0 的 HTML 模板添加标题、背景和设备外框。未上传 App Store Connect，未修改 App 代码或用户原有模拟器的数据。

图片素材、原始截图、导出成品、预览图、ZIP、QA 数据及生成的 YAML 已加入 Git 忽略规则，仅在本地保留；脚本、模板和本文档可纳入版本控制。需要长期保存本次成品时，请另行备份 ZIP；需要完整复用本次截图素材时，请备份整个目录。仅克隆 Git 仓库不会带回被忽略的文件。

## 上传文件

**如果上传页面提示必须为 1242 × 2688 或 1284 × 2778，使用新包 `ota-log-app-store-iphone-6.5-zh-Hans.zip`。** 它只含 6 张 1284 × 2778 PNG，对应 iPhone 6.5 英寸栏位。解压后按 `01–06` 上传图片，不要上传 ZIP 或预览图，也不要把 iPad 图片混入此栏位。成品在 `ready/zh-Hans/iphone-6.5/`。

该尺寸版本重新渲染了营销画布和排版，真实 App 界面仍来自已有 iPhone 原始截图，等比缩放放入设备外框，没有拉伸或裁掉屏幕内容。校验记录在 `qa/validation-iphone-6.5.json`，预览在 `preview-iphone-6.5.jpg`。这是另一种上传尺寸，不是新采集的 6.5 英寸模拟器界面。

原版资源保持不变：

`ota-log-app-store-zh-Hans.zip` 只包含 12 张可上传 PNG。解压后按文件名前缀 `01` 至 `06` 上传：

| 目录 | 数量 | 像素尺寸 | App Store Connect 位置 |
| --- | ---: | --- | --- |
| `ready/zh-Hans/iphone-6.9/` | 6 | 1320 × 2868 | 简体中文 → iPhone 6.9 英寸 |
| `ready/zh-Hans/ipad-13/` | 6 | 2064 × 2752 | 简体中文 → iPad 13 英寸 |

顺序：产品概览、电子切册、活动计划、艺人详情、拍立得日历、年度统计。

`preview-iphone.jpg` 和 `preview-ipad.jpg` 是审阅用总览，不要上传总览图。`raw/` 保留未排版的原始模拟器截图，如需纯界面版本可从这里选择；同一设备组建议使用统一风格。

以上尺寸依据 [Apple 官方截图规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) 核对。本项目启用了 iPad 支持，所以准备了 iPad 素材。已有 6.9 英寸素材时，Apple 不要求另交 6.5 英寸素材。此包仅针对 Apple App Store，不包含 Google Play 素材。

注意：1320 × 2868 必须放在 6.9 英寸栏位，不能直接上传到 6.5 英寸栏位；以所选栏位显示的尺寸要求为准。

## 内容与提审前复核

- 截图来自 2026-08-31 的当前工作区界面，Git HEAD 为 `8623ed7e47e8ad9dd1f010fe150cb91f7ea03e79`。使用本地 Debug 模拟器构建和 Metro 加载工作区代码，并非直接从 TestFlight 的提审二进制采集。提交前应确认实际提审构建的界面、图标及功能与此一致；若有差异应重新采集。
- 人物、团体、活动、场地及用户资料均为虚构演示内容。六张人物照片由 ImageGen 生成，设定为 25–26 岁的虚构成年演出者；没有使用真人偶像照片、用户私有照片或真实出行记录。
- 16 场示例活动中，13 场已完成、3 场计划中；另有 29 张示例拍立得。截图中所有计数、图表与页面由 App 自身计算和渲染，没有在图中伪造界面功能。
- 两种设备均为浅色外观；首页、切册、详情页是实际界面。日历选择 2026-08-30，统计选择 2026 年，以展示有内容的状态。
- 已隐藏开发菜单入口并统一状态栏时间、电量。营销设备外框由 CSS 绘制，真实屏幕内容等比放入，未改变原始 UI 的比例。
- 已检查 12 张图的尺寸、RGB 色彩模式、无透明通道、图片可解码，以及标题、副标题与设备区域无重叠且在画布内；校验与文件哈希见 `qa/validation.json`。已经人工查看全部图的排版和关键页面。审核是否通过仍由 Apple 决定。

## 修改文案或样式后重新导出

### 2026-09-08 切册示例图片更新

使用内置 ImageGen 生成三张独立拍立得素材，保存在 `assets/cheki-haru.png`、`assets/cheki-mio.png`、`assets/cheki-rin.png`（本地忽略文件）。生成提示词方向：虚构成年偶像的特典会直闪照片，54:86 竖版实体相纸、白边和宽底部留言区、轻微胶片颗粒、手写日文及爱心或星星涂鸦；分别为粉色服装短发比心、蓝色服装长发比耶、黄色服装挥手。蓝色图为用户确认的首张预览，另两张沿用同一质感。

两台专用演示模拟器各 29 条切册图片引用已切换到这三张素材，艺人头像及背景图保留原素材；`seed-demo.py` 已同步使用独立切册图片。更新前备份位于 `qa/iphone-before-cheki-20260908.sqlite` 和 `qa/ipad-before-cheki-20260908.sqlite`。图片复制哈希、数据库完整性、外键及其他业务数据不变检查均通过。此次未重新采集或导出商店截图，现有截图和 ZIP 仍为旧画面。

这次工具安装在独立临时环境 `/private/tmp/ota-store-tools`，没有向 App 的依赖清单安装 Koubou。如果临时环境被清理，可在项目外新建 Python 虚拟环境并安装 `koubou==0.20.0`、`Pillow==12.3.0` 和 `PyYAML`，再运行 `kou setup-html`。HTML 中文字体依赖 macOS 的 PingFang SC。

在本目录执行：

```sh
rtk proxy /private/tmp/ota-store-tools/bin/python build-configs.py
rtk proxy /private/tmp/ota-store-tools/bin/kou generate iphone.yaml
rtk proxy /private/tmp/ota-store-tools/bin/kou generate ipad.yaml
rtk proxy /private/tmp/ota-store-tools/bin/python package-assets.py
```

导出并打包新增的 6.5 英寸规格（不覆盖原版包）：

```sh
rtk proxy /private/tmp/ota-store-tools/bin/python build-configs.py
rtk proxy /private/tmp/ota-store-tools/bin/kou generate iphone-6.5.yaml
rtk proxy /private/tmp/ota-store-tools/bin/python package-assets.py --profile iphone-6.5
```

文案集中在 `build-configs.py`，布局在 `templates/slide.html` 与 `templates/slide.css`。生成出的 YAML 可以审阅；长期修改请改生成脚本，避免下次覆盖。

Koubou 配置中的设备名称用于其框架资源元数据和中间目录命名，本套设置了 `frame: false`，不使用该资源。实际设备尺寸以 `output_size`、真实截图和 `ready/` 目录为准，不要依据 `export/` 的内部子目录名选择上传设备。

## 再次采集真实界面

专门创建了两台演示模拟器，与原有设备隔离：

| 演示设备 | 类型 | UDID |
| --- | --- | --- |
| ota-log Store iPhone | iPhone 17 Pro Max / iOS 26.5 | `FBCFC373-EA6B-4FD7-99DD-494DB3150D8A` |
| ota-log Store iPad | iPad Pro 13-inch (M5) / iOS 26.5 | `2EE10247-D2F9-4A62-BD89-33F147EB93F1` |

App bundle ID 为 `com.otalog.app`。演示数据库和照片保留在这两台模拟器中，方便后续重拍；这些数据不会随 App 发布。`seed-demo.py` 仅允许上述专用设备，且拒绝写入非空业务数据库。**本次已经完成填充，不要重复运行，也不要修改限制去覆盖日常使用的模拟器。** 原始空库备份在 `qa/`。

重新启动这些设备并连接当前开发构建后，可使用 `capture.py iphone` / `capture.py ipad` 依次打开页面并截图。需先隐藏开发菜单并关闭所有系统或开发弹窗；截图脚本的固定等待不能替代人工核验。

本次使用独立开发服务端口 8088，没有占用既有 8081 服务。启动参数为：

```sh
# 在项目根目录启动开发服务；确保 8088 没有被其他程序使用。
rtk proxy env CI=1 NODE_OPTIONS=--dns-result-order=ipv4first npx expo start --dev-client --port 8088 --localhost
```

启动开发 App 时使用 `-EXDevMenuShowFloatingActionButton NO -EXDevMenuDisableAutoLaunch YES -AppleLanguages '(zh-Hans)' -AppleLocale zh_CN`，开发客户端连接地址为 `http://127.0.0.1:8088`。实际连接后确认屏幕没有开发浮标、加载提示、警告或弹窗，再运行采集脚本。

**日历需要一次人工选日：** `capture.py` 打开日历后默认选中系统当天。运行后在 App 内切到 2026 年 8 月并选择 30 日，再重新保存 `raw/<设备>/05-calendar.png`。本次已完成这一步。统计路线使用 `stats?preset=year`；未来日期重拍时，应人工切回 2026 年或更新演示数据，不能直接沿用空白的当前日期。

采集后重复“重新导出”步骤，并逐张检查 `ready/` 中的最终图片。此流程包含自动截图和自动排版，但尚不是无需检查的 CI 上架流程。
