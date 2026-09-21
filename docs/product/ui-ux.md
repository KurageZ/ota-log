# UI/UX 跨页面规范

本文件只维护跨页面的主题、排版、共享组件、导航和交互规则。产品定位与原则见 [PRODUCT.md](../../PRODUCT.md)，领域术语见 [CONTEXT.md](../../CONTEXT.md)。具体值与实现签名以代码为准，不在这里维护版本快照。

改变共享规则时更新对应段落；页面细节更新下列专题。只读取本次任务相关内容，不要求遍历所有文档。

## 页面专题

- [首页与置顶信息](home-pinned-info.md)
- [艺人管理与详情](artist-pages.md)
- [电子切册与记录表单](cheki-pages.md) · [筛选条件](cheki-filter-refactor.md)
- [日历](calendar.md) · [统计](stats-customization.md)
- [活动详情与表单](event-pages.md) · [活动分享](event-sharing.md)
- [我的、设置与关于](profile-settings.md)
- [工具箱与外部导入](tools.md) · [新手引导](onboarding.md)
- [iOS 小组件呈现](ios-widget-presentation.md) · [分组模型](ios-cheki-widget-groups.md) · [实时活动](live-activity.md)

## 信息架构

### 底部导航

当前底部导航按平台实现：iOS 使用 Expo Router `NativeTabs`，采用系统 Liquid Glass tab bar 和滚动最小化行为；Android 保留五个等宽悬浮胶囊 tab。两端入口和业务语义一致：

- 首页：`app/(tabs)/(home)/index.tsx`
- 日历：`app/(tabs)/calendar/index.tsx`
- 切册：`app/(tabs)/cheki/index.tsx`，页面标题保留「电子切册」
- 统计：`app/(tabs)/stats/index.tsx`
- 我的：`app/(tabs)/profile/index.tsx`

新建活动不放在底部导航常驻入口，改由首页右上角和所有活动页右上角进入 `/events/compose`。

## 主题系统

主题偏好由 `useThemePreferences()` 持久化，实际取值通过 `useAppTheme()` 使用。

```ts
type AppThemeId = 'monoChrome' | 'classicViolet' | 'nightNeon';
type AppAppearance = 'system' | 'light' | 'dark';
type AppCalendarWeekStart = 'sunday' | 'monday';
```

默认值：

```ts
DEFAULT_THEME_ID = 'monoChrome';
DEFAULT_APPEARANCE = 'system';
DEFAULT_CALENDAR_WEEK_START = 'sunday';
```

主题标签：

| ID | UI 标签 | 用途 |
|----|---------|------|
| `monoChrome` | 极简 | 默认主题，低色彩背景配合多彩入口 icon |
| `classicViolet` | 紫色 | 品牌主题 |
| `nightNeon` | 粉色 | 更强情绪色主题 |

使用规则：

- 新代码取色必须优先走 `colors.xxx`、`theme.status[status]` 或明确的共享 helper。
- 不要按视觉相近随便拿 token。按用途取：文本用 `text/textSecondary/textMuted`，边框用 `divider/inputBorder`，主操作用 `accent/onAccent`。
- 角色 tint 可以存在，例如 `featureEvents/featureArtists/featureCheki`，但应进入 theme token。页面内临时硬编码只适合迁移期或明确的一次性品牌色。
- Profile、Settings、Tools 的菜单入口 icon tint 使用 `profileMenu`、`settingsMenu`、`toolsMenu`。极简主题允许这些入口保持多彩，用于提升入口识别度；不要在页面内直接写菜单色值。
- 深色模式不能用结构 token 当文本色。文本优先使用 `colors.text` 或 `colors.textSecondary`。

### Classic Violet 基准色

| Token | 亮色 | 暗色 | 用途 |
|-------|------|------|------|
| `screen` | `#f5f3ff` | `#0f0a1e` | 页面底色 |
| `header` | `#ffffff` | `#0f0a1e` | Stack header |
| `card` | `#ffffff` | `#1e1b4b` | 卡片和菜单容器 |
| `cardAlt` | `#f3f4f6` | `#1f2937` | 次级块、chip 底 |
| `cardMuted` | `#f9f9f9` | `#111827` | 展开面板、弱背景 |
| `input` | `#ffffff` | `#1f2937` | 输入框 |
| `inputBorder` | `#e5e7eb` | `#374151` | 输入边框 |
| `divider` | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.06)` | 分隔线 |
| `text` | `#111827` | `#f3f4f6` | 主文字 |
| `heading` | `#1f1235` | `#f9fafb` | 标题 |
| `textSecondary` | `#6b7280` | `#9ca3af` | 次级文字 |
| `textMuted` | `#9ca3af` | `#6b7280` | 三级文字 |
| `placeholder` | `#9ca3af` | `#4b5563` | 占位文字 |
| `accent` | `#7c3aed` | `#7c3aed` | 主操作、选中态 |
| `accentStrong` | `#6d28d9` | `#6d28d9` | Hero、强品牌块 |
| `accentSoft` | `rgba(124,58,237,0.12)` | 同亮色 | badge、浅底 |
| `onAccent` | `#ffffff` | `#ffffff` | accent 背景上的文字 |
| `danger` | `#ef4444` | `#ef4444` | 删除、错误 |
| `success` | `#16a34a` | `#16a34a` | 成功 |
| `warning` | `#d97706` | `#d97706` | 提醒 |
| `info` | `#2563eb` | `#2563eb` | 信息 |
| `scrim` | `rgba(0,0,0,0.55)` | 同亮色 | Modal 遮罩 |

