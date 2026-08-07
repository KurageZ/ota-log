# 技术选型

本文档记录 ota-log 当前技术栈、关键依赖约束和本地构建注意事项。具体版本以 `package.json`、`package-lock.json`、`app.json` 和原生工程配置为准。

## 当前栈

| 层级 | 选型 |
|------|------|
| 框架 | Expo SDK 56 + Expo Router v6 |
| 语言 | TypeScript strict |
| 样式 | inline styles + `useColorScheme()` |
| 数据库 | expo-sqlite |
| 图片 | expo-image-picker + 本地永久 URI |
| 渐变 | expo-linear-gradient |
| 日历 | react-native-calendars |
| 状态管理 | React Context + useReducer |
| UUID | expo-crypto `randomUUID()` |
| Setlist 拖拽 | react-native-draggable-flatlist |

## 关键依赖约束

- `react-native-worklets` 使用 Expo SDK 56 匹配的 0.8.x。
- expo-file-system SDK 56 使用 class-based API：`File`、`Paths`；`File.pickFileAsync()` 返回 `{ canceled, result }`。
- 图标统一通过 `src/components/AppIcon.tsx` 业务名映射到 `@react-native-vector-icons/lucide`。
- 数据库使用 `PRAGMA user_version` 管理 migration，当前主线为 v19。

## Android 本地构建

- `android/local.properties` 需要设置本机 Android SDK 路径，例如 `sdk.dir=/path/to/Android/sdk`。
- `android/gradle.properties` 需要设置 `expo.sqlite.enableFTS=true`，强制 expo-sqlite 从源码构建。

## 更新触发

- 升级 Expo SDK、React Native、Reanimated、Worklets 或 expo-sqlite。
- 更换路由、状态管理、图标、数据库、文件系统或构建方案。
- 新增需要本地环境配置的构建步骤。
