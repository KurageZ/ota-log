# 发版工作流

本文档记录 ota-log 的项目发版流程。发版前仍需结合当前 diff、上一版本 tag 和用户确认执行。

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
5. 用户审核 release notes；若产品介绍变化，同时核对 About 页文案。
6. 提交 release commit。
7. 创建 git tag。
8. 给出新版本测试建议。

## 文案规则

- commit message 第一行使用英文 Conventional Commits。
- 版本发布说明维护在 `CHANGELOG.md`；`app/about.tsx` 展示产品介绍，仅在介绍内容变化时更新。

## 注意事项

- 发版提交只包含发版相关文件，不吸收无关工作区改动。
- 有未提交原型、临时脚本或本地排查文件时，先确认是否属于本次发版范围。
- tag 只在 release commit 成功后创建。
