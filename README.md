# ota log

本地优先的演出记录 App，面向日系 / 国内地下偶像、二次元 Live 等爱好者。

当前主目标平台是 iOS 和 Android，支持记录活动、艺人、拍立得、统计信息，以及部分围绕微博内容整理的辅助工具。

这是一个 vibe coding 的项目，几乎所有的代码都来自 Codex 和 Claude。

## 产品亮点

 **活动记录与规划**：集中记录时间、场地和出演者，支持从公告文本或链接自动解析活动信息。
 **艺人与单推管理**：同时支持个人、团体、成员及所属关系；设置单推后，在活动、切册和统计等位置优先呈现。
 **灵活的电子切册**：拍立得可以有图或无图记录，并提供相册与记录两种浏览方式。
 **本地优先的数据体验**：核心数据保存在设备本地，同时提供外部导入、完整备份与恢复能力。
 **可定制的首页与统计**：按自己的使用习惯调整首页内容和统计模块，回顾活动、艺人与拍立得数据。
 **有趣的扩展工具**：拍立得贴纸相机可将切册照片组合进现场拍摄；iOS 还提供拍立得回忆和下一场活动桌面小组件。

## 技术栈

- Expo SDK 57
- Expo Router v6
- React Native 0.86
- TypeScript strict
- SQLite（`expo-sqlite`）
- expo-dev-client（Dev 版使用）

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
- Android Studio + Android SDK + JDK 17（Android 本地运行时需要）

本仓库是移动端优先项目。`web` 脚本主要用于局部调试，不保证完整产品体验。

## 快速开始

以下流程构建的是本地 Dev 版本：独立的 `ota log Dev`（`com.otalog.app.dev`），带 expo-dev-client，可连接 Metro 实时开发，不会覆盖 Preview 或正式版。

### 1. 安装依赖

```sh
npm install
```

安装完成后会自动执行 `postinstall`，对少量第三方依赖打补丁。

### 2. 生成本地原生工程（首次或原生配置变更后）

根级 `ios/` 与 `android/` 默认不跟踪、视为本地生成产物。工作树中缺失这两个目录，或需要从当前 `app.json` / `app.config.js` 重新生成时，先执行下面的命令。必须带 `development` 变体，才会生成 Dev 版的 Bundle ID / Package：

```sh
# 同时生成 iOS 与 Android
APP_VARIANT=development npx expo prebuild --clean

# 也可以只生成单平台；iOS 已有等价脚本
npm run prebuild:ios:dev
```

注意：`prebuild --clean` 会删除并重新生成原生目录，本地未提交的原生改动会丢失。

### 3. 首次构建并安装 Dev 版

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

Android 本地构建还需要：

- `android/local.properties` 中设置本机 SDK 路径，例如 `sdk.dir=/path/to/Android/sdk`（Android Studio 首次打开会自动生成）
- 如需从源码构建 expo-sqlite（启用 FTS），在 `android/gradle.properties` 中加入 `expo.sqlite.enableFTS=true`，详见 [docs/tech/stack.md](docs/tech/stack.md)

这些命令安装的都是独立的 `ota log Dev`，不会覆盖 Preview 或正式版。

### 4. 日常运行 Dev 版

Dev 版安装完成后，如果只修改 JavaScript、TypeScript、页面或样式，不需要重新构建原生 App。启动 Metro：

```sh
npm run start:dev
```

然后在设备上打开 `ota log Dev`。设备和开发电脑通常需要处于同一局域网；局域网连接有问题时可以使用：

```sh
npm run start:dev -- --tunnel
```

安装或升级原生依赖、修改 Expo config plugin、权限、Bundle ID、App Group 或小组件后，需要重新执行第 2、3 步（必要时先用 `--clean` 重新 prebuild）。

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

## App Store 截图

商店截图使用独立的 iPhone / iPad 模拟器采集真实 App 界面，再通过本地 HTML 模板生成营销排版。演示数据必须是虚构内容，原始截图、导出图片、预览和 ZIP 只在本地保存，不提交 Git。

开始前必须以 App Store Connect 当前显示的设备栏位和 [Apple 官方截图规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/) 为准确认尺寸。不同栏位的图片不能混用；例如 `1320 × 2868` 属于 iPhone 6.9 英寸，要求 `1284 × 2778` 的 iPhone 6.5 英寸栏位需要单独导出。项目启用了 iPad 支持，因此还需准备 iPad 截图。

完整的模拟器隔离、演示数据、采集、排版、校验、打包和常见失败处理见 [App Store 截图工作流](docs/workflows/app-store-screenshots.md)。

## 关于 `ios/` 和 `android/`

根级 `ios/` 与 `android/` 目录在这个仓库里默认不跟踪，视为本地生成产物。缺失或需要从当前配置重新生成时，按上面「生成本地原生工程」的步骤执行 `APP_VARIANT=development npx expo prebuild --clean`；Preview / 正式版的原生工程由 EAS Build 在云端按 `eas.json` 生成，不需要本地 prebuild。

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
- App Store 截图工作流：[docs/workflows/app-store-screenshots.md](docs/workflows/app-store-screenshots.md)

## 当前状态

- 主要面向个人使用场景持续迭代
- 仓库已整理为可公开阅读的源码结构
- 文档以中文为主

## License

本项目采用 [MIT License](LICENSE)。

除非另有说明，本许可证仅覆盖仓库中的源码与由你明确授权纳入仓库的内容，不自动扩展到第三方名称、商标、截图或私有素材。
