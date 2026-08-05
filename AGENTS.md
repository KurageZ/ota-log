# ota_log agent instructions

本文件是 coding agent 的短入口。完整产品、数据、决策、进度和工作流说明放在 `docs/`，不要把长期设计讨论继续堆回这里。

## Project Snapshot

- 产品：本地优先的 Otaku 演出记录 App，面向日系 / 国内偶像、团体活动爱好者。
- 平台：iOS + Android，Expo SDK 56 + Expo Router v6。
- 数据：本地 SQLite，当前 migration 版本 v17；`trip` 表仍保留为历史遗留，前台功能已下线。
- 主要模块：活动、艺人、切册、统计、个人资料、设置、小工具。

## Documentation Map

- 文档索引：`docs/README.md`
- UI/UX 设计：`docs/product/ui-ux.md`
  - 根目录 `design.md` 是指向该文件的软链接，保留旧入口。
- 活动数据结构设计：`docs/data/activity-data-model-design.md`
- 拍立得数据结构设计：`docs/data/cheki-data-model-design.md`
- 技术选型：`docs/tech/stack.md`
- 决策记录模板：`docs/decisions/0000-template.md`
- 当前进度：`docs/progress/now.md`
- 测试验证工作流：`docs/workflows/testing.md`
- 发版工作流：`docs/workflows/release.md`

本次文档结构调整：将长期上下文集中到 `docs/`；完整 UI/UX 设计文档已从根目录迁入 `docs/product/ui-ux.md`，根目录 `design.md` 只作为兼容软链接；`AGENTS.md` 只保留 agent 每次都需要的规则、命令和入口。

## Commands

- TypeScript：`npx tsc --noEmit`
- Jest：`npm test -- --runInBand`
- Jest 无缓存：`npm test -- --runInBand --no-cache`
- APK 构建：`./build_apk.sh`
- Expo Doctor：`npx expo-doctor`

优先使用 `rtk` 前缀执行项目命令。涉及发版、数据库、UI 大改时，按 `docs/workflows/` 的对应文档验证。

## Implementation Rules

- TypeScript strict；样式使用 inline styles + `useColorScheme()`，不使用 NativeWind `className`。
- 所有 ID 使用 UUID v4：`expo-crypto.randomUUID()`。
- 日期存 `YYYY-MM-DD`，时间存 `HH:MM`，时间戳存 ISO 8601。
- 图片必须通过 `copyToDocuments()` 保存为永久 URI；不要保存相册临时 URI；删除记录时不删本地文件。
- expo-file-system SDK 56 使用 class-based API：`new File(Paths.document, name)`、`file.copy()`、`file.write()`；`File.pickFileAsync()` 返回 `{ canceled, result }`。
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
- 如果 UI 方向未定，优先在 `design/` 做一次性 HTML 原型；除非用户明确要求，不把原型纳入功能提交。
- 文字、按钮、卡片和状态必须同时检查浅色/深色模式，避免溢出、遮挡和只靠颜色表达状态。

## Git And Release Rules

- Conventional Commits 第一行必须是英文，格式为 `<type>: <summary>`。
- commit 正文可用中文说明改动内容、范围、注意事项和验证方法。
- 不要在 `git commit -m` 字符串里写字面量 `\n`；Git 不会把它解释成换行，而是会原样写进 commit message。
- 需要多段正文时，优先使用多个 `-m` 参数，例如：`git commit -m "fix: ..." -m "第一段" -m "第二段"`。
- 提交或 amend 后，使用 `git show --no-patch --format=raw HEAD` 复核 commit message，确认正文是实际换行而不是字面量 `\n`。
- 发版按 `docs/workflows/release.md` 执行，并同步 `package.json`、`app.json`、`CHANGELOG.md`、`app/about.tsx`。
- 提交前检查 `AGENTS.md` 和 `docs/` 是否需要同步更新。
- 工作区可能有用户未提交改动；只处理本任务相关文件，不回退无关改动。
