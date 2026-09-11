# 拍立得白边取样与白平衡调研

日期：2026-09-11。仅调研，未实现或用真实样本验证。

## 结论

系统扫描后可以继续校正颜色。VisionKit 的 [imageOfPage(at:)](https://developer.apple.com/documentation/visionkit/vndocumentcamerascan/imageofpage(at:)) 返回 UIImage；当前 `ChekiDocumentScanner.swift` 将其缩放、编码为 JPEG。后续可接 Core Image，较理想的位置是确认调整后统一导出，避免反复 JPEG 编码。

建议先做「手动选择干净白边的小区域 + Core Image 校正 + 强度/原图对比/重置」，再用真实失败样本开发自动白边取样。没有找到经核验、可直接完成「识别拍立得白边并排除签名」的现成组件。

## 工具比较

- **Apple Core Image（优先）**：[CIColorMatrix](https://developer.apple.com/documentation/coreimage/cicolormatrix) 可执行 RGB 增益/颜色矩阵；[CITemperatureAndTint](https://developer.apple.com/documentation/coreimage/citemperatureandtint) 提供色温与色调调整。它们是校正执行器，不负责识别白边或签名。取样与运算须统一色彩空间，参考 [workingColorSpace](https://developer.apple.com/documentation/coreimage/cicontextoption/workingcolorspace)。可在现有 Swift 模块本地处理，无需引入大型编辑 SDK。
- **CIWhitePointAdjust 命名陷阱**：[官方说明](https://developer.apple.com/documentation/coreimage/cifilter-swift.class/whitepointadjust())是将灰色映射为指定 color；不能把偏黄的采样色直接传入并认为它会自动变白。应估计把采样色映射到中性灰的校正变换，单独验证方向。
- **OpenCV xphoto（开源备选）**：[GrayworldWB](https://docs.opencv.org/4.x/d7/d71/classcv_1_1xphoto_1_1GrayworldWB.html) 基于灰世界假设，能排除高饱和度像素，但这不等于识别白边或排除黑色签名。[SimpleWB](https://docs.opencv.org/4.x/d1/d8b/classcv_1_1xphoto_1_1SimpleWB.html)独立拉伸各通道并忽略极端百分位。公开 balanceWhite(src, dst) 接口没有白边 mask 参数。二者都不宜直接全图使用作为拍立得保色默认方案；专用区域取样仍需实现。
- **Lightroom / darktable（效果基准工具）**：[Lightroom 白平衡吸管](https://helpx.adobe.com/lightroom-classic/desktop/process-and-develop-photos/image-tone-color.html)建议选择中性浅灰区域；[darktable 色彩校准](https://docs.darktable.org/usermanual/development/en/module-reference/processing-modules/color-calibration/)提供区域取样与色适应。可先验证同一张扫描结果是否能通过白边校正得到满意效果；它们不是直接嵌入 Expo 的 SDK。
- **通用商业编辑器**：[IMG.LY RN 调整文档](https://img.ly/docs/pesdk/react-native/guides/adjustments/)列出亮度、对比度、饱和度、清晰度、阴影、高光和曝光；本次证据不足以把它视为具备白边取样、签名排除的即插即用方案。

## 白边、签名与取样建议（设计推断，需实测）

1. 以已校正透视的图像为输入，只在明确属于纸边的区域取样，不用整张照片平均颜色。不同规格相纸、旋转与裁切误差意味着不能假定固定底边永远为空白。
2. 手动模式选择小区域而非单像素，显示取样位置；避开文字、贴纸、内画面边界、阴影及高光。采用区域中位数/截尾统计减少少量笔画和噪声影响，但大面积覆盖时仍会失效。
3. 自动模式把边框分为多个小块，联合亮度、局部纹理/梯度、颜色一致性筛选；彩笔、黑笔、银笔分别可能表现为色彩异常、暗纹理和反光。不能只设低饱和度门槛：黑签名也低饱和度，强色偏白纸反而可能被排除。
4. 排除通道剪切和明显反光区域；比较不同边的估计是否一致。样本不足或混合光导致估计冲突时，不自动应用，改为让用户点选或保持原图。
5. 校正中性色偏与提亮分开，不强制把取样值拉到 RGB 255。签名只从估计样本排除，不进行涂白、去字或修复；输出整张图仍会受整体颜色变换影响。
6. 保留未调整扫描图，允许强度调节与撤销，避免把相纸本来的暖白、泛黄或装饰边误当照明色偏。此流程目标是改善翻拍色偏，不是还原拍立得成像之前的场景颜色。

## 能力边界与验证

- 当前拿到的是系统扫描渲染结果，不是 RAW。已经变成黑白、被剪切的高光或丢失的颜色信息，不能通过白平衡恢复；先在系统预览保留合适的彩色结果。
- 一次全局白平衡不能解决左右不同光源、局部阴影、反光、扫描局部增强等全部问题。相纸白边也不是经过标定的标准灰卡。
- 固定样本覆盖：暖光/冷光、原本正常、黑字/彩字/银字、反光、阴影、边框大面积覆盖、暖白/泛黄纸边。比较未调整、人工吸管基准与自动建议。
- 验收同时检查白边中性程度、人像肤色、签名颜色和高光细节，不能只用「白边是否纯白」判断成功。
