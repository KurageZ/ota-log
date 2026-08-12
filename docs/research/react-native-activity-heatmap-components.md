# React Native 活动日历热力图组件调研

> 调研时间：2026-08-12（Asia/Shanghai）  
> 目标：为 ota-log 统计页增加类似 GitHub Contributions 的年度活动热力图，并为统计分区补充语义化图标。  
> 范围：评估 Expo / React Native 原生方案，并记录后续最小 demo 的选型结果。

## Demo 落地状态

2026-08-12 已采用 `react-native-chart-kit` 7.0.2 的 v2 `ContributionGraph` 实现“活动足迹”统计 section。当前 demo 只在「年」口径展示活动与拍立得综合记录：1 级为仅有已完成活动，2 级为活动加 1–5 张拍立得，3 级为活动加超过 5 张拍立得；只有拍立得的日期保持空白。支持横向滚动、主题色阶和轻点查看当天明细；周、月、自定义和全部时间只显示切换年度的说明。

## 结论

有可用且相对成熟的组件。当前首选是 [`react-native-chart-kit`](https://www.npmjs.com/package/react-native-chart-kit) 7.x 的 [`ContributionGraph`](https://chartkit.io/docs/react-native/charts/contribution-heatmap/)；不建议采用多年未维护的 `react-native-calendar-heatmap`。

建议先做一个很薄的 Chart Kit 技术验证，再决定是否正式引入：

1. 用项目真实数据渲染一个完整年度，确认 iOS / Android、浅色 / 深色、中文标签和横向滚动。
2. 验证 `onDayPress` 返回的数据能否直接驱动当天活动列表或底部弹层。
3. 检查实际 bundle 增量和统计页首屏耗时。npm 的 unpacked size 不是最终 bundle size，不能据此直接判断包体成本。
4. 如果视觉或交互受限，则基于项目已经安装的 `react-native-svg` 实现本地 `ActivityHeatmap`。一年最多约 371 个格子，算法和渲染规模都可控，不需要引入另一个低维护专用包。

## 项目适配基线

当前项目版本：

| 依赖 | ota-log | Chart Kit 7.0.2 peer 范围 | 结论 |
|---|---:|---:|---|
| React | 19.2.3 | `>=19.1.0 <20` | 匹配 |
| React Native | 0.85.3 | `>=0.81 <1` | 匹配 |
| react-native-svg | 15.15.4 | `>=15.12.1 <16` | 匹配 |

版本与依赖范围来自 [npm 包元数据](https://www.npmjs.com/package/react-native-chart-kit)。Chart Kit 官方文档明确提供 Expo 安装方式，并把 contribution heatmap 列为公开图表类型；核心许可证为 MIT，额外的 Pro 图表与本功能无关。[官方仓库](https://github.com/chart-kit/react-native-chart-kit)、[官方安装说明](https://chartkit.io/docs/react-native/getting-started/installation/)。

项目现有统计页使用自绘的 `MonthlyBarChart`，并已安装 `react-native-svg` 和 Skia。活动热力图所需的新增数据也很直接：按 `event_date` 分组返回 `{ date: 'YYYY-MM-DD', count: number }`。但在实现前必须先确定口径：

- 推荐默认只统计 `completed`，表达“实际参加活动”，避免未来的 planned / wishlist 日期制造虚假活跃度。
- 如果产品希望表达“记录密度”，可以统计所有状态，但图例与标题必须明确。
- 月份筛选状态下不适合仍展示完整年度；建议年度筛选显示热力图，月份筛选显示该月或隐藏该模块。
- “所有时间”不能直接压进单张 Contributions 图；建议显示最近 12 个月或要求选择年份。

## 候选比较

| 方案 | 优点 | 主要问题 | 判断 |
|---|---|---|---|
| [`react-native-chart-kit` 7.x](https://www.npmjs.com/package/react-native-chart-kit) `ContributionGraph` | 包和社区成熟；当前仍发布；TypeScript；Expo 安装路径明确；版本与本项目精确匹配；支持日期点击、自定义颜色、主题、中文标签格式器、周一开周和空区间 | 为单一热力图引入整套 chart kit；完整年度在手机上通常需要横向滚动；7.x 新 API 仍应做真机验证 | **首选现成组件** |
| [`react-native-calendar-heatmap`](https://www.npmjs.com/package/react-native-calendar-heatmap) | API 简单；SVG；体积小；样式接近老版 GitHub 图 | 0.2.4，长期未更新；peer 范围停留在很老的 RN 时代；TypeScript、现代 React/RN 与可访问性保障不足 | 不采用 |
| [`@symbiot.dev/react-native-heatmap`](https://www.npmjs.com/package/%40symbiot.dev/react-native-heatmap) | 宣称支持 Expo、iOS、Android、Web；有 TypeScript 声明；支持主题和 date-fns locale | 只有 1.0.0 初始版本，使用与维护验证明显少；还要引入 `date-fns`；公开资料更偏 weekly / monthly，不如 Chart Kit 的 contribution graph 路径明确 | 可做备选，不优先 |
| [`@dt-workspace/react-native-heatmap`](https://www.npmjs.com/package/%40dt-workspace/react-native-heatmap) | API 表面上很丰富：calendar 布局、手势、tooltip、主题、虚拟化 | 公开仓库与维护来源不够透明，功能面异常宽，缺少足够的一手生态证据；在应用中采用前需要额外源码审计 | 暂不采用 |
| [`react-calendar-heatmap`](https://www.npmjs.com/package/react-calendar-heatmap) | Web 生态成熟、GitHub 风格完整 | React DOM + CSS/SVG 组件，不是 React Native 原生组件；不能直接用于 iOS / Android 页面 | 排除 |
| 本地 `ActivityHeatmap`（SVG 或 RN View） | 零新增运行时依赖；完全服从 ota-log 主题、中文、交互与测试；约 371 个格子的规模可控 | 日期网格、月份标签、点击命中区和无障碍需要自行维护 | **Chart Kit 验证失败时的首选 fallback** |

不要混淆 [`@cawfree/react-native-heat-map`](https://github.com/cawfree/react-native-heat-map)：它是坐标/地图式连续热度渲染，不是日历贡献图。

## Chart Kit 能覆盖的需求

官方 `ContributionGraph` / `CalendarHeatmap` 文档列出的关键能力包括：

- `values`, `endDate`, `numDays` 控制日期数据和范围；
- `cellSize`, `gutterSize` 控制格子密度；
- `weekStartsOn={1}` 使用周一作为一周开始；
- `showMonthLabels`, `showWeekdayLabels` 控制标签；
- `getMonthLabel`, `getWeekdayLabel` 可本地化为中文；
- `theme`, `colors`, `emptyColor`, `colorForValue` 适配项目浅色 / 深色主题；
- `onDayPress` 可进入当天活动列表或弹出详情；
- `accessibilityLabel` 和 `testID` 提供基本可访问性与测试入口；
- 空 `values` 仍会渲染稳定的零值网格。

来源：[Chart Kit Contribution Heatmaps 官方文档](https://chartkit.io/docs/react-native/charts/contribution-heatmap/)。

需要由应用侧处理的部分：

- 组件接收固定 `width` / `height`，完整年度建议放在水平 `ScrollView` 中，或在窄屏减少格子尺寸；
- 视觉上的小格子不满足 44pt 触摸目标，不能只靠精确点击格子完成关键操作；应同时提供日期摘要、底部弹层或可访问的替代入口；
- Chart Kit 负责展示，不负责 SQLite 聚合、筛选语义、日期时区或跳转路由；
- 日期字符串应继续沿用项目的 `YYYY-MM-DD`，生成日期序列时避免把本地日期经 UTC 转换后偏移一天。

## 建议的最小产品形态

- 放在“活动统计”分区的月度数量分布附近，标题使用“年度活动足迹”或“活动日历”。
- 颜色使用项目 accent 的 4 个强度等级，加一个明确的空值色；深色模式单独给色阶，不做简单反色。
- 图例写清楚「仅活动 / + 1–5 张 / + 6 张以上」，避免只有颜色而没有含义。
- 点击有活动的日期后，复用活动列表并传入日期筛选；点击空日期可以无动作或仅显示“当天没有已完成活动”。
- 第一版不做 streak，以免把演出安排这种低频行为包装成需要每日打卡的指标。

## 统计页图标建议

统计分区目前没有独立图标，项目只通过 `AppIcon` 暴露业务名。建议继续使用现有 Lucide 字体，通过 `src/components/AppIcon.tsx` 新增业务映射，不在页面直接 import 图标包：

| 业务名建议 | Lucide glyph | 用途 |
|---|---|---|
| `statsActivity` | `calendar-check` | 活动统计，强调已参加/已完成 |
| `statsHeatmap` | `grid-3x3` | 活动日历热力图 |
| `statsOshi` | `calendar-heart` | 单推相关活动 |
| `statsSpending` | `wallet` 或 `hand-coins` | 支出统计；前者更稳定、识别更快 |
| `statsPerfect` | `trophy` 或 `badge-check` | 满分活动；推荐 `trophy` |
| `statsCheki` | `images` | 拍立得统计；与现有 `cheki` / `album` 语义保持一致 |

这些 glyph 已存在于项目当前安装的 `@react-native-vector-icons/lucide` 字形表，不需要再引入图标库。图标应作为标题的辅助识别信息，标题文字仍需保留，不能只靠颜色或图形区分分区。

## 建议决策

1. 允许增加一个依赖时：先用 `react-native-chart-kit@7.x` 做真机 spike，通过后采用 `ContributionGraph`。
2. 对依赖预算敏感，或 spike 发现布局/交互难以贴合现有统计页时：直接写项目内 `ActivityHeatmap`，使用已安装的 `react-native-svg`。
3. 不建议为了“更专用”选择维护停滞或只有单版本历史的小包；它们减少的初始代码量不足以抵消 Expo/RN 后续升级风险。
