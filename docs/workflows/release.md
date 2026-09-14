# 发版工作流

本文档记录 ota-log 的项目发版流程。结合当前 diff、上一版本 tag 和用户已授权的范围执行；本地版本整理、构建、上传和正式发布分别按任务范围完成。

## 步骤

1. 检查当前工作区，确认哪些改动属于本次发版。
2. 根据 Conventional Commits 和上一版本 tag 判断版本号。
3. 同步版本文件：
   - `package.json`
   - `package-lock.json`
   - `app.json`（含 Android `versionCode`）
   - `CHANGELOG.md`
   - `src/utils/appInfo.ts`（`APP_VERSION_LABEL`，关于页自动引用）
4. 运行验证：
   - `npx tsc --noEmit`
   - `npm test -- --runInBand`
   - 必要时运行平台相关构建或 smoke test
5. 核对 release notes；若产品介绍变化，同时核对 About 页文案。用户已授权本地提交与 tag 时继续执行；仅在版本范围存在实质歧义或下一步未获授权时请求确认。
6. 提交 release commit。
7. 创建 git tag。
8. 报告版本、commit、tag 和验证结果；仅列出尚未完成且与本次交付相关的验证。

本地整理完成标准：版本文件一致、相关验证通过，且授权范围内的 commit/tag 已创建。构建、上传或正式发布只有在任务包含这些步骤时才继续；未包含时不等待外部审核。

## 文案规则

- commit message 第一行使用英文 Conventional Commits。
- 版本发布说明维护在 `CHANGELOG.md`；`app/about.tsx` 展示产品介绍，仅在介绍内容变化时更新。

## 注意事项

- 发版提交只包含发版相关文件，不吸收无关工作区改动。
- 有未提交原型、临时脚本或本地排查文件时，先确认是否属于本次发版范围。
- tag 只在 release commit 成功后创建。