### 状态色

状态色来自 `theme.status[status]`，与 `STATUS_LABELS` 一一对应：

| 状态 | 文案 | 语义 |
|------|------|------|
| `completed` | 已完成 | 已参加或已记录 |
| `planned` | 计划中 | 已确定会去 |
| `wishlist` | 心愿单 | 想去但未确定 |
| `cancelled` | 已取消 | 取消或作废 |

### 单推色

| Token | 用途 |
|-------|------|
| `oshiBadgeBg` | 单推 badge 与心形主色 |
| `oshiBadgeBgInverted` | 反色 badge 背景 |
| `oshiBadgeBorder` | 反色 badge 边框 |
| `oshiBadgeText` / `oshiBadgeTextInverted` | badge 文字 |
| `oshiAvatarBg` | 单推和普通头像底色 |
| `oshiHeartBg` / `oshiHeartBorder` | 单推头像心形标记 |
| `oshiGradient` | 单推头像环、单推命中 chip |

## 字体与排版

使用系统字体，不引入自定义字体文件。中文环境以 iOS/Android 系统 sans 为准。

| 用途 | Size | Weight | 说明 |
|------|------|--------|------|
| 页面标题 | 24-26 | 800-900 | 日历、统计、艺人管理等 |
| 详情页主标题 | 20-24 | 800-900 | 活动详情、艺人详情 |
| 卡片标题 | 16 | 700-800 | EventCard、首页卡片 |
| 列表标题 | 14-15 | 600-800 | 菜单、排行、列表 |
| 正文 | 14 | 400-500 | 备注、说明，`lineHeight` 约 20-22 |
| 次级信息 | 12.5-13 | 400-600 | 日期、地点、副标题 |
| 三级信息 | 11-12 | 400-600 | 空态辅助、标签说明 |
| 列表 Section 标题 | 17 | 800 | 月份/日期分组标题，accent 色 + 计数胶囊，`lineHeight: 35`，左侧 3x16 accent 竖条 |
| SectionLabel | 17 | 500 | `lineHeight: 35`，左侧 3x16 accent 竖条 |
| Badge / chip | 10-12 | 600-800 | 状态、计数、单推 |
| Setlist | 14 | 400 | `fontFamily: 'monospace'` |

规则：

- 产品 UI 不使用 display 字体。
- 不使用斜体或下划线表达强调。
- 数字对齐场景使用 `fontVariant: ['tabular-nums']`。
- 不随视口宽度动态缩放字号。窄屏通过换行、截断和 `adjustsFontSizeToFit` 局部兜底。

## 日期显示

App 内日期 / 月份显示统一使用横杠分隔的 ISO 风格短格式：

- 月份：`YYYY-MM`，例如 `2026-08`。
- 完整日期：`YYYY-MM-DD`，例如 `2026-08-14`。

列表月份 section 标题等日期分组标题必须使用该格式，不使用「2026年8月」等中文年月写法；存储格式即显示格式，不需要二次本地化。

例外（口语化业务文案，不适用本规范）：含星期或相对表达的日期（如「2026年8月14日 周五」「8月15日 周三」「今天」「周三」）、统计周期导航文案（如「2026 年 8 月」「2026/08/10 – 2026/08/16」）、表单输入占位符提示。

## 圆角、阴影和间距

### 圆角

| 场景 | 值 |
|------|----|
| Profile 身份卡、艺人详情身份卡 | 24 |
| HomeUpcomingHero | 22 |
| Mini countdown、菜单组、EventCard | 18-20 |
| 通用卡、统计卡、Modal 内容块 | 16 |
| 列表行内部块、子卡 | 14 |
| 输入框 | 10-12 |
| 图片缩略图 | 10 |
| 菜单图标容器 | 10 |
| Chip / Badge / 状态 pill / OshiBadge | 999 |
| Android floating tab shell | 32 |
| Header icon button | 18-24, 触控目标不低于 44x44 |

### 阴影

- 通用卡：`shadowOffset: { width: 0, height: 4 }`，`shadowOpacity` 约 0.08-0.2，`shadowRadius` 14，`elevation` 3。
- 菜单卡：`shadowOffset: { width: 0, height: 2 }`，`shadowOpacity` 0.06，`shadowRadius` 8，`elevation` 2。
- 首页卡片：边框用 `divider`，阴影更轻，避免整页像卡片墙。
- 首页置顶信息 / HomeUpcomingHero：`shadowOffset: { width: 0, height: 8 }`，亮色 `opacity 0.12`，暗色 `0.26`。
- Android floating tab bar 使用 `boxShadow`，亮色 `0 12px 26px rgba(31,18,53,0.12)`，暗色 `0 14px 34px rgba(0,0,0,0.36)`；iOS NativeTabs 的材质和阴影交给系统管理。

