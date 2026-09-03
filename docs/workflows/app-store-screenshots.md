# App Store 截图工作流

本文档是 ota log 生成 Apple App Store 截图的长期流程。它适用于首次上架和后续版本更新；某次生成所使用的设备、数据、文案、哈希与导出结果应记录在对应的 `publishing/app-store/screenshots/YYYY-MM-DD/README.md` 中。

## 目标与产物

截图分为三层，不能混用：

1. `raw/`：从真实 iOS 模拟器中的 App 直接采集，保留完整屏幕和状态栏。
2. `export/`：模板工具生成的中间结果，包含布局清单。
3. `ready/zh-Hans/<规格>/`：通过尺寸和格式检查、可上传到对应 App Store Connect 栏位的最终 PNG。

每个设备规格准备 1–10 张；ota log 当前采用六张，顺序为：产品概览、电子切册、活动计划、艺人详情、拍立得日历、年度统计。预览总览图只用于人工检查，不能上传。

## 强制规则

- 开始前打开 App Store Connect 的实际截图栏位，并对照 [Apple 当前截图规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) 确认尺寸。不能根据设备名称猜尺寸，也不能把一个栏位接受的尺寸上传到另一个栏位。
- 当前已经验证的竖屏导出规格：iPhone 6.5 英寸为 `1284 × 2778`，iPhone 6.9 英寸为 `1320 × 2868`，iPad 13 英寸为 `2064 × 2752`。如果 App Store Connect 显示不同要求，以当时页面和 Apple 官方文档为准，并更新配置和本文档。
- `app.json` 中 `ios.supportsTablet` 为 `true`，因此需要准备 iPad 截图。关闭 iPad 支持属于产品和发版决策，不能为了省略截图临时修改。
- 优先从最终提审构建采集。使用 Debug 构建时，必须记录该限制，并在提交前确认提审构建的界面、图标、功能和截图一致。
- 只使用以 `ota-log Store ` 开头的专用空模拟器。不得向用户日常模拟器、真机或已有业务数据库写入演示数据。
- 演示人物、团体、活动、场地和用户资料必须是虚构内容；不要使用用户私有数据、真实艺人照片、真实票据或可识别个人信息。人物图片需要确认授权或使用明确标注的虚构生成素材。
- 截图必须来自 App 实际渲染的界面。营销模板可以添加标题、背景和外框，但不能伪造不存在的功能、数值、评价或系统状态。
- 隐藏开发菜单、浮动按钮、加载提示、警告和系统弹窗。统一语言、外观和状态栏，并逐张确认内容已加载完成。
- 固定等待时间不等于页面就绪。需要读取界面状态或人工查看，特别是需要选定日期、筛选范围或滚动位置的页面。
- 上传到 App Store Connect 是外部发布操作；生成、检查和打包完成后，先交给用户审阅。没有明确授权时不要上传或提交审核。

## 目录与版本控制

每次生成使用独立日期目录：

```text
publishing/app-store/screenshots/YYYY-MM-DD/
├── README.md              本次生成记录与复现说明
├── assets/                演示照片和图标副本（忽略）
├── raw/                   原始模拟器截图（忽略）
├── export/                模板中间产物（忽略）
├── ready/                 可上传 PNG（忽略）
├── qa/                    空库备份、清单和校验结果（忽略）
├── templates/             HTML/CSS 模板（可跟踪）
├── build-configs.py       生成模板配置（可跟踪）
├── capture.py             采集页面（可跟踪）
├── package-assets.py      校验和打包（可跟踪）
└── seed-demo.py           专用模拟器演示数据（可跟踪）
```

图片、数据库、生成配置、预览和 ZIP 由根 `.gitignore` 排除，只保存在本地。脚本、模板、README 和本工作流可以提交。需要长期保存成品时另行备份 ZIP；仅克隆 Git 仓库无法恢复被忽略的素材。

## 生成步骤

### 1. 确认版本和截图槽位

记录以下信息：

- 提审版本、Build number、Git commit 和 Bundle ID。
- App Store Connect 当前要求的设备栏位、方向和精确像素尺寸。
- 是否支持 iPad，以及需要哪些本地化语言。
- 本次六张图对应的页面、展示状态和商店文案。

发现上传尺寸错误时，先确认栏位。比如 `1320 × 2868` 属于 iPhone 6.9 英寸，不能上传到要求 `1284 × 2778` 的 iPhone 6.5 英寸栏位。

### 2. 创建隔离模拟器并安装 App

创建名称以 `ota-log Store ` 开头的 iPhone 和 iPad 模拟器，设置目标 iOS runtime。安装准备提审的 App，先启动一次以完成数据库 migration，再终止 App。

记录模拟器名称、类型、UDID、runtime 和构建来源。不要复用已经包含个人记录的设备。

### 3. 写入虚构演示数据

演示数据脚本必须同时满足：

- 只接受本次明确列出的专用模拟器 UDID，并再次校验设备名称前缀。
- 写入前检查活动、艺人、拍立得、照片等业务表为空；非空时直接失败。
- 写入前备份空数据库；写入后运行 SQLite `foreign_key_check` 和 `integrity_check`。
- 图片复制到 App 的 Documents 目录，数据库只保存永久 URI。
- 生成结果中记录页面深链所需的活动 ID、艺人 ID、演示日期和“虚构数据”标记。

