# 私有艺人构建工作流

公开源码不跟踪第三方艺人数据或头像。过渡版本在仓库外维护旧版头像源，并只在一次性的 staging 目录中生成静态 Metro 资源，用于把升级用户数据库中的 `preset://` 头像永久化。

## 私有素材源

默认本地路径可以放在仓库同级目录：

```text
../ota-log-private-artists/
├── artists.json
├── manifest.json
├── checksums.sha256
└── avatars/
    └── avatar_<id>.jpg
```

`artists.json` 的格式为 `ota-log-bundled-artist-source` v1。每条记录包含稳定 UUID、名称、简称、父级、公开链接和可空的 `avatar_id`。图片文件名必须与 `avatar_id` 一一对应。

私有目录不得复制进 ota-log 工作树，不得加入 Git branch、tag、stash 或 release source archive。

## 构建接口

公开源码中的 `src/db/bundledArtistCatalog.ts` 是空 Adapter。`scripts/inject-bundled-artists.mjs` 只允许修改不含 `.git` 的 staging 目录，并生成：

- 带静态 `require()` 的迁移 Adapter；不再向新数据库写入艺人。
- `assets/bundled-artists/` 下的临时头像副本。

`scripts/run-with-private-artists.mjs` 负责复制当前项目、排除 Git 和旧敏感路径、链接 `node_modules`、注入私有素材、执行指定命令，并在结束后删除 staging。

## 私有构建

如果本地 `build_apk.sh` 检测到同级的 `ota-log-private-artists`，会自动使用 staging 构建。也可以显式指定路径：

```sh
OTA_LOG_ARTIST_SOURCE_DIR=/absolute/path/to/ota-log-private-artists ./build_apk.sh
```

单独验证私有 TypeScript 生成结果：

```sh
node scripts/run-with-private-artists.mjs \
  --source /absolute/path/to/ota-log-private-artists \
  -- ./node_modules/.bin/tsc --noEmit
```

需要保留已安装 `.dev` 应用的数据进行 Android 调试时，通过同一 staging 包装器运行 Expo；`app.json` 中的 `android.versionCode` 必须与已安装版本一致，避免系统拒绝降级安装：

```sh
node scripts/run-with-private-artists.mjs \
  --source /absolute/path/to/ota-log-private-artists \
  -- npx expo run:android
```

构建脚本设置 `OTA_LOG_PRIVATE_BUILD_STAGING=1` 防止 staging 中递归创建 staging。

## 公开构建

公开构建不注入任何素材，新数据库中的艺人表保持为空：

```sh
OTA_LOG_PUBLIC_BUILD=1 ./build_apk.sh
```

已有数据库中的艺人不会被删除。若记录仍使用 `preset://`，不含迁移资源的公开构建会保留记录并显示无头像占位；包含迁移资源的过渡构建会在启动时将头像复制到 Documents，并把数据库引用改为可备份的 `file://` URI。

## 验收

- 私有素材校验结果为 356 条艺人、354 张头像、2 条无头像记录。
- 公开工作树不存在 `assets/artists/`、`assets/bundled-artists/`、旧 seed 或旧头像映射。
- 公开与私有 staging 均通过 `npx tsc --noEmit`。
- 过渡 APK 全新安装后不出现第三方艺人；旧库中的 `preset://` 头像会转成 Documents 文件并可随完整备份恢复。
- Git 历史清理完成前，不创建公开 remote 或上传源码归档。
