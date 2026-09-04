# ADR 0002: iPad 自适应布局基础结构（阶段一 P0）

- 状态：已接受
- 日期：2026-09-02
- 相关文件：
  - `app.json`
  - `src/utils/windowMode.ts`
  - `src/components/adaptive/AppContainers.tsx`
  - `src/navigation/app-tab-navigator.ios.tsx`
  - `docs/progress/ipad-adaptation.md`

## 背景

App 声明了 `supportsTablet: true`，但 `orientation` 仍是 `portrait`，iPad 最有价值的横屏姿态被直接放弃，也谈不上可靠的 Split View / Stage Manager 体验。页面普遍直接使用固定 16px 边距（首页、统计、活动列表、设置等），宽屏下内容会无限拉宽，导航也需要在 iPad 横屏下保持不遮挡内容。

目标不是“适配 iPad 设备”，而是让界面随窗口宽度工作：每个窗口宽度都有合理的布局，窄窗口保持现有手机体验。

## 备选方案

### 方案 A：按设备型号（`Platform.isPad`）整体切换

- 优点：改动集中，判断简单。
- 缺点：Split View 会把同一台设备切成不同宽度，型号判断无法表达窗口宽度；横竖屏切换、外接屏幕都会出现布局错位。

### 方案 B：只做“加宽边距 + 居中”

- 优点：改动最小。
- 缺点：只解决视觉空旷感，无法为统计、首页建立多栏/主从结构；边距提升没有内容承载，后续阶段要返工。

## 决策

采用按窗口宽度的三档布局模式，并抽象统一的宽屏容器：

1. 解除竖屏锁定：`app.json` 的 `orientation` 改为 `default`，支持双方向；布局一律按窗口宽度判定，不按设备型号判定。
2. 窗口模式：`src/utils/windowMode.ts` 定义 Compact（< 680）、Regular（680–959）、Wide（≥ 960）三档；阈值按内容是否拥挤校准，后续可调整。
3. 统一容器：`src/components/adaptive/AppContainers.tsx` 提供阅读/表单容器（最大 680，居中）和仪表盘容器（最大 1120，允许双栏/多栏），gutter 随模式从 16 提升到 24/32；页面不再各自硬编码水平边距。
4. iPad 导航：iOS `NativeTabs` 显式使用 Tab Bar，五个主入口保持为同级顶层导航，不启用 `sidebarAdaptable`。Apple 建议 iPadOS 的顶层导航优先考虑 Tab Bar；Sidebar 更适合需要持续呈现的层级导航，并会在新系统视觉中浮于内容之上。当前信息架构只有五个平级入口，使用 Tab Bar 可避免横屏下导航遮挡内容。

## 理由

- 窗口宽度是最接近“内容是否拥挤”的代理指标，能覆盖 Split View、Stage Manager、横竖屏和外接屏，无需维护设备清单。
- 容器抽象把“最大宽度、居中、gutter”收敛到一处，后续页面按同类容器接入即可，符合阶段化推进。
- 固定使用系统 Tab Bar 与当前扁平信息架构匹配，且避免 adaptable sidebar 在 iPad 横屏下浮在内容上方。仍使用同一个原生导航器，不会因窗口宽度变化而重置导航状态。

## 后果

- 正面影响：横屏和 Split View 可用，顶层导航不遮挡内容；首页、统计、活动列表、设置四页获得宽屏基础结构；后续阶段（双栏、主从、多列仪表盘）有统一挂载点。
- 负面影响：需要为 iPad 引入新的真机/模拟器验证项；若未来顶层信息架构增长到 Tab Bar 难以承载，需重新评估 Sidebar。
- 需要补充的测试或文档：
  - `src/utils/__tests__/windowMode.test.ts` 覆盖窗口模式划分与容器内容宽度计算。
  - `docs/progress/ipad-adaptation.md` 记录分阶段计划。
- 未来可能的回退或替代条件：若某类页面不适合容器化（如日历网格），允许单独决策并记录例外；若窗口模式阈值经真机验证需要调整，只改 `windowMode.ts` 常量。
