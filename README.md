# ota log

本地优先的演出记录 App，面向日系 / 国内地下偶像、二次元 Live 等爱好者。

当前主目标平台是 iOS 和 Android，支持记录活动、艺人、拍立得、统计信息，以及部分围绕微博内容整理的辅助工具。

这是一个 vibe coding 的项目，几乎所有的代码都来自 Codex 和 Claude。

## 功能概览

- 活动记录：保存时间、场地、出演者、状态等信息
- 艺人管理：维护艺人资料、活动关联与主页展示
- 电子切册：记录拍立得、张数、价格和关联对象
- 首页概览：下一场活动、月度摘要、置顶信息卡片
- 统计视图：按时间查看活动、花费、场地等统计结果
- 重要日期：倒数日与纪念日功能
- 小工具：包括部分微博解析与导入辅助能力

## 技术栈

- Expo SDK 56
- Expo Router v6
- React Native 0.85
- TypeScript strict
- SQLite（`expo-sqlite`）

更多长期技术约束见 [docs/tech/stack.md](docs/tech/stack.md)。

## 仓库结构

```text
app/            Expo Router 页面入口
src/            业务组件、数据库、Repository、工具函数
assets/         应用图标与静态资源
docs/           产品、数据、技术、流程文档
scripts/        构建和补丁脚本
design/         一次性原型或视觉验证产物
```

## 环境要求

- Node.js
- npm
- Xcode（iOS 本地运行时需要）
- Android Studio + Android SDK（Android 本地运行时需要）

本仓库是移动端优先项目。`web` 脚本主要用于局部调试，不保证完整产品体验。

## 快速开始

### 1. 安装依赖

```sh
npm install
```

安装完成后会自动执行 `postinstall`，对少量第三方依赖打补丁。

### 2. 首次安装 Dev 版

iOS 模拟器：

```sh
npm run ios:dev
```

iOS 真机需要先通过 USB 连接并信任当前 Mac：

```sh
npm run ios:dev -- --device
```

Android 需要先启动模拟器，或连接已开启 USB 调试的真机：

```sh
npm run android
```

这些命令安装的都是独立的 `ota log Dev`，不会覆盖 Preview 或正式版。

### 3. 日常运行 Dev 版

Dev 版安装完成后，如果只修改 JavaScript、TypeScript、页面或样式，不需要重新构建原生 App。启动 Metro：

```sh
npm run start:dev
```

然后在设备上打开 `ota log Dev`。设备和开发电脑通常需要处于同一局域网；局域网连接有问题时可以使用：

```sh
npm run start:dev -- --tunnel
```

安装或升级原生依赖、修改 Expo config plugin、权限、Bundle ID、App Group 或小组件后，需要重新运行对应的 iOS 或 Android 安装命令。

## 应用版本与分发渠道

项目使用三个可安装身份和四个 EAS Build profile：

| Profile | App 名称 | Bundle ID / Package | 用途 | 是否依赖 Metro |
| --- | --- | --- | --- | --- |
| `development` | `ota log Dev` | `com.otalog.app.dev` | 日常开发与调试 | 是 |
| `preview` | `ota log Preview` | `com.otalog.app.preview` | Ad Hoc / APK 内部测试 | 否 |
| `beta` | `ota log` | `com.otalog.app` | TestFlight 发布候选版 | 否 |
| `production` | `ota log` | `com.otalog.app` | App Store 正式发布 | 否 |

`beta` 和 `production` 共用正式应用身份，以便 TestFlight 真实验证签名、小组件、数据迁移和覆盖升级。它们不能同时安装；Dev、Preview 和正式身份可以同时安装，且各自拥有独立的数据沙盒。

构建不依赖 Metro 的 Preview 包：

```sh
# EAS 云端构建
npx eas-cli@latest build --platform ios --profile preview
npx eas-cli@latest build --platform android --profile preview

# 在本机执行 EAS 构建流程
npx eas-cli@latest build --platform ios --profile preview --local
npx eas-cli@latest build --platform android --profile preview --local
```

iOS Preview 使用 Ad Hoc provisioning profile，只能安装到其中已登记 UDID 的设备；Android Preview 产物为可直接安装的 APK。完整发版步骤见 [docs/workflows/release.md](docs/workflows/release.md)。

## 关于 `ios/` 和 `android/`

根级 `ios/` 与 `android/` 目录在这个仓库里默认不跟踪，视为本地生成产物。

如果你的工作树里还没有这两个目录，或需要从当前 `app.json` 重新生成原生工程，可以执行：

```sh
npx expo prebuild
```

首次配置 Android 本地环境后，通常还需要在本机生成的 `android/local.properties` 中设置 SDK 路径。

## 常用命令

```sh
npx tsc --noEmit
npm test -- --runInBand
npm test -- --runInBand --no-cache
npx expo-doctor
```

项目内部的 agent 工作流会使用 `rtk` 前缀执行这些命令；普通本地开发不需要 `rtk`。

## 数据与隐私说明

- App 采用本地优先设计，核心数据存储在设备本地 SQLite。
- 图片会复制到应用私有目录，不依赖相册临时 URI。
- 如果使用微博相关工具，登录态和抓取流程仅用于当前设备上的本地辅助功能。

## 公开仓库与第三方素材

这个公开仓库默认不包含第三方艺人资料和头像素材。

- 公开构建下，新安装数据库中的预置艺人表为空
- 已有数据库中的历史艺人记录不会被自动删除
- 私有素材注入和 staging 构建流程见 [docs/workflows/private-artist-build.md](docs/workflows/private-artist-build.md)

如果你只是想运行公开源码，不需要准备这些私有素材。

## 文档入口

- 文档索引：[docs/README.md](docs/README.md)
- UI/UX 设计：[docs/product/ui-ux.md](docs/product/ui-ux.md)
- 数据结构设计：[docs/data/activity-data-model-design.md](docs/data/activity-data-model-design.md)
- 测试工作流：[docs/workflows/testing.md](docs/workflows/testing.md)
- 发版工作流：[docs/workflows/release.md](docs/workflows/release.md)

## 当前状态

- 主要面向个人使用场景持续迭代
- 仓库已整理为可公开阅读的源码结构
- 文档以中文为主

## License

本项目采用 [MIT License](LICENSE)。

除非另有说明，本许可证仅覆盖仓库中的源码与由你明确授权纳入仓库的内容，不自动扩展到第三方名称、商标、截图或私有素材。
