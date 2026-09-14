# ota-log docs

本目录保存 vibe coding 和长期维护需要反复引用的项目知识。原则是：

- `AGENTS.md` 只放 agent 每次都应遵守的硬规则、常用命令和入口链接。
- `docs/` 放产品、数据、技术、决策、进度和工作流的长期上下文。
- 设计状态以代码为准；文档用于解释意图、取舍和验证方式。
- 文档需要在重要方向变化、功能落地、schema 调整、发版流程变化后更新。

## 文档地图

| 目录 | 用途 | 何时更新 |
|------|------|----------|
| `product/` | UI/UX、信息架构、主要功能设计 | 页面结构、共享组件、功能边界或交互规则变化时 |
| `data/` | 数据结构、迁移策略、长期 schema 设计 | 修改数据库、Repository、导入模型或数据口径时 |
| `decisions/` | 重要决策记录，说明背景、备选方案和后果 | 做出难回滚或影响多模块的取舍时 |
| `tech/` | 技术栈、依赖约束、本地环境说明 | 升级 Expo/RN、改构建链、调整关键依赖时 |
| `progress/` | 保留已有专题阶段记录，不作为当前任务队列 | 仅相关专题任务需要补充验证记录时 |
| [`../publishing/`](../publishing/README.md) | 官网、应用商店与公开产品文案的发布源材料 | 商店元数据、官网内容或公开下载信息变化时 |
| `workflows/` | 项目专属工作流，如测试、验证、demo、发版 | 命令、验收标准或常见失败路径变化时 |

## 当前规范与工作流

按任务选择入口，不要求全部读取。专题中的历史版本和实施记录只解释背景；当前实现以代码为准，任务范围由当次对话或明确指定的 issue 承接。

- 产品定位：[PRODUCT.md](../PRODUCT.md)
- 领域术语：[CONTEXT.md](../CONTEXT.md)

- UI/UX 设计：[product/ui-ux.md](product/ui-ux.md)
- 艺人页面：[product/artist-pages.md](product/artist-pages.md)
- 切册页面：[product/cheki-pages.md](product/cheki-pages.md)
- 日历页面：[product/calendar.md](product/calendar.md)
- 活动页面：[product/event-pages.md](product/event-pages.md)
- 我的与设置：[product/profile-settings.md](product/profile-settings.md)
- 工具箱：[product/tools.md](product/tools.md)
- 新手引导：[product/onboarding.md](product/onboarding.md)
- 小组件呈现：[product/ios-widget-presentation.md](product/ios-widget-presentation.md)
- 首页置顶信息功能设计：[product/home-pinned-info.md](product/home-pinned-info.md)
- 统计自定义功能设计：[product/stats-customization.md](product/stats-customization.md)
- 电子切册筛选与规格重构：[product/cheki-filter-refactor.md](product/cheki-filter-refactor.md)
- iOS 拍立得分组小组件设计：[product/ios-cheki-widget-groups.md](product/ios-cheki-widget-groups.md)
- 活动详情分享功能设计：[product/event-sharing.md](product/event-sharing.md)
- iOS 实时活动功能设计：[product/live-activity.md](product/live-activity.md)
- 活动搜索与筛选：[product/activity-search-filter.md](product/activity-search-filter.md)
- iEvent 导入：[product/ievent-import.md](product/ievent-import.md)
- 活动数据结构设计：[data/activity-data-model-design.md](data/activity-data-model-design.md)
- 艺人类型与所属关系：[data/artist-data-model-design.md](data/artist-data-model-design.md)
- 拍立得数据结构设计：[data/cheki-data-model-design.md](data/cheki-data-model-design.md)
- 重要日期数据结构设计：[data/important-date-data-model.md](data/important-date-data-model.md)
- 技术选型：[tech/stack.md](tech/stack.md)
- iOS 拍立得实时边框与裁切 Demo：[tech/cheki-crop-demo.md](tech/cheki-crop-demo.md)
- 决策记录模板：[decisions/0000-template.md](decisions/0000-template.md)
- 艺人类型与团体履历决策：[decisions/0001-artist-types-and-memberships.md](decisions/0001-artist-types-and-memberships.md)
- iPad 自适应布局决策：[decisions/0002-ipad-adaptive-layout.md](decisions/0002-ipad-adaptive-layout.md)
- iPad 自适应布局进度：[progress/ipad-adaptation.md](progress/ipad-adaptation.md)
- App Store Connect 简体中文元数据：[`publishing/app-store/metadata/zh-Hans.md`](../publishing/app-store/metadata/zh-Hans.md)
- 官网首页与预览说明：[`publishing/website/README.md`](../publishing/website/README.md)
- 测试验证工作流：[workflows/testing.md](workflows/testing.md)
- 发版工作流：[workflows/release.md](workflows/release.md)
- App Store 截图工作流：[workflows/app-store-screenshots.md](workflows/app-store-screenshots.md)
- 私有艺人构建工作流：[workflows/private-artist-build.md](workflows/private-artist-build.md)

## 调研与历史记录

- 已实施的文案变更记录：[电子切册文案调整](product/cheki-copy-refresh.md)；不替代当前筛选规范。
- 待决策调研：[边界识别方案](tech/cheki-boundary-detection-options.md)、[白平衡方案](tech/cheki-white-balance-options.md)。
- 有日期的截图生成记录见 [发布材料](../publishing/README.md)，用于复现当次产物，不作为当前发布指令。

## 维护规则

1. 新文档先写清楚定位，不确定的内容标记为“待决策”，不要写成已实现事实。
2. 同一件事只保留一个权威位置，其他文件用链接引用。
3. 决策类内容优先写入 `decisions/`，不要埋在流水账里。
4. 不维护或重建 `now.md`，也不另建全局当前进度替代文件。任务范围由当次对话或明确指定的 issue 承接；历史完成项保留在 Git / CHANGELOG，旧计划不构成执行授权。
5. workflow 文档按实际需要记录命令、前置条件、成功标准和已知失败处理；本地交付与外部发布分别定义完成标准，不为凑模板新增流程。