### 间距

- 4px 基础网格。
- 页面左右 gutter：16px。
- 卡片内边距：14-16px。
- 卡片间距：10-12px。
- Section 间距：16-24px，Profile 上常用 20px。
- 触控目标：主要可点区域不低于 44x44。

## 共享组件

### 页面层级：Section / 卡片 / 字段

ota_log 大量采用卡片式布局，页面层级统一按「section -> 卡片 -> 字段」理解。

Section 是页面级分组。Section 标题放在卡片外，左侧使用 3x16 accent 竖条。页面级列表 / 日历分组（活动月份、电子切册记录月份、日历当天详情模块）统一使用 `EventSectionHeader`：标题 17/800 accent 色 + 计数胶囊（accentSoft 底、11/700）；表单与设置菜单分组使用 `SectionLabel` / `FormSectionLabel`（17/500 heading 色）。一个 section 内可以包含一个或多个卡片。

卡片是内容容器。卡片标题和描述语都是可选的：统计卡、排行卡、独立信息块等需要解释口径或内容时，可以在卡片内部使用加粗标题和辅助描述；普通表单字段组不需要卡片标题，因为 section 已经说明上下文。

字段是单个输入框、选择器、开关、日期、价格等控件。字段名是字段标签，不是标题。一组相关字段应该共用同一个卡片，例如「基础信息」下的「标题 / 日期 / 备注」；不要把同一组普通字段裸露在页面背景上，也不要把每个字段都拆成单独卡片。

例外：如果 section 内本身是一组可点击选项卡、菜单行、设置行、开关列表或独立卡片列表，它们已经是卡片 / 列表形态，不再额外包一层，避免卡片套卡片。

### SettingsMenu

文件：`src/components/SettingsMenu.tsx`

包含 `SectionLabel`、`MenuCard`、`MenuItem`、`SettingsChoiceCard`、`MenuRowSeparator`。

`SectionLabel` 规范：

- 容器横向排列，左侧为 3x16 accent 竖条，圆角 999。
- 标题文字 17/500，`lineHeight: 35`，颜色使用 `colors.heading`。
- 不使用 uppercase 或额外字间距。

页面级列表 / 月份分组标题不使用本节样式，统一改用 `EventSectionHeader`（17/800 accent + 计数胶囊，见上方「页面层级」说明）。

`MenuItem` 规范：

- 左侧图标容器 34x34，圆角 10，背景 `${tint}22`。
- icon 18px。
- label 15/500。
- subtitle 12，最多 2 行。
- badge 使用 `${tint}20` 背景，12/700。
- trailing icon 固定 `chevron-forward` 16px。
- `activeOpacity` 0.6。

用于 Profile、Settings、About、Tools 等导航式列表。新设置入口优先复用它。

`SettingsChoiceCard` 规范：

- 独立单选页的选项卡片：每行 label 15/500 + 可选描述（12，`lineHeight` 17）+ trailing radio。
- 单选选中项使用 `radio selected`（accent 实心 + 白点），`pending` 时显示 spinner 并禁用。
- 支持可选 `leadingColorOf` 在 label 前展示色点（如主题色选项）。
- 行间分隔使用 `MenuRowSeparator`（`leadingInset` 16）。
- 用于外观、功能等子页内的直选单选，不折叠。

`MenuRowSeparator` 规范：

- 行分隔线使用 `divider`，高度 `hairlineWidth`。
- 左侧 `marginLeft: 62`，与文字起始位置平齐（跳过 16 padding + 34 icon + 12 间距）；右侧 `marginRight: 16`，不触达卡片边界。
- 通过可选 `leadingInset` 调整左侧缩进；无 icon 的独立单选页（如 `/settings/appearance`、`/settings/features`）传 16。
- `MenuItem` 与 `SettingsChoiceCard` 的行间分隔统一使用该组件。

### AnimatedPressable

文件：`src/components/AnimatedPressable.tsx`

用于首页未来活动时间线等低数量卡片的轻量按压反馈。

- 使用 Reanimated，不使用 React Native `Animated`。
- 默认按压态：`scale 0.97`，`opacity 0.76`。
- 按下 70ms，松开 120ms，只动画 `transform` 和 `opacity`，不动画布局属性。
- 不用于普通文本链接、Modal 遮罩、拖拽手柄、长列表行或需要系统原生反馈的控件。
- 通用 `EventCard`、排行行等可能批量渲染的列表项继续使用 `TouchableOpacity`，避免页面切换和首屏 mount 变重。

### AppSwitch

文件：`src/components/AppSwitch.tsx`

所有开关统一使用 `AppSwitch`，不要在页面里直接使用 RN 原生 `Switch`。

