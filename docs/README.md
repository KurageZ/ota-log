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
| `progress/` | 当前焦点、TODO、roadmap、关键节点 | 切换阶段、收敛计划、完成里程碑时 |
| [`../publishing/`](../publishing/README.md) | 官网、应用商店与公开产品文案的发布源材料 | 商店元数据、官网内容或公开下载信息变化时 |
| `workflows/` | 项目专属工作流，如测试、验证、demo、发版 | 命令、验收标准或常见失败路径变化时 |

## 当前入口

- UI/UX 设计：`product/ui-ux.md`
- 首页置顶信息功能设计：`product/home-pinned-info.md`
- 统计自定义功能设计：`product/stats-customization.md`
- 电子切册筛选与规格重构：`product/cheki-filter-refactor.md`
- 电子切册文案调整记录：`product/cheki-copy-refresh.md`
- iOS 拍立得分组小组件设计：`product/ios-cheki-widget-groups.md`
- 活动详情分享功能设计：`product/event-sharing.md`
- 活动搜索与筛选：`product/activity-search-filter.md`
- 活动数据结构设计：`data/activity-data-model-design.md`
- 艺人类型与所属关系：`data/artist-data-model-design.md`
- 拍立得数据结构设计：`data/cheki-data-model-design.md`
- 重要日期数据结构设计：`data/important-date-data-model.md`
- 技术选型：`tech/stack.md`
- 决策记录模板：`decisions/0000-template.md`
- 艺人类型与团体履历决策：`decisions/0001-artist-types-and-memberships.md`
- 当前进度：`progress/now.md`
- App Store Connect 简体中文元数据：[`publishing/app-store/metadata/zh-Hans.md`](../publishing/app-store/metadata/zh-Hans.md)
- 官网首页与预览说明：[`publishing/website/README.md`](../publishing/website/README.md)
- 拍立得新版 UI 验收清单：`progress/cheki-v2-ui-checklist.md`
- 电子切册筛选与规格重构 QA：`progress/cheki-filter-refactor-qa.md`
- 测试验证工作流：`workflows/testing.md`
- 发版工作流：`workflows/release.md`
- App Store 截图工作流：`workflows/app-store-screenshots.md`
- 私有艺人构建工作流：`workflows/private-artist-build.md`

## 维护规则

1. 新文档先写清楚定位，不确定的内容标记为“待决策”，不要写成已实现事实。
2. 同一件事只保留一个权威位置，其他文件用链接引用。
3. 决策类内容优先写入 `decisions/`，不要埋在流水账里。
4. `progress/now.md` 保持短小，只记录当前上下文和下一步；历史完成项移到 `progress/milestones.md` 或删除。
5. workflow 文档必须包含可执行命令、前置条件、成功标准和常见失败处理。
