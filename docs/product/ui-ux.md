# ota_log 产品设计文档

> 当前文档面向 `ota-log` 的 app 产品设计与实现维护。它记录当前代码中的设计事实、可复用模式和后续 UI 改动的验收标准。
>
> 最近校准日期：2026-07-01
> 当前 app 版本：1.4.2

---

## 文档定位

`design.md` 不是静态设计稿，也不是单纯 token 表。每次调整页面结构、共享组件、主题 token、重要文案或导航入口时，都应同步更新本文档。

本文档优先回答四类问题：

1. 产品要服务什么使用场景。
2. 页面和导航的当前结构是什么。
3. 新 UI 应复用哪些 token、组件和交互模式。
4. 设计变更完成前应该检查什么。

外部调研结论：

- 设计文档需要把「设计决策」抽象成可复用 token，而不是依赖具体色值。Atlassian 将 design tokens 定义为命名并存储设计决策的单一事实来源，并强调按语义选择 token，而不是按相似色值选择。参考：[Atlassian Design Tokens](https://atlassian.design/foundations/tokens/design-tokens/)。
- 颜色需要有层级和角色。Carbon 将背景、层级、文本、边框、状态、焦点等拆成角色 token，并要求 token 在不同主题中保持同一语义。参考：[Carbon Color](https://carbondesignsystem.com/elements/color/overview/)。
- 产品内文案也属于设计系统。Carbon 的内容指南强调清晰、逻辑、可翻译，并区分 onboarding、错误、表单标签等不同语境。参考：[Carbon Content](https://carbondesignsystem.com/guidelines/content/overview/)。
- 可访问性不能只靠颜色。WCAG 2.2 AA 要求普通文本与背景至少 4.5:1，大文本至少 3:1。参考：[WCAG Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)。

因此，本文档按「产品原则 -> 信息架构 -> 基础 token -> 共享组件 -> 页面规范 -> 交互与验收」组织。

---

## 产品原则

ota_log 是本地优先的演出记录 app，主要服务日系和国内偶像、团体活动爱好者。用户打开 app 时通常要完成明确任务：查看下一场活动、补记录、查拍立得、看统计、整理艺人和备份数据。

设计方向：

- **任务优先**：首页直接呈现下一场活动和关键记录入口，不做营销式欢迎页。
- **本地记录感**：界面要像可靠的私人日志，允许密集信息，但保持扫描效率。
- **单推有情绪价值**：单推相关视觉可以更鲜明，使用渐变环、红色心形和置顶排序，但不要把所有页面染成单推色。
- **数据可回溯**：筛选、统计、拍立得聚合要让用户理解数据口径，避免只给漂亮数字。
- **一致性大于装饰**：标准控件、菜单行、筛选、卡片应复用同一套形态。新增页面优先使用已有共享组件。

---

## 信息架构

### 底部导航

当前底部导航按平台实现：iOS 使用 Expo Router `NativeTabs`，采用系统 Liquid Glass tab bar 和滚动最小化行为；Android 保留五个等宽悬浮胶囊 tab。两端入口和业务语义一致：

- 首页：`app/(tabs)/(home)/index.tsx`
- 日历：`app/(tabs)/calendar/index.tsx`
- 切册：`app/(tabs)/cheki/index.tsx`，页面标题保留「电子切册」
- 统计：`app/(tabs)/stats/index.tsx`
- 我的：`app/(tabs)/profile/index.tsx`

新建活动不放在底部导航常驻入口，改由首页右上角和所有活动页右上角进入 `/events/compose`。

### 我的页 IA

`Profile` 是身份和常用入口页，不承载复杂设置表单。当前结构：

1. 身份卡：头像、昵称、编辑入口、活动/完成/收藏/拍立得统计。
2. 单推：已设置时进入艺人详情，未设置时进入 `/settings/oshi`。
3. 功能：所有活动、艺人管理、重要日期。
4. 更多：设置、工具箱、关于。

Profile 上不直接放备份、清理、微博登录、主题、日历默认视图等操作。

### 设置页 IA

`/settings` 是单页设置中心。当前分组：

1. **个人**：个人资料、单推设置。
2. **外观**：首页自定义、显示模式、主题色、日历默认视图。
3. **小组件**（仅 iOS）：拍立得回忆的展示艺人设置。
4. **数据与备份**：生成备份数据、保存到本地、恢复备份。
5. **高级**：登录微博、清理未使用图片。

设置页内部不要再拆二级菜单来承载简单选项。显示模式、主题色、日历默认视图这类表单应默认折叠，点击菜单行后在原位置展开。

### 工具箱

`/tools` 承载低频但独立的工具入口。当前包含微博关注导入和 Ultima stamp planner。新增工具时优先放这里，不要塞回 Profile。

---

## 主题系统

主题偏好由 `useThemePreferences()` 持久化，实际取值通过 `useAppTheme()` 使用。

```ts
type AppThemeId = 'monoChrome' | 'classicViolet' | 'nightNeon';
type AppAppearance = 'system' | 'light' | 'dark';
type AppCalendarDefaultView = 'month' | 'timeline';
```

默认值：

```ts
DEFAULT_THEME_ID = 'monoChrome';
DEFAULT_APPEARANCE = 'system';
DEFAULT_CALENDAR_DEFAULT_VIEW = 'month';
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

---

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
| SectionLabel | 17 | 500 | `lineHeight: 35`，左侧 3x16 accent 竖条 |
| Badge / chip | 10-12 | 600-800 | 状态、计数、单推 |
| Setlist | 14 | 400 | `fontFamily: 'monospace'` |

规则：

- 产品 UI 不使用 display 字体。
- 不使用斜体或下划线表达强调。
- 数字对齐场景使用 `fontVariant: ['tabular-nums']`。
- 不随视口宽度动态缩放字号。窄屏通过换行、截断和 `adjustsFontSizeToFit` 局部兜底。

---

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

---

## 共享组件

### 页面层级：Section / 卡片 / 字段

ota_log 大量采用卡片式布局，页面层级统一按「section -> 卡片 -> 字段」理解。

Section 是页面级分组。Section 标题放在卡片外，左侧使用 3x16 accent 竖条，文字使用 `SectionLabel` / `FormSectionLabel` 规格。一个 section 内可以包含一个或多个卡片。

卡片是内容容器。卡片标题和描述语都是可选的：统计卡、排行卡、独立信息块等需要解释口径或内容时，可以在卡片内部使用加粗标题和辅助描述；普通表单字段组不需要卡片标题，因为 section 已经说明上下文。

字段是单个输入框、选择器、开关、日期、价格等控件。字段名是字段标签，不是标题。一组相关字段应该共用同一个卡片，例如「基础信息」下的「标题 / 日期 / 备注」；不要把同一组普通字段裸露在页面背景上，也不要把每个字段都拆成单独卡片。

例外：如果 section 内本身是一组可点击选项卡、菜单行、设置行、开关列表或独立卡片列表，它们已经是卡片 / 列表形态，不再额外包一层，避免卡片套卡片。

### SettingsMenu

文件：`src/components/SettingsMenu.tsx`

包含 `SectionLabel`、`MenuCard`、`MenuItem`。

`SectionLabel` 规范：

- 容器横向排列，左侧为 3x16 accent 竖条，圆角 999。
- 标题文字 17/500，`lineHeight: 35`，颜色使用 `colors.heading`。
- 不使用 uppercase 或额外字间距。

`MenuItem` 规范：

- 左侧图标容器 34x34，圆角 10，背景 `${tint}22`。
- icon 18px。
- label 15/500。
- subtitle 12，最多 2 行。
- badge 使用 `${tint}20` 背景，12/700。
- trailing icon 固定 `chevron-forward` 16px。
- `activeOpacity` 0.6。

用于 Profile、Settings、About、Tools 等导航式列表。新设置入口优先复用它。

### AnimatedPressable

文件：`src/components/AnimatedPressable.tsx`

用于首页未来活动时间线等低数量卡片的轻量按压反馈。

- 使用 Reanimated，不使用 React Native `Animated`。
- 默认按压态：`scale 0.97`，`opacity 0.76`。
- 按下 70ms，松开 120ms，只动画 `transform` 和 `opacity`，不动画布局属性。
- 不用于普通文本链接、Modal 遮罩、拖拽手柄、长列表行或需要系统原生反馈的控件。
- 通用 `EventCard`、排行行等可能批量渲染的列表项继续使用 `TouchableOpacity`，避免页面切换和首屏 mount 变重。

### SearchFilterBar

文件：`src/components/SearchFilterBar.tsx`

用于活动、艺人、拍立得等列表页的搜索与筛选入口。

- 搜索容器最小高度 44，圆角 10。
- 有 active filter chip 时搜索框自动换行，chip 最高 26px。
- 筛选按钮 44x44，激活时背景 `accent`，右上显示红色数量 badge。
- active filter chip 使用 `accent` 透明底和 `accentBorder`。

不要为相邻列表页重写一套搜索筛选 UI。

### FilterSheet

文件：`src/components/FilterSheet.tsx`

底部筛选面板：

- `Modal transparent`，底部弹出。
- 进入动画 240ms，退出 180ms。
- 支持单选、多选、文本输入、本地搜索。
- Chip 高 34，激活态使用 `accent/onAccent`。
- 输入型分区使用本地 draft 和 debounce，避免 URL 参数回写影响光标。
- 搜索型分区的已选项显示在搜索框上方，候选列表只负责继续选择，不在候选行里承担清除动作。
- 艺人筛选项使用头像行，包含头像、主名、副名/所属团体、单推标识和右侧状态图标。

### ArtistSearchPicker

文件：`src/components/ArtistSearchPicker.tsx`

用于活动表单、日期项、拍立得、单推设置、首页关注艺人和所属团体等表单内艺人选择。

- 底层艺人行统一来自 `ArtistOptionRow`：头像、主名、副名/所属团体、单推标识和右侧状态图标。
- 已选艺人固定显示在搜索框上方的「已选中」区域，清除动作只在已选行右侧图标上触发。
- 搜索框下方候选列表只负责选择或替换，不显示删除图标，默认隐藏已选艺人。
- 多选场景可限制已选展示数量，展开行使用 `disclosure` icon。
- 单选场景点击候选即替换当前选中，页面仍负责保存、联动价格、preset 日期等业务副作用。

### EventCard

文件：`src/components/EventCard.tsx`

活动列表和艺人详情活动列表的主卡片。

- 默认：圆角 18，padding 16/14，`marginBottom 12`，带阴影。
- compact：圆角 16，padding 14/12，`marginBottom 8`，无阴影。
- 第一行是标题，单行截断。
- 第二行左侧为单推命中 chip、日期时间、地点；右侧为状态 chip 和评分星。
- 没有左侧粗状态条。
- `tone` 可用于背景图场景下的 showcase 变体，但默认列表页不要使用 showcase。

### Event primitives

文件：`src/components/EventPrimitives.tsx`

活动状态、时间、地点、评分等基础零件从这里复用。不要在页面里重新拼近似的状态 pill 或评分星。

### Oshi

文件：`src/components/Oshi.tsx`

`OshiAvatar`：

- 普通头像：圆形 `oshiAvatarBg` 底，显示图片或 fallback。
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

---

## 首页规范

文件：`app/(tabs)/(home)/index.tsx`

首页负责当天和近期行动。iOS 使用原生 Stack large title 和 `headerRight` 新建活动入口；Android 保留自绘折叠标题。

结构：

1. 置顶信息英雄卡，固定显示，不显示 section 标题，不参与功能卡片排序。
2. 首页自定义功能卡片区，包含未来活动时间线、关注艺人、本月概览、电子切册速览、最近完成等模块。

首页模块标题统一放在卡片外，使用 3x16 accent 竖线、17/700 标题、`lineHeight: 35`、可选 count badge 和右侧 action。卡片内部只放内容，不重复模块标题。

### 首页置顶信息

设置入口：`app/settings/home.tsx`

- 设置页「置顶信息」分区放在功能卡片排序列表上方，但属于正常可滚动内容，不固定停留在屏幕顶部。
- 置顶信息不可隐藏，只能在 `下一场活动`、`关注艺人`、`本月概览` 三种类型中单选。
- `下一场活动` 显示最近 planned 活动和倒计时；没有未来活动时显示添加活动入口。
- `关注艺人` 第一版只选择 1 位艺人，展示头像、名称、年度活动数、拍立得数和下一场相关活动。
- `本月概览` 标题使用当前月份记录，例如「7 月记录」，展示已完成、计划中、拍立得人数和拍立得张数，点击进入统计页当前月份。
- 置顶信息选择不自动隐藏下方同类功能卡片。
- 下方「未来活动」功能卡片只在置顶类型为 `下一场活动` 时排除最近 planned 活动；选择 `关注艺人` 或 `本月概览` 时继续展示完整未来活动列表。

### HomeUpcomingHero

文件：`src/components/HomeUpcomingHero.tsx`

- 用于置顶信息的 `下一场活动` 类型。
- 存在最近 planned 活动时渲染；无未来活动时由首页渲染置顶添加活动空态。
- 背景 `colors.heroBg`，圆角 22，padding 14，`marginBottom 18`。
- 左侧倒计时块 72x72，圆角 16。
- 右侧包含 eyebrow「最近活动」、标题、时间地点副标。
- 单推命中时底部出现 callout，包含 `OshiAvatar`、文案「这场活动有你推参加哦」、单推名和 `OshiBadge`。
- 整卡点击进入活动详情，`activeOpacity` 0.88。

倒计时文案：

| 条件 | 主值 | 标签 |
|------|------|------|
| 今天且有时间 | `HH:MM` | 今天 |
| 今天无时间 | 今天 | 别忘了去现场 |
| 明天 | 明天 | 准备出发 |
| 其他未来日期 | `N` | 天后 |
| 今天已过且有时间 | `HH:MM` | 已结束 |

### HomeDashboardCards

文件：`src/components/HomeDashboardCards.tsx`

首页 dashboard 卡片应是行动入口，不做纯装饰。

- 关注艺人卡是单个卡片，卡片内最多展示五位关注艺人、下一场活动和记录摘要。
- 最近完成卡片的显示数量上限由 `/settings/home` 配置，支持指定数量或全部。
- 默认仅开启未来活动、最近完成和电子切册速览；关注艺人和本月概览保留在未启用区。
- 本月概览保留外层 section 标题，卡片内标题使用当前月份记录，例如「7 月记录」，展示已完成、计划中、拍立得人数和拍立得张数。
- 电子切册速览展示总数、本月新增和最近图片。
- 除本月概览的一行月份标题外，首页 dashboard 卡片不在卡片内部渲染模块标题；标题、计数和右侧 action 由首页外层模块标题统一承载。
- 卡片圆角 16，padding 15，边框 `divider`，轻阴影。
- `/settings/home` 使用「置顶信息」分区承载固定英雄卡配置，使用 `Sortable` 列表承载功能卡片排序，并以「已启用 / 未启用」分区线表达显示状态。功能卡片拖到分区线前即开启，拖到分区线后即隐藏；未启用卡片使用 muted 背景、文字和图标置灰。

### 首页时间线

计划活动按 `src/utils/homeTimeline.ts` 分组。组标题使用小圆点、标题、日期范围和横线，避免重复大卡片标题。

- 首页未来活动时间线卡片使用 `AnimatedPressable`：`HomeTimelineEventCard` 可用 `pressedScale 0.975`。
- 最近完成区使用 `HomeCompletedEventCard` 和首页统一模块标题。最近完成可配置为全部展示，继续使用 `TouchableOpacity`。

---

## 列表和筛选页

适用于活动、艺人、拍立得。

通用要求：

- 顶部使用明确页面标题，例如「艺人管理」「电子切册」。
- iOS 独立 Stack 的普通滚动页保持底部 edge-to-edge，不用外层 `SafeAreaView` 隔出固定空白；滚动容器使用 `contentInsetAdjustmentBehavior="automatic"`，内容末尾间距保留在可滚动区域内。Android 继续使用底部安全区保护。
- 搜索和筛选统一走 `SearchFilterBar` + `FilterSheet`。
- 已生效筛选应在搜索框内以 chip 展示，可点击移除。
- 空态要说明下一步，例如新建活动、导入艺人、添加拍立得，而不是只写「暂无数据」。
- 大列表优先使用 `FlatList` 或虚拟化结构，不要用长 `ScrollView`。

电子切册页特殊要求：

- 作为底部 tab 主页时，底部入口名使用「切册」，页面标题使用「电子切册」。
- iOS 使用原生大标题和 NativeTabs；普通 `ScrollView` 向下滚动时由系统最小化 tab bar，`FlatList` 页面受 Expo 当前集成限制，不强制模拟同一行为。Android 使用 `AndroidCompactTabHeader` / `AndroidLargeTabTitle`，滚动时标题收起并驱动底部 tab bar 收起。
- iOS 右上角使用原生 `Stack.Toolbar`：视图设置使用 `slider.horizontal.3` 菜单，展示模式、排序和图片大小通过带勾选状态的原生菜单即时切换；新增拍立得使用独立的最右侧 `plus` 按钮。Android 保留自绘 Header 操作和视图设置 Bottom Sheet。
- 有图拍立得和记录要一起呈现和统计。
- 图片缩略图使用 54:86 比例。
- 拍立得展示模式固定为三类：按艺人、时间分组、相册模式；不要再暴露网格 / 堆叠的自由组合。
- 按艺人用于找人，使用艺人分区和分区内图片网格；时间分组用于按日期回忆，日期使用 section 标题格式，标题下方展示无外层卡片的拍立得堆叠预览；相册模式用于浏览全部图片，使用无分组图片墙。
- 时间分组收起时展示日期 section 标题和拍立得堆叠预览；展开后保留日期 section 标题，图片只在展开内容里展示一次；展开 / 收起使用短的 layout + fade 动画，不做逐张复杂 morph。
- 时间分组和相册模式可提供最新在前 / 最早在前排序；按艺人模式不显示时间排序选项。
- 网格图片大小使用大 / 中 / 小三档；同一可用宽度下每行数量必须是不同整数，手机宽度基准为 3 / 4 / 5 列，宽屏可按同一增量增加列数。
- 记录使用 `ManualChekiEntryList`，不要混成假图片格。
- 拍立得日期口径要明确，避免不同页面显示不一致。

---

## 日历规范

文件：`app/(tabs)/calendar/index.tsx`

日历支持月视图和时间表视图，默认值来自 `calendarDefaultView`。

月视图原则：

- 月格保持轻量，只显示日期层面的信号，不变成图片墙。
- `markedDates` 和 multi-dot 负责密度提示。
- 更详细的活动、拍立得和艺人摘要放在选中日期面板。

拍立得相关：

- 拍立得数量必须合并有图 `cheki` 和无图 `cheki_manual_entries`。
- 艺人摘要与统计页排行复用 `ArtistRankingList`。
- 如展示拍立得日期，必须明确 date/event date/created_at 的优先级。

---

## 统计规范

文件：`app/(tabs)/stats/index.tsx`

统计页用于回顾和比较，不只是展示数字。

- 年份切换应明显，支持当前年和所有时间等口径。
- iOS 右上角周期入口使用原生 `Stack.Toolbar` 纯文字按钮，显示当前统计口径并打开周期选择器；不要在原生导航栏内嵌套自绘背景和圆角。Android 保留自绘 header 操作。
- SectionHeader 使用 3x16 accent 竖线、17/700 标题、`lineHeight: 35`、可选 count badge 和右侧 action。
- StatBox 数字使用 28/900，compact 可降到 24。
- 统计页顶部摘要已移除，不再按所有时间、年度或月度展示摘要卡。
- 排行、支出、月度分布应优先解释口径，避免用户误解。
- 活动统计 section 内包含 `排行（仅团体）` 卡片；它只统计 `parent_id IS NULL` 的艺人参与的已完成活动，默认展示前十，使用 `ArtistRankingList` 展示。
- 拍立得排行使用 `ArtistRankingList`，头像由 repository 提供的 `avatarUri` 渲染。
- 单推 section 标题固定为「单推」，卡片内标题使用头像 + 名称，不再单独展示“参加活动 xx 次，拍了 xx 张”的摘要文案。

---

## 活动详情和表单

### 活动详情

文件：`app/events/[id].tsx`

- 未完成和未取消的未来活动显示 Mini countdown。
- 顶部摘要卡承载活动名、时间地点、票价、状态、回顾评分、链接和「添加日历」，不加模块标题。
- 详情页模块标题放在卡片外，使用 SectionLabel/SectionHeader 风格；卡片内部只在需要解释独立信息块时使用标题，不使用左侧竖线。
- 「详细信息」模块包含出演者、演出详情、资料图。
- 「我的记录」模块包含拍立得、备注、Setlist。
- 系统日历入口使用明确操作文案「添加日历」。
- 资料图和拍立得查看使用全屏 Modal。

Mini countdown：

- 背景 `accentStrong`，圆角 20，padding 18。
- 左侧文案「距演出」「还有」，右侧大数字。
- 当天显示「就是今天！」。

### 活动表单

文件：`src/components/EventForm.tsx`

- 新建活动页保留底部保存按钮。
- 编辑活动页通过 header 按钮触发 `EventFormHandle.submit()`，表单自身传 `hideSubmitButton`。
- 活动表单按「活动信息 / 详细信息 / 我的记录」分组；模块标题放在卡片外，卡片内部遵守「Section / 卡片 / 字段」层级，普通输入项使用字段标签。
- 「活动信息」包含活动名称、状态、回顾评分、日期时间、城市场地、票价、演出链接。
- 「详细信息」包含出演者、演出详情、资料图。
- 「我的记录」包含备注、Setlist。
- 演出公告解析不做艺人名称归一化，只将原始 `artist_mentions` 交给匹配层。
- 出演者区域使用 chip、搜索列表、多选和快速新建。
- 错误提示统一走 `failureAlert` 的结构。

---

## Profile、Settings、About

### Profile

- 顶部身份卡是强品牌块，使用 `accentStrong` 或对应主题强色。
- 统计数字白色 24/900，说明文字 11，分隔线为白色低透明度。
- 单推卡已设置时显示 `OshiAvatar` 和 `OshiBadge`；未设置时显示心形 icon 和「设置单推」。
- 低频维护操作不回到 Profile。

### Settings

- 保持单页、分组、可展开。
- 显示模式、主题色、日历默认视图使用 radio 选择。
- 首页自定义进入 `/settings/home`。
- iOS 的「小组件」分区进入 `/settings/widget`；拍立得回忆默认展示全部艺人，也可多选艺人，只轮播与所选艺人直接关联的有图拍立得。待选列表只包含至少已有一张有图拍立得的艺人，不展示只有无图补录或尚无拍立得的艺人。
- 备份状态用 MenuItem badge 表达，允许 spinner、已完成、重试、可保存等状态。
- 微博相关入口统一命名为「登录微博」和「艺人导入」。

### About

- 使用 `SectionLabel + MenuCard + MenuItem` 的结构语言。
- 版本更新文案应该来自 changelog，但要经过人工压缩，适合 app 内阅读。
- 帮助文案要短，不做长篇说明。

---

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

---

## 图片和媒体

### 艺人详情背景图模式

- 背景图使用 edge-to-edge Hero，竖屏首屏高度约为可视高度的 70%，并限制在屏幕宽度的 1.6 倍以内以兼顾宽屏。艺人名称和紧凑元信息放在图片底部左侧；背景图已经承担身份表达时，不重复展示中央头像。
- iOS 26+ 的顶部返回、编辑控件和「活动 / 拍立得」分段控件使用 Liquid Glass；分段控件共用一个玻璃容器，选中态由内部轻量填充表达，不叠加多个玻璃层。旧系统、Android 或开启「降低透明度」时回退为有边框的半透明实体控件。Liquid Glass 不用于月份标题、EventCard 或其他内容卡片。
- 「活动 / 拍立得」分段控件固定在完整背景图底部，左右保留 16px、底部保留 10px；扩展出的约 96px 区域属于同一张图片，并渐变到图片派生底色，控件下方直接进入实体活动列表或拍立得网格，不额外预留一整段空白。过渡区不得重新渲染或重新裁切第二张背景图。切换时两类内容保持挂载，仅切换可见层，避免 Hero、背景图和玻璃控件重建闪烁。
- Hero 滚出后，艺人名称进入紧凑导航栏，分段控件吸附在导航栏下方，保持活动和拍立得入口可用。
- 单推、收藏、所属和链接以无背景的紧凑媒体操作呈现，不堆叠多个大胶囊。
- 图片提取色只作为低饱和环境色混入页面底色。深色背景保持近黑基底，卡片使用低对比度的浅色透明层，避免形成黑色卡片墙。
- 背景图模式的活动列表继续复用 `buildEventMonthSections` 和 `EventCard`；月份标题切换为无 accent 竖线、无数字 badge 的媒体式标题，普通艺人详情和所有活动页保持现有 section 样式。

### 缩略图

- 拍立得缩略图使用 54:86 比例，圆角 10。
- iOS 拍立得小组件保留完整的 54:86 图片比例：小号展示当前 1 张；中号把当前张放在中间，两侧展示接下来两张，少于 3 张时按实际数量居中，不重复图片补位。每次同步从最近拍摄的照片开始，并按拍摄时间从新到旧轮播，每张图片依次成为当前张。
- 拍立得小组件的艺人筛选来自 `/settings/widget`。默认包含全部有图拍立得；选择一位或多位艺人后只缓存并轮播 `artist_id` 属于所选艺人的照片，保存设置后立即刷新时间线。
- iOS「下一场活动」小组件与「拍立得回忆」独立注册，仅支持小号和中号，不增加设置入口。小号显示自然日倒计时、标题、日期和开始时间；中号左侧显示活动第一张资料图（无图时回退倒计时块），右侧按标题、日期时间、地点纵向左对齐，缺失的地点字段按实际存在部分显示，开始时间为空时显示「全天」。
- 首页活动 Hero 与下一场活动小组件共同使用 `src/utils/currentEvent.ts` 的选择规则：只考虑今天及之后的 `planned` 活动；当天按开始时间边界切换，未计时活动在首场计时活动开始前优先显示；相同时间或多个未计时活动按创建时间稳定排序。
- App 冷启动完成数据库初始化、回到前台及活动新增/编辑/删除时，静默把日期早于本地今天的 `planned` 活动改为 `completed`，然后刷新小组件。小组件不生成午夜或活动开始时间的未来 timeline，因此 App 未打开时允许保留最近一次同步快照。
- 有活动的小组件整块跳转到 `/events/:id`；空态显示「还没有下一场活动」和「轻点添加计划中的活动」，整块跳转到新建活动流程。需在浅色、深色和 Home Screen tinting 模式检查可读性与深链。
- 活动资料图按页面空间选择网格或横向列表，但需要稳定尺寸，避免图片加载后布局跳动。
- 艺人头像统一圆形，通过 `resolveAvatarSource()` 解析普通 URI；私有构建可额外解析构建时注入的 `preset://` 资源。

### 全屏查看

- `Modal transparent`，`presentationStyle="overFullScreen"`，`animationType="fade"`。
- 背景 `rgba(0,0,0,0.92)`。
- 顶部左侧保留圆形半透明关闭按钮；右侧只显示「更多」按钮，编辑和删除收进系统操作菜单，删除项使用 destructive 语义。没有编辑或删除能力时保留等宽占位，确保图片计数居中稳定。
- 资料图支持 1-5 倍缩放。
- 拍立得查看底部显示日期、价格、备注、艺人等元信息。

---

## 图标

图标库：`@react-native-vector-icons/lucide`。

代码入口：`src/components/AppIcon.tsx`。

规则：

- 页面和组件只使用 `AppIcon` 的业务名，不直接 import `@react-native-vector-icons/lucide`、`@expo/vector-icons` 或具体 icon 字体。
- 图标命名遵循「业务名 -> 映射层 -> Lucide 实际名」。例如页面使用 `favorite`、`calendar`、`disclosure`，映射层再决定实际 glyph 是 `heart`、`calendar-days` 还是 `chevron-right`。
- iOS 原生 Toolbar 优先使用 SF Symbols，但仍通过 `AppIcon` 的业务名映射获取，页面不直接硬编码 symbol 名；其他页面图标继续使用 Lucide glyph。
- 首页、所有活动、艺人管理和重要日期的 iOS 右上角「新建」统一复用 `NativeAddToolbar`，由原生 `Stack.Toolbar` 渲染 `plus`；Android 保留现有 Lucide Header 操作。底部 Tab Bar 不随本轮 Toolbar 调整变更。
- iOS 导航栏中的「取消 / 编辑 / 保存 / 重置」等文字操作统一使用原生 `Stack.Toolbar.Button`，避免两字自定义按钮在 Liquid Glass 下收成圆形；Android 保留现有 Header 操作。
- 只有会丢失持久数据或用户配置的操作使用 danger 红色，例如删除记录、覆盖备份和恢复默认配置；取消、清除筛选等非破坏性操作继续使用普通强调色。破坏性操作需要二次确认，确认按钮使用 destructive 语义。
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
| 电子切册视图设置 | `viewSettings` |
| 设置 | `settings` |
| 工具箱 | `tools` |
| 关于 | `info` |
| 微博登录 | `globe-outline` |
| 艺人导入 | `people-circle-outline` |
| 备份 | `download-outline` / `save-outline` / `cloud-upload-outline` |
| 清理图片 | `images-outline` |

---

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

---

## 文案规范

界面语言：简体中文，允许混入明确的专有词，例如 チェキ、Setlist、特典、LIVE、TOUR。

规则：

- 页面标题直接写功能名，不写问候语。
- SectionLabel 使用 2-5 字名词短语，例如「单推」「功能」「更多」「外观」「活动统计」。
- 编辑表单字段标签：必填字段在字段名后加 `*`；可选字段只写字段名，不写「（可选）」。
- 按钮优先使用动词，例如「保存」「取消」「删除」「解析」「确认」。
- 错误提示使用 `failureAlert`：`title + reason + nextStep`，开发环境可附调试信息。
- 微博相关引导写「我的 -> 更多 -> 设置 -> 高级 -> 登录微博」或「我的 -> 更多 -> 工具箱 -> 艺人导入」，不要再写旧路径。
- 空态文案要给下一步，不只说明没有数据。

---

## 可访问性和质量门槛

每个新 UI 改动至少检查：

- 普通文字对比度至少接近 WCAG AA 4.5:1，大标题和粗体大字至少 3:1。
- 触控目标不低于 44x44。
- 可点击图片、排行行、菜单行设置 `accessibilityRole` 和必要的 `accessibilityLabel`。
- 颜色不是唯一信息来源。状态需要文字、图标或位置辅助。
- 动态内容不会撑破按钮、chip、卡片或 tab。
- 深色模式下不使用过暗结构色作为文字色。
- Android 返回键能关闭 Modal。
- 长列表使用虚拟化。

---

## 更新检查清单

改动 UI 时，同步检查本文档：

- 新增或删除底部导航、Profile、Settings、Tools、About 入口。
- 新增共享组件或把页面局部组件抽成共享组件。
- 改变主题 ID、token 名、默认主题、深浅色策略。
- 改变首页、日历、统计、电子切册、活动详情的结构或数据口径。
- 改变单推视觉、拍立得统计口径、首页卡片配置。
- 新增需要用户理解的数据规则，例如排行榜、筛选、日期优先级。
- 修改文案路径、错误提示模式、空态策略。

如果文档和代码冲突，以当前代码为短期事实，但必须在同一个变更里决定是修代码还是修文档。