- 包装 RN `Switch`，保留 `value` / `onValueChange` / `disabled` / `trackColor` / `thumbColor` / `accessibilityLabel` 等 props。
- 用户切换时触发轻触感（iOS `selection`，Android `Toggle_On` / `Toggle_Off`）；程序化赋值不触发。
- 不额外做动画，开关的视觉动效交给系统原生实现。

### 触感反馈

文件：`src/utils/haptics.ts`（页面与组件不直接 import `expo-haptics`）

触感是操作确认，不是装饰。映射如下：

| 动作 | iOS | Android |
| --- | --- | --- |
| 拖拽排序（开始/换位/结束） | selection / light impact | Drag_Start / Segment_Tick / Gesture_End |
| 收藏 / 取消收藏 | selection | Toggle_On / Toggle_Off |
| 开关切换 | selection | Toggle_On / Toggle_Off |
| 复制成功 | success | Confirm |
| 保存成功 | light impact | Confirm |
| 保存失败 / 操作错误 | error / warning | Reject |

规则：

- 不提供 App 内触感总开关；默认开启，遵守系统触感/振动设置（iOS 关闭系统触感后反馈自动失效，Android 跟随系统振动设置）。
- 表单校验失败（未点保存）不震动；只有实际保存失败才给 error 反馈。
- 装饰性动效（如收藏心形 pop）跟随系统「减少动态效果」（`useReducedMotionEnabled`）；触感不跟随，因为它属于反馈而非装饰。
- 高频反馈（如拖拽换位）需要在 `haptics.ts` 内节流，避免连续震动。

### SearchFilterBar

文件：`src/components/SearchFilterBar.tsx`

用于活动、艺人、拍立得等列表页的搜索与筛选入口。

- 搜索容器最小高度 44，圆角 10。
- 有 active filter chip 时搜索框自动换行，chip 最高 26px。
- 页面可通过 `showActiveFilters={false}` 保持纯搜索输入；此时搜索框固定为 44px，高亮筛选按钮并用数量 badge 表达筛选状态。
- 筛选按钮 44x44，激活时背景 `accent`，右上显示红色数量 badge。
- active filter chip 使用 `accent` 透明底和 `accentBorder`。

不要为相邻列表页重写一套搜索筛选 UI。

### BottomSheetDialog

- 普通底部面板统一复用 `BottomSheetDialog`：背景使用主题 `screen`，顶部圆角 24、拖动条 40×4，标题左对齐；右侧只放重置、全选、全部时间等辅助操作，不显示 × 关闭按钮。
- 点击遮罩、下滑与 Android 返回统一关闭；`dismissible={false}` 同时禁用这三种关闭方式，适用于分享图片生成及正在提交的操作。父组件主动关闭（应用或切换步骤）不触发取消回调。
- 默认正文可滚动并按内容高度展开，最大高度受窗口与安全区限制；面板宽度不超过阅读容器的 680，水平间距复用自适应 gutter。固定高度、内部自带列表的艺人搜索面板可以显式使用不可滚动外壳。
- 确认类面板使用固定 Footer 和 `BottomSheetAction`：主按钮最小高度 48、圆角 12，正文为 Footer 预留空间；Footer 统一处理底部安全区和键盘。单选菜单点选后关闭，偏好设置即时保存，两类面板不额外增加确认按钮。
- 原生新建/编辑表单 Sheet 与图片查看器内的信息面板保留各自实现。

### FilterSheet

文件：`src/components/FilterSheet.tsx`

底部筛选面板：

- 复用 `BottomSheetDialog` 的标题、遮罩、关闭与滚动行为，右侧为「重置」，底部固定「应用」。所有列表及小组件筛选修改草稿，应用后才更新结果，直接关闭丢弃草稿。
- 支持单选、多选、文本输入。
- Chip 视觉保持紧凑，但交互容器高度不低于 44，激活态使用 `accent/onAccent`。
- 输入型分区使用本地 draft 和 debounce，避免 URL 参数回写影响光标。
- 艺人筛选分区复用共享的 `ArtistSearchPicker`：已选项显示在搜索框上方，清除动作只在已选行上触发，候选列表只负责继续选择；候选排序规则与表单内选择器一致（单推及所属团体 > 收藏及所属团体 > 其他），并支持类型优先。
- 需要「应用 / 确认」的 Bottom Sheet 使用滚动区外的固定操作 Footer；Footer 统一承担底部安全区与键盘避让，内容区为其预留空间。即时生效的选择菜单不额外增加 Footer。

日期筛选头复用 `DateFilterHeader`，四个模式按钮保持等宽；选中后在按钮内显示日期（日、月分两行显示年份与月日，年直接显示年份），自定义按钮显示「自定义 / 已选范围」，下方保留完整日期摘要。日期摘要统一由 `src/utils/dateFilters.ts` 格式化；艺人筛选中的「单推 / 收藏艺人」快捷选择复用 `FilterBatchChip` 和 `toggleBatchSelection()`，不要在活动与电子切册页面各自维护一份实现。

