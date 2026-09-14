# ota_log agent instructions

本文件是 coding agent 的短入口。完整产品、数据、决策、进度和工作流说明放在 `docs/`，不要把长期设计讨论继续堆回这里。

## Project Snapshot

- 产品：本地优先的 Otaku 演出记录 App，面向日系 / 国内偶像、团体活动爱好者。
- 平台：iOS + Android，Expo SDK 57 + Expo Router（版本以 `package.json` 为准）。
- 数据：本地 SQLite，migration 版本以 `src/db/migrations.ts` 的 `CURRENT_VERSION` 为准（当前 v23）；`trips` 表仍保留为历史遗留，前台功能已下线。
- 主要模块：活动、艺人、切册、统计、个人资料、设置、小工具。

## Documentation Map

- 完整文档索引：[docs/README.md](docs/README.md)，按任务查阅。
- 数据库及 UI 验证：[testing.md](docs/workflows/testing.md)。
- 发版：[release.md](docs/workflows/release.md)。
- App Store 截图：[app-store-screenshots.md](docs/workflows/app-store-screenshots.md)。

任务范围以用户当前请求及明确指定的 issue 为准。不维护或重建 `now.md`，也不另建全局“当前进度”替代文件；历史计划不构成执行授权。

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

1. 依据现有代码和任务上下文决定常规实现细节，并说明影响结果的假设与取舍；仅在缺失信息会改变任务范围、对外行为或不可逆操作时询问。
2. 只写解决当前问题的最小代码，不做任何推测性功能。
3. 只修改必须改的地方，只清理自己产生的问题。
4. 按本次任务定义成功标准，修复本次改动造成的问题并验证；相关检查通过后停止，不扩大到无关修复或反复打磨。无法执行的验证说明限制，不以等待替代仍可完成的工作。

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

- 修改数据库结构、SQL 或数据读写行为时，必须补充或更新 `src/db/__tests__/` 下的相关测试；仅改注释或格式不要求新增测试。
- 新增 migration 至少覆盖：升级后的结构、代表性旧数据保留、表重建时字段一致。
- 修改 TypeScript 类型、共享工具、Repository 或测试辅助代码时，至少跑 `npx tsc --noEmit`。
- 代码提交前常规基线是 `npx tsc --noEmit` 和 `npm test -- --runInBand`；纯文档和不影响代码行为的静态材料改动只检查内容与引用。同一代码状态已通过的检查无需重复。
- 如果 Jest 缓存写入或空间问题导致异常，改用 `npm test -- --runInBand --no-cache` 复核。

## Product And UI Rules

- 设计事实以当前代码为准；跨页面规则见 `docs/product/ui-ux.md`，页面规范和验收标准按其中链接查阅对应专题。
- UI 改动先复用现有 theme、共享组件和页面结构，不做无关重绘。
- 宽屏布局按窗口宽度（`src/utils/windowMode.ts`）切换，不按设备型号判断；页面水平边距统一使用 `ReadingContainer` / `DashboardContainer`（`src/components/adaptive/AppContainers.tsx`），不硬编码 16px。
- 如果 UI 方向未定，优先在 `design/` 做一次性 HTML 原型；除非用户明确要求，不把原型纳入功能提交。
- 文字、按钮、卡片和状态必须同时检查浅色/深色模式，避免溢出、遮挡和只靠颜色表达状态。

## Git And Release Rules

- Conventional Commits 第一行必须是英文，格式为 `<type>: <summary>`。
- commit 正文可用中文说明改动内容、范围、注意事项和验证方法。
- 发版按 `docs/workflows/release.md` 执行，并同步 `package.json`、`package-lock.json`、`app.json`、`src/utils/appInfo.ts` 和 `CHANGELOG.md`；关于页通过 `APP_VERSION_LABEL` 显示版本，无需重复硬编码版本号。
- 生成 App Store 截图前必须阅读 `docs/workflows/app-store-screenshots.md`：使用隔离的 `ota-log Store ` 模拟器和虚构演示数据，先核对实际上传栏位尺寸，再采集、排版、自动校验和逐张检查。不得写入用户日常模拟器，不得提交原始截图、生成图片、QA 数据或 ZIP；未经用户明确授权不得上传 App Store Connect。
- 本次改动改变了文档中的行为、约束或工作流时，同步对应权威文档；无需为每次提交遍历或更新全部文档。
- 工作区可能有用户未提交改动；只处理本任务相关文件，不回退无关改动。