不要通过放宽安全检查来覆盖已有模拟器。演示内容需要和商店描述一致，并覆盖截图计划中的空状态、列表、详情、日历和统计页面。

### 4. 准备稳定的截图状态

设置简体中文、目标浅色或深色外观，以及统一的时间、网络和电量状态。启动 App 时关闭开发菜单浮标，处理首次启动、开发客户端和深链确认弹窗。

使用深链打开稳定页面；需要交互的状态由模拟器自动化工具完成。日历应选择确实有记录的日期，统计应选择包含有效图表的时间范围。每次交互后重新读取界面状态，确认标题、数据和选中项正确。

### 5. 采集原始截图

当前一次性工具位于最近的 `publishing/app-store/screenshots/<日期>/`。进入运行目录后，可按设备调用采集脚本：

```sh
rtk proxy /private/tmp/ota-store-tools/bin/python capture.py iphone
rtk proxy /private/tmp/ota-store-tools/bin/python capture.py ipad
```

脚本依赖运行目录 `qa/<设备>-seed.json` 记录的专用 UDID 和深链 ID。脚本运行后仍要逐张检查；如果日历默认选中今天或页面尚未加载，完成交互后单独重拍对应文件。

### 6. 生成营销排版

Koubou 和 Pillow 安装在项目外的独立虚拟环境，避免污染 App 依赖。当前工具路径为 `/private/tmp/ota-store-tools`。如果环境已被清理，在项目外重建虚拟环境并安装运行目录 README 记录的固定版本。

先生成 YAML，再按 App Store Connect 的实际栏位生成对应规格：

```sh
rtk proxy /private/tmp/ota-store-tools/bin/python build-configs.py

# 当前 iPhone 6.5 英寸栏位
rtk proxy /private/tmp/ota-store-tools/bin/kou generate iphone-6.5.yaml

# 仅在对应栏位需要时生成
rtk proxy /private/tmp/ota-store-tools/bin/kou generate iphone.yaml
rtk proxy /private/tmp/ota-store-tools/bin/kou generate ipad.yaml
```

模板配置使用 `frame: false`，设备名称只是 Koubou 的资源元数据和中间目录名。最终规格以 `output_size`、布局检查和 `ready/` 为准。

### 7. 校验并打包

当前 6.5 英寸规格执行：

```sh
rtk proxy /private/tmp/ota-store-tools/bin/python package-assets.py --profile iphone-6.5
```

原版 6.9 英寸 iPhone + 13 英寸 iPad 组合执行：

```sh
rtk proxy /private/tmp/ota-store-tools/bin/python package-assets.py
```

自动校验至少包括：

- 文件数量和 `01–06` 顺序。
- 每张图精确像素尺寸。
- PNG 可解码、RGB 模式且无 alpha/透明通道。
- 标题、副标题和设备区域均在画布内且没有布局重叠。
- 最终文件与原始截图的 SHA-256 记录。
- ZIP 可完整解压且只包含目标栏位需要的 PNG。

### 8. 人工验收

打开所有最终图片和预览总览图，检查：

- 中文没有错字、乱码、溢出或截断。
- App 界面比例正确，没有拉伸、裁切或遮挡关键内容。
- 状态栏一致，且没有开发 UI、弹窗、加载态和空白错误态。
- 六张图讲述顺序合理，首页放在第一张，核心卖点在前三张。
- 截图展示的功能、统计数值和隐私表述与当前提审构建一致。
- 人物和演示资料均为虚构或已授权，没有私人信息。

完成后给用户提供目标栏位专用 ZIP、文件夹路径、尺寸和预览。明确提醒解压后上传 PNG，不要上传 ZIP 或预览总览图。

## 成功标准

- App Store Connect 接受每个目标栏位的全部图片，不再出现尺寸错误。
- iPhone 与 iPad 素材分别上传到正确设备栏位。
- 所有图片通过自动检查和逐张人工检查。
- 原始截图、最终成品和校验记录只保存在本地；Git 状态只出现预期的脚本、模板和文档。
- 关闭本次创建的模拟器和独立 Metro，且没有影响用户原有设备或开发服务。

## 常见失败与处理

### 提示“截屏尺寸存在错误”

先看当前上传栏位给出的精确尺寸。重新设置画布并导出，不能只改文件名。对于当前出现过的情况：

- `1320 × 2868`：iPhone 6.9 英寸。
- `1284 × 2778` 或 `1242 × 2688`：iPhone 6.5 英寸。

重新导出后再次检查每张 PNG 的像素尺寸和透明通道。

### 日历或统计页为空

固定日期已经过期，或深链参数没有恢复选中状态。选择演示数据实际存在的日期或年度，再单独覆盖该张原始截图并重新生成。

### 出现开发浮标或弹窗

不要后期修图删除。使用正确启动参数关闭开发 UI，处理弹窗后重新采集。

### 上传时混入错误规格

每个 ZIP 只保留一个目标栏位的图片，并在文件名中写明规格。iPhone 与 iPad 不共用上传包。

### 工作区已经有用户改动

只处理截图任务相关的文档、脚本和模板；不要回退、暂存或提交无关文件。