日期选择作为筛选子步骤时使用「完成」，仅写回筛选草稿；自定义日期范围直接用于统计时使用「应用」。日历月份与统计周/月/年仍点选即生效并关闭。

### ArtistSearchPicker

文件：`src/components/ArtistSearchPicker.tsx`

用于活动表单、日期项、拍立得、单推设置、首页关注艺人、所属团体等表单内艺人选择，以及列表页筛选面板的艺人分区。

- 底层艺人行统一来自 `ArtistOptionRow`：头像、主名、副名/所属团体、单推标识和右侧状态图标。
- 已选艺人固定显示在搜索框上方的「已选中」区域，清除动作只在已选行右侧图标上触发。
- 搜索框下方候选列表只负责选择或替换，不显示删除图标，默认隐藏已选艺人。
- 候选列表排序：单推（及其所属团体）优先，其次收藏艺人（及其所属团体），最后其他艺人；各档内保持原有顺序。
- 支持 `typePreference` 参数：`'group'` 团体优先、`'person'` 个人优先、不传/null 不区分类型。总规则是单推艺人永远第一，其次类型优先，再其次收藏优先；`'group'` 时顺序为单推艺人、单推所属团体、收藏团体（及其所属团体）、其他团体、收藏个人、其他个人、未设置类型，`'person'` 时顺序为单推艺人、收藏个人、其他个人、团体、未设置类型。`artist_type` 未设置时按成员/所属关系推断：被其他艺人作为所属团体的视为团体，有所属团体的视为个人。
- 候选列表是子集时（例如筛选面板只列出有拍立得记录的艺人），可传 `lookup` 提供完整艺人库，用于按所属团体名称搜索与所属链解析。
- 所属关系选择可传入另一侧艺人的名称与简称作为推荐上下文：搜索词为空时，从名称中的完整别名或有效片段推断最多 3 个候选并提升到列表顶部，候选行显示「名称匹配 · 片段」作为依据；个人选择团体和团体选择个人均适用。名称推荐不得自动建立关系，用户开始手动搜索后恢复普通搜索结果与排序。
- 多选场景可限制已选展示数量，展开行使用 `disclosure` icon。
- 单选场景点击候选即替换当前选中，页面仍负责保存、联动价格、preset 日期等业务副作用。
- 需要支持快捷新建时传入 `onCreateArtist`：共享选择器负责判断非空搜索无结果、呈现统一的新建入口、加载态和防重复点击，页面只负责持久化及创建后的选择、价格等业务联动；外层表单需要同步忙碌状态时使用 `onCreateArtistPendingChange`。

### EventCard

文件：`src/components/EventCard.tsx`

活动列表和艺人详情活动列表的主卡片。

- 默认：圆角 18，padding 16/14，`marginBottom 12`，带阴影。
- compact：圆角 16，padding 14/12，`marginBottom 8`，无阴影。
- 第一行是标题，单行截断。
- 第二行左侧为单推命中 chip、日期时间、地点；右侧为状态 chip 和评分星。
- 没有左侧粗状态条。
- `tone` 可用于背景图场景下的 showcase 变体，但默认列表页不要使用 showcase。
- 可选 `eyebrow`（标题上方小字）和 `showStatus`（隐藏状态 chip）；`style` 用于覆盖背景、边框和边距等嵌入场景。
- Wide 主从列表使用 compact 变体；当前项通过 `selected` 显示 accent soft 背景与强调边框，点击由列表接管并在右栏切换详情。

### 活动与艺人主从布局

文件：`app/events/index.tsx`、`app/artists/index.tsx`

- 仅 Wide（窗口宽度 ≥ 960）启用；Compact / Regular 保持列表点击后 Stack Push 到全屏详情。
- 左侧 master 固定 360pt（设计允许范围 320–380），容纳搜索、筛选、分组标题与可独立滚动的列表；右侧 detail 占满剩余空间并独立滚动。
- 首次加载默认选中当前结果第一项；刷新时只要记录仍存在就保留选中项。搜索或筛选隐藏当前项时不清空右侧详情。
- 当前列表项必须同时提供视觉高亮和 `accessibilityState.selected`，不能只靠颜色表达状态。
- 右栏复用同一套活动/艺人详情实现，并按右栏实际宽度计算图片网格；不得复制详情业务逻辑。
- Wide 点击列表项不写入详情路由；缩窄窗口后恢复原有 Push 行为。新建与编辑使用 Expo Router Form Sheet，完成或取消后回到原列表与选中上下文。
- Wide 不使用跨两栏的全局操作按钮：左栏顶部显示列表标题和「新建」，右栏顶部只显示当前详情的编辑、分享等上下文操作。Compact / Regular 恢复列表页导航栏的新建按钮和详情页导航栏操作。
- Wide 顶部安全区由各栏分别处理，不在主从容器外层整体留白。有背景图的艺人详情从右栏屏幕顶边开始铺图，覆盖状态栏背后区域；右栏操作按钮和左栏标题内容仍按顶部 safe-area 下移。

