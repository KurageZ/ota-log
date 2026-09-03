# 对外发布材料

本目录集中保存 ota log 对外发布所需、适合版本控制的源材料。发布流程文档仍位于 `docs/workflows/`；Expo、EAS 和版本配置仍保留在仓库根目录。

## 目录

- `website/`：官网静态页面、资源和本地预览说明。
- `app-store/metadata/`：App Store Connect 公开元数据快照。
- `app-store/screenshots/<日期>/`：每次商店截图生成所需的说明、脚本和模板。

截图原图、演示素材、数据库、导出图片、校验结果和 ZIP 等本地产物由根 `.gitignore` 排除，不纳入版本控制。APK 等安装包继续保存在根 `release/` 目录，当前不在本次整理范围内。

## 相关工作流

- [发版工作流](../docs/workflows/release.md)
- [App Store 截图工作流](../docs/workflows/app-store-screenshots.md)
