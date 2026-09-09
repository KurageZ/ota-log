# 商店截图更新 · 2026-09-09

基于 2026-08-31 的文案和 HTML/CSS 模板，重新采集当前 App 的六个页面，使用 2026-09-08 更新的三张虚构拍立得示例图。旧版目录保持原样。本次未上传 App Store Connect。

## 成品

每个 ZIP 只包含该规格的六张 PNG，解压后按 01–06 上传。

| 规格 | 像素尺寸 | ZIP |
| --- | --- | --- |
| iPhone 6.5 英寸 | 1284 × 2778 | `ota-log-app-store-iphone-6.5-zh-Hans.zip` |
| iPhone 6.9 英寸 | 1320 × 2868 | `ota-log-app-store-iphone-6.9-zh-Hans.zip` |
| iPad 13 英寸 | 2064 × 2752 | `ota-log-app-store-ipad-13-zh-Hans.zip` |

PNG 位于 `ready/zh-Hans/`；`preview-iphone-6.5.jpg`、`preview-iphone.jpg`、`preview-ipad.jpg` 仅用于预览。素材、QA、图片、配置和 ZIP 均为 Git 忽略的本地文件。

## 来源与限制

- 采集设备沿用 `ota-log Store iPhone`（FBCFC373-EA6B-4FD7-99DD-494DB3150D8A）和 `ota-log Store iPad`（2EE10247-D2F9-4A62-BD89-33F147EB93F1），未操作日常模拟器。
- 已安装的原生 Debug 容器版本为 2.0.0 / Build 1，加载当前工作区 JavaScript（package.json 版本 2.0.1，Git HEAD `126cffcb0f8ebf1eaead6a7e8577a1ea8054fb87`），不是从 TestFlight 提审构建采集；提审前需确认发布构建界面一致。
- 三张切册图片来自上次已更新的演示数据，艺人背景和头像沿用原素材，均为虚构成年人生成图片。
- 活动计划页选用 2026-09-12「周末见面计划」；日历选中 2026-08-30；统计选择 2026 年。系统当前日期为 2026-09-09，App 自行计算为 14 场已完成、2 场计划中、29 张拍立得。
- 状态栏时间统一为 9:41，浅色外观，隐藏开发浮标。
- 6.5 英寸使用 iPhone 原始截图等比嵌入对应营销画布。尺寸于本次核对 [Apple 官方规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)。当前工具没有登录 App Store Connect 的浏览器连接，因此没有重新读取账户内的实际上传栏位；交付三种此前使用的规格，上传时按实际栏位选择。

## 复现与验证

依赖安装在 `/private/tmp/ota-store-tools`：Koubou 0.20.0、Pillow 12.3.0、PyYAML 6.0.3，HTML 使用 Playwright Chromium。独立 Metro 使用 8088 端口。

`capture.py iphone` / `capture.py ipad` 采集六页。脚本中的等待不是页面就绪保证，初次路由按需加载较慢，必须逐页检查；本次已补拍 iPhone 活动页和艺人页。日历通过本地 React Native 调试连接触发界面已有的月份按钮、8 月按钮、30 日按钮，再由 simctl 采集真实渲染，没有改写页面内容或伪造截图。

在本目录执行：

```sh
rtk proxy /private/tmp/ota-store-tools/bin/python build-configs.py
rtk proxy /private/tmp/ota-store-tools/bin/kou generate iphone-6.5.yaml
rtk proxy /private/tmp/ota-store-tools/bin/kou generate iphone.yaml
rtk proxy /private/tmp/ota-store-tools/bin/kou generate ipad.yaml
rtk proxy /private/tmp/ota-store-tools/bin/python package-assets.py --profile iphone-6.5
rtk proxy /private/tmp/ota-store-tools/bin/python package-assets.py
```

18 张成品均通过像素尺寸、RGB/无透明通道、PNG 解码、排版边界与重叠检查；ZIP 校验文件顺序、数量及解压完整性。哈希和验证记录位于 `qa/validation*.json`。已查看三套完整预览并核对关键原始页面，新拍立得在切册和日历正常显示，修正了初次加载未完成的截图。