### EventRow

文件：`src/components/EventRow.tsx`

活动列表行，用于统计页排行、首页最近完成等行式展示，与 `EventCard` 共用事件字段口径。

- 行高 70（minHeight），内容垂直居中，对称上下内边距。
- 骨架为「标题 + 副文本（可选）+ 右侧度量值」：标题 13/800 单行截断，副文本 12/textSecondary 单行截断，标题与副文本间距 7，右侧值 15/900 + accent + tabular-nums。
- 分隔线：`borderBottom divider`，最后一行不画；不内置卡片外壳，外壳由外层容器（SurfaceCard 等）承担。
- 副文本规则：日期段不加 icon；地点段前置 `eventLocation` icon（12px）；城市与地点之间用「·」连接，不使用 emoji。
- 列表展开沿用 `ExpandableList`（「展开其余 N / 收起」），EventRow 不内置展开状态。
- 可选 chevron；无障碍使用 `accessibilityRole="button"` + 描述性 label。

### Event primitives

文件：`src/components/EventPrimitives.tsx`

活动状态、时间、地点、评分等基础零件从这里复用。不要在页面里重新拼近似的状态 pill 或评分星。

### Oshi

文件：`src/components/Oshi.tsx`

`OshiAvatar`：

- 普通头像：圆形 `oshiAvatarBg` 底；有关联艺人时显示图片，缺少头像或图片加载失败时显示主显示名（简称优先）的首个字素，名称中的符号和 emoji 均按原样参与首字选择；未关联艺人时使用通用艺人图标。
- 单推头像：外层旋转 `oshiGradient` 渐变环，内层圆形头像。
- 右上角是单推心形标记：必须表达红色实心 heart 的语义。Lucide 字体包没有实心 heart 时，允许在 `AppIcon` 映射层保留 custom 例外，不要用普通线框心作为最终视觉替代。

`OshiBadge`：

- 文案固定「单推」。
- 默认实色 `oshiBadgeBg`，反色模式使用 `oshiBadgeBgInverted`、`oshiBadgeBorder`。

`OshiMatchBadge`：

- 文案为 `{单推名} 参演`。
- 用旋转渐变环表达单推命中，不要改成普通纯色 pill。

### ArtistRankingList

文件：`src/components/ArtistRankingList.tsx`

用于统计页拍立得排行和日历选中日期艺人摘要。

- 复用粒度是「头像 + 名称 + 数量 + 进度条」这一行。
- 页面自己负责外层卡片、标题和空态。
- 头像 38x38，圆形。
- 进度条高 6，底色 `inputBorder`，填充 `accent`。
- 访问性文案由调用方通过 `getAccessibilityLabel` 注入，避免共享组件带页面特定语义。

### ExpandableList

文件：`src/components/ExpandableList.tsx`

用于卡片内可能过长、但首屏只需展示重点项目的列表。

- 调用方传入完整数据、默认展示数量和列表渲染函数；组件只负责截取、展开与收起，不绑定排行等业务语义。
- 仅当项目数超过默认展示数量时显示底部入口；入口触控高度不低于 44px，并提供 `accessibilityState.expanded`。
- 展开入口应说明剩余数量，例如「展开其余 8 位」；展开后允许收起。
- 数据口径切换时通过 `resetKey` 回到折叠态，避免新范围意外沿用完整展开状态。

## Platform Tab Bars

入口：`app/(tabs)/_layout.tsx`。平台实现分别位于 `src/navigation/app-tab-navigator.ios.tsx` 和 `src/navigation/app-tab-navigator.tsx`。

两端均保持 5 个可见 tab，顺序固定为首页、日历、切册、统计、我的。

iOS：

- 使用 Expo Router `NativeTabs`，不自行模拟系统 Liquid Glass 材质。
- 图标通过 `AppIcon` 的业务名映射生成 Lucide glyph，再交给 `NativeTabs.Trigger.VectorIcon`；导航配置不直接写具体 glyph 名。
- 未选中态使用 `textSecondary`，选中态使用 `accent`。
- 使用 `minimizeBehavior="onScrollDown"`；系统负责紧凑形态、恢复动画和安全区。
- iOS 不复用 Android 悬浮 Tab 的显隐状态机；页面滚动只保留自身需要的标题动画，Tab 收起完全交给 NativeTabs。
- NativeTabs 负责底部安全区；页面 `paddingBottom` 只保留内容末尾的视觉间距，不手工补偿原生 Tab 高度或滚动指示器 inset。

Android：

- 使用 `src/navigation/CustomFloatingTabBar.tsx`。
- 结构是 5 个等宽悬浮胶囊 tab。

Shell：

