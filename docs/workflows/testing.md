# 测试与验证工作流

本文档记录 ota-log 的常用验证流程。具体命令以当前 `package.json`、Jest 配置和项目环境为准。

## 基线验证

```sh
npx tsc --noEmit
npm test -- --runInBand
```

适用场景：

- 代码提交前和发版前运行基线。
- 开发过程中，修改 TypeScript 类型、共享工具、Repository、组件 props 时运行 TypeScript 检查，并按行为变化选择相关测试。
- 纯文档和不影响代码行为的静态材料改动只检查内容与引用，不运行代码测试。
- 同一代码状态已通过的检查无需重复；后续修改影响检查结果时才重跑。

## 数据库改动验证

以下位置发生数据库结构、SQL、数据读写或聚合行为变化时，补充或更新 `src/db/__tests__/` 下的相关测试；仅改注释或格式不要求新增测试：

- `src/db/schema.ts`
- `src/db/migrations.ts`
- `src/repositories/**`
- 数据映射、聚合逻辑或 migration fixture

按本次影响选择验收项：

- schema 或 migration 变化：新版本结构正确。
- migration 变化：上一版本升级后旧数据仍可读取。
- 表重建：旧数据字段一致。
- Repository 行为变化：测试覆盖新增或改变的 SQL 逻辑。

## UI 改动验证

检查本次改变的界面及受影响状态，不因局部改动回归所有页面：

- 浅色和深色模式均可读。
- 主要文本不溢出、不遮挡。
- 空状态、加载态、错误态可用。
- iOS/Android 图标和字体加载稳定。
- 活动、艺人的新建和编辑页：Android 使用普通 modal（活动新建为 fullScreenModal），iOS 保留 formSheet；检查顶部取消/保存、表单双向滚动和键盘弹出后的字段可达性。Android formSheet 不支持原生导航栏，不能将 iOS 的 sheet 配置直接应用到 Android。

涉及视觉结构大改时，优先在 `design/` 放一次性 HTML 原型或截图检查说明；除非明确要求，不把原型作为功能提交的一部分。

## 常见问题

- EAS iOS 多 variant 构建：`app.config.js` 必须同步主应用 Bundle ID、`extra.eas.build.experimental.ios.appExtensions` 中的小组件 Bundle ID 和 App Group；否则 development / preview 可能选到生产版描述文件。回归检查：`rtk proxy npx jest scripts/__tests__/app-config.test.ts --runInBand`。
- Jest 缓存或空间问题导致异常时，可尝试 `npm test -- --runInBand --no-cache`。
- 数据库测试失败时，先区分 schema/migration 问题和测试适配器问题。
- Expo/原生构建问题需要单独记录实际错误、Node 版本、设备/模拟器状态和本地 SDK 配置。
