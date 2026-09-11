# 拍立得边界识别与裁切方案调研

日期：2026-09-10。定位：候选方案与待验证取舍，不代表已采用；未用真实拍立得样本实测准确率。本次仅整理文档，不修改功能。

## 可用方案

| 方案 | 能力与接入 | 对本项目的限制 |
| --- | --- | --- |
| [react-native-document-scanner-plugin](https://github.com/WebsiteBeaver/react-native-document-scanner-plugin) | MIT 开源 RN 封装，提供扫描 UI 与裁切后的图片，支持 Expo config plugin；需要原生开发构建，不能运行于 Expo Go | 开源的是封装，不是底层识别模型。它主要启动完整扫描流程，公开 API 不是输入任意图片并返回四角；iOS 相册导入不能依赖它解决 |
| Apple Vision / VisionKit | [Vision 矩形检测](https://developer.apple.com/documentation/vision/vndetectrectanglesrequest/maximumobservations)可配置候选数、比例、尺寸、置信度与角度；[VisionKit](https://developer.apple.com/documentation/visionkit/vndocumentcameraviewcontroller)提供系统拍照扫描界面 | 两者不同：系统扫描 UI 不能直接替换相册图片检测方法；对拍立得外白框是否更准需要对比 |
| [Google ML Kit Document Scanner](https://developers.google.com/ml-kit/vision/doc-scanner/android) | Android 完整扫描流程，允许在扫描 UI 中导入相册，返回 JPEG/PDF | 依赖 Google Play services 动态下载模型、逻辑与 UI；首次使用可能等待下载，不能当作无 GMS 设备的通用方案；公开接口不是任意图片四角检测器 |
| [Scanbot SDK](https://scanbot.io/developer/react-native-document-scanner/) | 商业 SDK，提供自动边界、裁切、扫描 UI，支持 RN、Expo 开发构建与本地处理 | 需要商业授权；官方能力不等于拍立得实测效果，先使用试用版验证 |
| OpenCV | [轮廓提取与多边形逼近](https://docs.opencv.org/4.x/d3/dc0/group__imgproc__shape.html)配合[透视变换](https://docs.opencv.org/4.x/da/d54/group__imgproc__transform.html)，可以自建可控的四角识别与裁切流程 | 是图像处理组件，不是可直接接入且保证效果的拍立得扫描器；背景、反光、内外边框选择规则仍需自己实现与验证 |

补充：[Apple 文档分割请求](https://developer.apple.com/documentation/vision/vndetectdocumentsegmentationrequest)返回四角与显著性 mask，但官方定位是含文字的矩形区域。它值得和现有矩形检测做 A/B，不应直接宣称更适合照片。

[IMG.LY PhotoEditor SDK](https://img.ly/docs/pesdk/react-native/guides/transforms/)的相关官方页面介绍的是裁剪、翻转、旋转与固定比例；本次没有找到足够官方证据证明其为自动文档四角识别引擎，因此不把它列为直接替代方案。

## 推荐验证顺序（待决策）

1. 固定一组拍立得照片，覆盖白底白框、深色桌面、反光、倾斜、透明保护套、强烈内画面矩形、签名与贴纸。标注期望的外边框四角。
2. 对比现有识别、iOS 系统扫描以及 Vision 文档分割；前者与分割可用同一静态图片，系统相机扫描需同场景重新拍摄，不能混称同图基准。
3. 优先加入可拖动四角与透视裁切确认。任何自动检测都可能选中内画面、卡套或背景，手动校正使失败仍可完成任务；这是一项产品建议，不是准确率结论。
4. 如果需要统一 iOS/Android 且覆盖无 GMS 的设备，再比较 OpenCV 自建与 Scanbot 试用的效果、成本和包体。

拍立得应保留原色、签名和装饰。[ML Kit](https://developers.google.com/ml-kit/vision/doc-scanner)的 Full 模式含去污、去手指等图像清理，Base 模式只保留基础编辑；评估时应控制模式，检查是否误改照片内容。识别在本地运行，不代表第一次初始化无需联网下载资源。

## 本次结论

有成熟现成实现，但“扫描文档”和“精确保留拍立得外框”不是相同的验收目标。先以真实失败样本验证候选选择与手动四角体验，比直接换库更有依据；所有候选对本项目 Expo/RN 版本的编译与真机兼容性仍待验证。