- `borderRadius 32`，左右留 `FLOATING_TAB_BAR_HORIZONTAL_MARGIN`，当前为 12。
- 可见基础高度为 66，选中胶囊高度 58，保留图标和文字 label 的上下呼吸感。
- 使用主题半透明纯色、边框和阴影构成外壳。
- 选中态是跟随 `selectedIndex` 的轻量圆角胶囊，使用 reanimated `withSpring`，不做高饱和实心块。
- tab icon 19px，文字 label 使用约 10.5px / 13px，单行显示；当前五个入口均为 2 字 label。
- 聚焦态主要通过 accent 色、胶囊背景和轻微 scale 表达。不要为了恢复 filled/outline 效果强行使用不符合语义的 Lucide 变体。

底部导航不承载新建活动入口。新建活动入口使用页面右上角 header icon button，点击进入 `/events/compose`。

## 图标

图标库：`@react-native-vector-icons/lucide`。

代码入口：`src/components/AppIcon.tsx`。

规则：

- 页面和组件只使用 `AppIcon` 的业务名，不直接 import `@react-native-vector-icons/lucide`、`@expo/vector-icons` 或具体 icon 字体。
- 图标命名遵循「业务名 -> 映射层 -> Lucide 实际名」。例如页面使用 `favorite`、`calendar`、`disclosure`，映射层再决定实际 glyph 是 `heart`、`calendar-days` 还是 `chevron-right`。
- iOS 原生 Toolbar 优先使用 SF Symbols，但仍通过 `AppIcon` 的业务名映射获取，页面不直接硬编码 symbol 名；其他页面图标继续使用 Lucide glyph。
- 首页、所有活动、艺人管理和重要日期的 iOS 右上角「新建」统一复用 `NativeAddToolbar`，由原生 `Stack.Toolbar` 渲染 `plus`；Android 保留现有 Lucide Header 操作。首页右上角另有设置 icon（与电子切册「显示选项」一致），点击进入 `/settings/home` 自定义设置界面。底部 Tab Bar 不随本轮 Toolbar 调整变更。
- iOS 导航栏中的「取消 / 编辑 / 保存 / 重置」等文字操作统一使用原生 `Stack.Toolbar.Button`，避免两字自定义按钮在 Liquid Glass 下收成圆形；Android 保留现有 Header 操作。
- 只有会丢失持久数据或用户配置的操作使用 danger 红色，例如删除记录、覆盖备份；取消、清除筛选、还原默认布局等非破坏性操作继续使用普通强调色。破坏性操作需要二次确认，确认按钮使用 destructive 语义。
- 新增图标先扩展 `AppIconName` 和 `ICONS`，不要在页面内写 Lucide 实际名。
- `variant` 只用于真实业务状态或方向，例如 `selected/unselected`、`up/down/forward/back`。`active/inactive` 只有在 Lucide 实际提供有意义的状态 glyph 时才配置；否则用颜色、背景、缩放或文字表达状态。
- Lucide 不提供实心 heart。单推或收藏如果需要实心心形，必须作为 `AppIcon` 映射层的明确例外实现，而不是在页面里绕过映射层。
- tab 显示文字 label；选中态用 accent 色、选中胶囊、文字字重和轻微 scale 表达。
- 菜单项图标 18px。
- SearchFilterBar 搜索 icon 16px，筛选 icon 20px。
- EventCard 时间和地点 icon 13px。
- Header 新建活动 icon 24px。
- 单推心形 11-20px，按上下文决定。

常用映射：

| 场景 | Icon |
|------|------|
| 首页 | 业务名 `home` -> 默认 `house` |
| 日历 | 业务名 `calendar` -> 默认 `calendar` |
| 统计 | 业务名 `stats` -> 默认 `chart-bar` |
| 我的 | 业务名 `profile` -> 默认 `user` |
| 新建活动 | `add` |
| 所有活动 | `calendar` / `eventDate` |
| 艺人管理 | `artists` |
| 电子切册 | `cheki` |
| 电子切册显示选项 | `viewSettings` |
| 设置 | `settings` |
| 工具箱 | `tools` |
| 关于 | `info` |
| 微博登录 | `login` |
| 艺人导入 | `people-circle-outline` |
| 备份 | `download-outline` / `save-outline` / `cloud-upload-outline` |
| 清理图片 | `images-outline` |

## 交互规范

- 卡片按压：优先使用 `AnimatedPressable`，按压时轻微缩放并降低透明度；旧组件可保留 `activeOpacity` 0.72。
- HomeUpcomingHero：0.88。
- 菜单行：0.6。
- 列表项和 picker：0.7。
- Filter chip 和筛选按钮：约 0.78。
- 禁用态：opacity 0.4-0.6，且禁止触发 onPress。
- Modal 必须实现 `onRequestClose`。
- `RefreshControl tintColor` 使用 `accent`。
- 产品 UI 不做装饰性入场动画。动画只用于 tab 选中、筛选 sheet、展开/收起、加载和反馈。
- 开关统一使用 `AppSwitch`；触感映射和 reduceMotion 规则见上方「触感反馈」。

## 文案规范

界面语言：简体中文，允许混入明确的专有词，例如 チェキ、Setlist、特典、LIVE、TOUR。

规则：

