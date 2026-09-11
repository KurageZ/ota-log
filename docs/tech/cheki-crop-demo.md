# iOS 拍立得裁切 Demo

入口：我的 → 工具箱 → 影像 → 拍立得自动裁切（Demo）。仅 iOS 开发模式（`__DEV__`）显示；不写入切册记录。

## 拍立得记录接入（2026-09-11）

- 新建和编辑记录的 iOS「扫描拍立得」复用系统扫描，一次返回的全部图片追加到表单，按现有逻辑更新数量；每张作为独立拍立得的正面图片，保存表单后写入记录。
- Android 保留普通拍摄；相册选择逻辑不变。扫描取消不改变已有图片，失败展示错误并恢复操作。
- 记录表单不包含 Demo 的白平衡编辑。系统滤镜仍需手动选择，保存前检查白边、签名和颜色。
- 真机回归需覆盖多张扫描回填、记录保存与重新打开、权限拒绝和取消，以及正式构建隐藏 Demo 入口。

## 当前行为

- 「系统扫描相机」直接调用 VisionKit 的 `VNDocumentCameraViewController`，由系统完成扫描、四角调整和透视裁切，不再经过 Demo 的矩形检测。
- 支持系统一次返回多张扫描结果，逐张保存和展示；取消扫描保留上次结果。输出长边不超过 2000，并通过 `copyToDocuments()` 保存永久 URI。
- 已移除「从相册选择」和候选边框确认 UI；当前仅使用系统扫描。
- 系统扫描 UI 由 iOS 管理，不能通过公开接口限制只扫描一张或导入已有相册照片；请在系统预览中检查颜色、白边与签名。
- 原有自定义相机与跟踪代码保留，但当前入口不再调用。

## 构建

需要包含 `modules/cheki-crop` 的开发客户端，Expo Go 和仅 JS 刷新无法添加此模块。统一使用开发配置，避免生成生产工程后打开不同标识的 App：

```sh
rtk npm run prebuild:ios:dev
rtk npm run ios:dev -- --device
```

选择真机，打开 **ota log Dev**。仅修改 Swift 后可直接重新运行构建命令；新增 Swift 文件需要 Pods 更新，标准 Expo 构建流程会处理原生依赖。

## 验证

TypeScript 和 Jest 使用项目基线。可在 macOS 编译同一份原生图像处理与边框跟踪代码，使用合成相纸验证几何处理：

```sh
rtk proxy xcrun swiftc modules/cheki-crop/ios/ChekiCropProcessor.swift modules/cheki-crop/ios/ChekiBoundaryTracker.swift scripts/cheki-crop-smoke.swift -o /tmp/cheki-crop-smoke
rtk proxy /tmp/cheki-crop-smoke /tmp/cheki-crop-qa-run
```

输出目录每次使用新的路径。覆盖稳定判断、抖动平滑、目标丢失、大幅移动重置、实体外框、透视输出、EXIF 旋转、无边界及错误输入。合成样本通过不代表真机准确率或实时性能达标。

真机验收：

1. 首次授权／拒绝相机权限，拒绝时提示到系统设置授权，取消后保留原有结果。
2. 扫描一张／多张，确认返回数量一致且每张结果均可查看，图片方向、白边、签名和颜色正确。
3. 在系统页面调整四角，返回后结果与系统确认一致，不再出现候选边框确认步骤。
4. 取消、前后台切换后能退出／重新扫描；取消时上次结果仍保留。检查无扫描支持设备提示。
5. iPhone、iPad 浅深色模式下按钮和文案可见，旋转后结果无拉伸；白平衡控件跟随 App 主题。

实时摄像头输入与完整真机拍摄链路仍需设备验收；模拟器只用于构建和非相机流程检查。

## VisionKit 接入验证记录（2026-09-10）

- TypeScript 检查通过；已有 Jest 121 suites / 820 tests 全部通过，新增扫描页面 3 项测试通过。
- 新增 `ChekiDocumentScanner.swift` 与图像处理代码通过 iOS Simulator SDK 的 Swift typecheck；此项不等同完整 App 构建。
- 覆盖多张结果永久保存、跳过二次检测、取消保留旧结果、扫描失败及权限拒绝。
- 尚待重新构建开发客户端及真机验收，包括系统四角调整、相纸颜色、相机生命周期与浅深色模式。

## 白平衡调整（2026-09-11）

- 每张结果可选择干净白边的一小块区域，取样时显示未调整原图，并显示选点标记。
- Core Image 在统一的线性 sRGB 空间取样与执行 RGB 增益，区域半径为图片短边的 1%；排除过暗和高光剪切像素，有效像素不足一半时提示重新取样。
- 逐通道中位数减轻少量笔画影响，不能识别或保证排除大面积签名。用户应避开签名、阴影、反光和非白色装饰边。
- 调整中性色偏时保留参考区域亮度，不把白边强制提亮为纯白。提供 0–100% 原生强度滑杆、原图对比、恢复原图、显式保存调整。
- 每次调整都从最初的扫描图重新计算；预览为临时文件，点击保存后通过 `copyToDocuments()` 保存新文件，未调整原图不覆盖。不写入切册。
- Swift 合成图片验证覆盖暖/冷色校正、上下坐标、少量黑色笔画、亮度保持、强度、无效样本和边缘取样。组件测试覆盖原图来源、保存、重置时过期请求、错误与零强度。

```sh
rtk proxy xcrun swiftc modules/cheki-crop/ios/ChekiCropProcessor.swift modules/cheki-crop/ios/ChekiWhiteBalanceProcessor.swift scripts/cheki-white-balance-smoke.swift -o /tmp/cheki-wb-smoke
rtk proxy /tmp/cheki-wb-smoke /tmp/cheki-wb-qa
```

Core Image 合成测试需要可用的系统图像渲染服务；沙箱隔离可能导致渲染导出失败。真机仍需验证细白边选点、实际肤色/签名保留、系统扫描滤镜影响及 iPhone/iPad 浅深色布局。

本轮检查：TypeScript、123 个 Jest suites / 827 项测试通过；Swift iOS SDK 类型检查与 Core Image 合成图片测试通过。独立代码审查未发现阻塞问题，未作真实拍立得与设备视觉验收。
