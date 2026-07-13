# ota-log

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

### 2. 启动 Expo 开发服务

```sh
npx expo start
```

### 3. 运行到本地原生环境

```sh
npx expo run:ios
npx expo run:android
```

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