- 使用简短、具体、以结果为中心的表达；面向用户描述任务，不暴露内部模型或实现细节。
- 同一概念始终使用同一术语，优先使用用户熟悉的领域词；不要为了变化而替换同义词。
- 页面与分区标题使用名词短语，操作使用能说明结果的动词；「完成」表示结束子步骤，「应用」表示让设置或筛选生效。
- 标题说明当前状态，正文只补充原因、后果或下一步，避免重复和无实际信息的语气词。
- 空态区分首次使用、无匹配结果和加载失败，并给出当前最有用的下一步。
- 错误提示使用 `title + reason + nextStep`；删除等不可恢复操作应明确对象和后果。
- 可见文案与无障碍名称保持一致；数量使用自然中文语序，数字与单位之间留空格。
- 表单必填字段在字段名后加 `*`，可选字段不额外标注「可选」。

## 可访问性和质量门槛

按本次 UI 改动的影响选择以下检查项；验证触发条件与完成边界见 [测试工作流](../workflows/testing.md)：

- 普通文字对比度至少接近 WCAG AA 4.5:1，大标题和粗体大字至少 3:1。
- 触控目标不低于 44x44。
- 可点击图片、排行行、菜单行设置 `accessibilityRole` 和必要的 `accessibilityLabel`。
- 颜色不是唯一信息来源。状态需要文字、图标或位置辅助。
- 动态内容不会撑破按钮、chip、卡片或 tab。
- 深色模式下不使用过暗结构色作为文字色。
- Android 返回键能关闭 Modal。
- 长列表使用虚拟化。

## 列表与筛选的共享规则

适用于活动、艺人、拍立得。

通用要求：

- 顶部使用明确页面标题，例如「艺人管理」「电子切册」。
- iOS 独立 Stack 的普通滚动页保持底部 edge-to-edge，不用外层 `SafeAreaView` 隔出固定空白；滚动容器使用 `contentInsetAdjustmentBehavior="automatic"`，内容末尾间距保留在可滚动区域内。Android 继续使用底部安全区保护。
- 搜索和筛选统一走 `SearchFilterBar` + `FilterSheet`。
- 已生效筛选默认在搜索框内以 chip 展示，可点击移除；电子切册和所有活动页例外，只通过筛选按钮激活态与数量 badge 表达，避免条件挤压搜索输入。
- 空态要说明下一步，例如新建活动、导入艺人、添加拍立得，而不是只写「暂无数据」。
- 大列表优先使用 `FlatList` 或虚拟化结构，不要用长 `ScrollView`。

## 图片和媒体

### 缩略图

- 拍立得缩略图使用 54:86 比例，圆角 10。
- 「下一场活动」中号保留左图右文，整体四周内边距统一为 20pt，图文间隔为 16pt。左侧仅显示活动第一张资料图，不显示倒计时；海报区域宽 96pt、高度填满扣除上下边距后的内容区，图片按原比例 `fit` 放大并靠左、垂直居中，圆角作用于图片自身，不裁切、不拉伸（宽图仍可能有额外上下留白）。右侧文字区域填满剩余宽度，右边界保持 20pt 内边距，顶部额外增加 4pt 留白（合计 24pt），底部边距不变；按「日期＋星期 → 标题 → 时间、场馆」排列，日期和星期整组在右侧文字区域内居中，标题及时间、场馆保持左对齐，标题上下使用相同弹性间隔。月日为 22pt 粗体、星期为 12pt 中等字重；标题为 16pt 中等字重、最多两行。底部第一行显示「时间 开场 · 时间 开演」，有哪个显示哪个、均为空时显示「全天」；第二行仅显示场馆，缺失不占行、超长末尾省略，不额外拼接城市。没有图片时完全移除图片列，由文字占满可用宽度。
- 「下一场活动」小号的日期与标题、标题与底部时间地点之间使用相同的弹性间隔，均分剩余高度；标题长短或场馆缺失时仍保持上下间距对称，外侧 20pt 上下留白不变。
- 活动资料图按页面空间选择网格或横向列表，但需要稳定尺寸，避免图片加载后布局跳动。
- 艺人头像统一圆形，通过 `resolveAvatarSource()` 解析普通 URI；私有构建可额外解析构建时注入的 `preset://` 资源。

### 全屏查看

- `Modal transparent`，`presentationStyle="overFullScreen"`，`animationType="fade"`。
- 背景 `rgba(0,0,0,0.92)`。
- 顶部左侧保留圆形半透明关闭按钮；右侧按当前内容能力显示切换正反面、收藏和编辑操作。删除作为底部 destructive 操作；没有顶部操作能力时保留等宽占位，确保图片计数居中稳定。
- 资料图支持 1-5 倍缩放。
- 拍立得查看底部显示日期、价格、备注、艺人等元信息。

## 文档维护

共享规则只在本文件维护，页面规则只在对应专题维护。当前任务涉及的文档与代码冲突，按已确认需求修正；无关冲突只报告。验证范围见 [测试工作流](../workflows/testing.md)。
