# ota_log agent instructions

本文件是 coding agent 的短入口。完整产品、数据、决策、进度和工作流说明放在 `docs/`，不要把长期设计讨论继续堆回这里。

## Project Snapshot

- 产品：本地优先的 Otaku 演出记录 App，面向日系 / 国内偶像、团体活动爱好者。
- 平台：iOS + Android，Expo SDK 57 + Expo Router（版本以 `package.json` 为准）。
- 数据：本地 SQLite，migration 版本以 `src/db/migrations.ts` 的 `CURRENT_VERSION` 为准（当前 v23）；`trips` 表仍保留为历史遗留，前台功能已下线。
- 主要模块：活动、艺人、切册、统计、个人资料、设置、小工具。

## Documentation Map

- 文档索引：`docs/README.md`
- UI/UX 设计：`docs/product/ui-ux.md`
  - 根目录 `design.md` 是指向该文件的软链接，保留旧入口。
- 统计自定义功能设计：`docs/product/stats-customization.md`
- 活动数据结构设计：`docs/data/activity-data-model-design.md`
- 拍立得数据结构设计：`docs/data/cheki-data-model-design.md`
- 技术选型：`docs/tech/stack.md`
- 决策记录模板：`docs/decisions/0000-template.md`
- iPad 自适应布局决策：`docs/decisions/0002-ipad-adaptive-layout.md`
- 当前进度：`docs/progress/now.md`
- iPad 自适应布局进度：`docs/progress/ipad-adaptation.md`
- 测试验证工作流：`docs/workflows/testing.md`
- 发版工作流：`docs/workflows/release.md`
- App Store 截图工作流：`docs/workflows/app-store-screenshots.md`
- 对外发布材料：`publishing/README.md`

开始任务前查看 `docs/progress/now.md` 的当前阶段与范围约束；其他专题文档通过 `docs/README.md` 按需查阅。

## Commands

- 开发服务：`npm run start:dev`
- 本地开发构建：`npm run ios:dev` / `npm run android`
- TypeScript：`npx tsc --noEmit`
- Jest：`npm test -- --runInBand`
- Jest 无缓存：`npm test -- --runInBand --no-cache`
- APK 构建：`./build_apk.sh`
- Expo Doctor：`npx expo-doctor`

命令使用 `rtk` 前缀；不支持的子命令通过 `rtk proxy <command>` 执行。涉及发版、数据库、UI 大改时，按 `docs/workflows/` 的对应文档验证。

## 行为规则

1. 不要假设。不要隐藏困惑。主动暴露权衡取舍。
2. 只写解决当前问题的最小代码，不做任何推测性功能。
3. 只修改必须改的地方，只清理自己产生的问题。
4. 明确定义成功标准，验证通过前持续迭代。

### 反过度工程 / 反防御性编程

- 信任内部代码和框架保证。
- 只在系统边界（用户输入、外部 API、网络）做校验。
- 禁止为「不可能发生」的场景添加错误处理、回退、空值检查或验证。
- 绝不吞掉错误（禁止 `rescue nil` / 宽泛 `catch` / 静默默认值）。
- 禁止为一次性操作创建辅助函数、工具类或抽象。
- 优先快速失败，而不是掩盖问题。

## Implementation Rules

- TypeScript strict；样式使用 inline styles + `useAppTheme()`（`src/theme/appTheme.ts`），遵循用户选择的主题与外观，不直接用系统 `useColorScheme()` 决定页面配色；不使用 NativeWind `className`。
- 开发构建使用上述 npm 脚本设置 `APP_VARIANT=development`；`app.config.js` 管理 development / preview / production 的应用标识，未设置时沿用 `app.json` 的生产标识。
- 所有 ID 使用 UUID v4：`expo-crypto.randomUUID()`。
- 日期存 `YYYY-MM-DD`，时间存 `HH:MM`，时间戳存 ISO 8601。
- 图片必须通过 `copyToDocuments()` 保存为永久 URI；不要保存相册临时 URI；删除记录时不删本地文件。
- expo-file-system SDK 57 使用 class-based API：`new File(Paths.document, name)`、`file.copy()`、`file.write()`；`File.pickFileAsync()` 返回 `{ canceled, result }`。
- 图标必须通过 `src/components/AppIcon.tsx` 的业务名映射使用；页面和业务组件不要直接 import Lucide、Ionicons、`@expo/vector-icons` 或其他具体 icon 包。
- 单推头像使用 `OshiAvatar`；右上角是红色实心 heart，不加圆形底或外框。
- 数据库版本通过 `PRAGMA user_version` 管理；新增字段优先增量 `ALTER TABLE`，需要修改约束或列定义时才使用表重建模式。

## Testing Rules

- 修改数据库相关代码时，必须补充或更新 `src/db/__tests__/` 下的测试。
- 新增 migration 至少覆盖：升级后的结构、代表性旧数据保留、表重建时字段一致。
- 修改 TypeScript 类型、共享工具、Repository 或测试辅助代码时，至少跑 `npx tsc --noEmit`。
- 提交前常规基线是 `npx tsc --noEmit` 和 `npm test -- --runInBand`。
- 如果 Jest 缓存写入或空间问题导致异常，改用 `npm test -- --runInBand --no-cache` 复核。

## Product And UI Rules

- 设计事实以当前代码为准；设计意图、验收标准和页面规范见 `docs/product/ui-ux.md`。
- UI 改动先复用现有 theme、共享组件和页面结构，不做无关重绘。
- 宽屏布局按窗口宽度（`src/utils/windowMode.ts`）切换，不按设备型号判断；页面水平边距统一使用 `ReadingContainer` / `DashboardContainer`（`src/components/adaptive/AppContainers.tsx`），不硬编码 16px。
- 如果 UI 方向未定，优先在 `design/` 做一次性 HTML 原型；除非用户明确要求，不把原型纳入功能提交。
- 文字、按钮、卡片和状态必须同时检查浅色/深色模式，避免溢出、遮挡和只靠颜色表达状态。

## Git And Release Rules

- Conventional Commits 第一行必须是英文，格式为 `<type>: <summary>`。
- commit 正文可用中文说明改动内容、范围、注意事项和验证方法。
- 发版按 `docs/workflows/release.md` 执行，并同步 `package.json`、`package-lock.json`、`app.json`、`src/utils/appInfo.ts` 和 `CHANGELOG.md`；关于页通过 `APP_VERSION_LABEL` 显示版本，无需重复硬编码版本号。
- 生成 App Store 截图前必须阅读 `docs/workflows/app-store-screenshots.md`：使用隔离的 `ota-log Store ` 模拟器和虚构演示数据，先核对实际上传栏位尺寸，再采集、排版、自动校验和逐张检查。不得写入用户日常模拟器，不得提交原始截图、生成图片、QA 数据或 ZIP；未经用户明确授权不得上传 App Store Connect。
- 提交前检查 `AGENTS.md` 和 `docs/` 是否需要同步更新。
- 工作区可能有用户未提交改动；只处理本任务相关文件，不回退无关改动。
