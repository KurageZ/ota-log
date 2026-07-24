# iEvent 活动 10365 一手数据调查

> 调查对象：[YGG IDOL Fes -麻乐栖&猫猫虫生日SP-](https://ievent.life/event/10365)  
> 抓取时间：2026-07-24（Asia/Shanghai）  
> 范围：记录 iEvent 当前页面、页面内结构化数据及服务端渲染数据中实际存在的事实，并用当前 ota-log v16 schema 和现有公告解析链路复现实际导入效果。

## 结论摘要

| 项目 | 当前值 | 页面/数据结构 |
|---|---|---|
| iEvent 活动 ID | `10365` | `event_id` |
| 标题 | `YGG IDOL Fes -麻乐栖&猫猫虫生日SP-` | `title`、页面 H1、JSON-LD `name` |
| 日期 | `2026-07-25`（页面显示周六） | `date` |
| 开场时间 | `10:45` | `props.openTime[0].value` |
| 开演时间 | `11:00` | `props.startTime[0].value` |
| 活动结束时间 | 原始活动对象中没有 `endTime` | 页面 JSON-LD 另行输出 `2026-07-25T13:00:00+08:00`，见下文差异说明 |
| 地点 | `世界树剧场一号馆` | `locations[0].name` |
| 地址 | `黄浦区南京东路800号第一百货C馆7楼` | `locations[0].address` |
| 地域字段 | `country: "cn"`、`area_code: "310100"`、`admin_level1_code: "31"`、`admin_level2_code: "0100"` | `locations[0]`；活动对象没有单独的城市名称字符串 |
| 标签 | `拼盘演出`、`地下偶像`、`偶像` | `tags` |
| 简介 | `本场演出禁止一切形式的摄影摄像，谢谢大家的理解与配合。` | `description` |
| 币种 | `CNY` | `currency` |
| 状态 | `normal` | `status` |
| 官方网站 | `https://weibo.com/7925328421/Ra2QY3Yzy` | `props.officialSite[0].value` |
| 封面 | [原图](https://image.ievent.life/cover/c9380e355453a8f6d7b7d97e3a94950c.jpg) | `cover`；嵌入元数据标记宽 `690`、高 `1079` |
| canonical URL | `https://ievent.life/event/10365` | HTML canonical、Open Graph、JSON-LD `url` |
| 参加用户数 | `1` | `users_count`；当前公开参加用户为“铛” |
| 最后编辑 | `Sora 最后编辑于 2026年7月23日 23:07` | 页面可见文本 |

## 票价

页面有两个独立的 `price` 属性项：

| 票种 | 价格 | 权益/附加说明 | 原始 `value` |
|---|---:|---|---|
| 预售票 | `78` CNY | `+1d（15元）`；`本场活动1d含饮料券` | `预售票 \| 78` |
| 当日票 | `98` CNY | `+1d（15元）`；`本场活动1d含饮料券` | `当日票 \| 98` |

原始 `property_addition.benefit` 用英文逗号连接两段说明：`+1d（15元）,本场活动1d含饮料券`；页面展示层将其拆为两段，并以分隔线呈现。这里的 `1d` 是源数据原文，不应自行改写成其他含义。

## 出场人物

页面及 JSON-LD 共列出 23 个关联对象。iEvent 的 JSON-LD 将它们统一输出为 Schema.org `Person`，即使名称看起来可能是团体；服务端活动对象使用统一的 `persons[]` 结构，并没有额外的“团体/个人”类型字段。

1. [Arena](https://ievent.life/person/2021)
2. [Ame](https://ievent.life/person/3841)
3. [Astoria](https://ievent.life/person/2872)
4. [ANNYX](https://ievent.life/person/2736)
5. [EMBEFUSE](https://ievent.life/person/4851)
6. [F1owSec](https://ievent.life/person/4271)
7. [idolzoo](https://ievent.life/person/559)
8. [Misology](https://ievent.life/person/2758)
9. [ReRa](https://ievent.life/person/4429)
10. [solamente](https://ievent.life/person/1334)，页面还显示其原名 `SolameИte`
11. [SUSURRO](https://ievent.life/person/4601)
12. [Starling椋鸟镜辉](https://ievent.life/person/1023)
13. [Token](https://ievent.life/person/4789)
14. [花与心事Affloret](https://ievent.life/person/1349)
15. [华乐神应纪](https://ievent.life/person/3867)
16. [火山残响 VolcanoEcho](https://ievent.life/person/3136)
17. [幻夢YUMEUTSUTSU](https://ievent.life/person/4465)
18. [碎夜瑠璃LapisLazuli](https://ievent.life/person/1388)
19. [她蝶效应Psychelles](https://ievent.life/person/3301)
20. [蛋黄派Sizzle](https://ievent.life/person/2214)
21. [砂糖心跳DokiDoki](https://ievent.life/person/1022)
22. [小熊水滴](https://ievent.life/person/6249)
23. [月令时Mirage](https://ievent.life/person/585)

数据清洁细节：

- `persons[19].name` 的服务端原始值实际是 `" 蛋黄派Sizzle"`，开头有一个空格；JSON-LD 和页面可见文本已经显示为无前导空格的 `蛋黄派Sizzle`。
- 每个关联对象都有 `pivot.belongs_to: 0` 和空的 `pivot.display_name`。
- `EMBEFUSE`、`Token` 的 `cover` 是空字符串，`小熊水滴` 的 `cover` 是 `null`；其他多数对象有各自的人物封面 URL。

## 图片和 URL

- 活动对象的封面原始 URL 是 [c9380e355453a8f6d7b7d97e3a94950c.jpg](https://image.ievent.life/cover/c9380e355453a8f6d7b7d97e3a94950c.jpg)。
- 页面实际渲染封面时追加了 `?x-oss-process=style/cover`。
- `additional_info.coverImageInfo` 给出的原图尺寸为 `690 × 1079`，是明显的竖版海报。
- Open Graph 和 Twitter Card 都使用不带处理参数的原图 URL。
- “官方网站”字段实际指向 [微博原帖](https://weibo.com/7925328421/Ra2QY3Yzy)；iEvent 未在该字段旁提供额外的来源类型或标题。

## 页面不同数据层之间的差异

页面提供了三层可交叉核对的一手信息：

1. 可见详情页：标题、日期、周几、场地、标签、开场/开演、票价、官网、简介、人物和参加用户。
2. 两段 `application/ld+json`：面包屑和 Schema.org `Event`。
3. Next.js 服务端渲染数据：以缓存键 `"/Event/find", 10365` 嵌入完整活动对象，并附带 revision、setlist 和 participant 数据。

其中最值得注意的是结束时间：

- 原始活动对象的 `props` 只有 `openTime`、`startTime`、`price`、`officialSite`，没有 `endTime`。
- 可见详情页也没有“结束时间”一行。
- 但 JSON-LD 输出了 `startDate: "2026-07-25T11:00:00+08:00"` 和 `endDate: "2026-07-25T13:00:00+08:00"`。

因此，`13:00` 只能视为 iEvent 页面为搜索引擎结构化数据生成的结束时间，不能视为原始活动记录明确提供了结束时间。页面没有解释该值的生成规则。

另有以下空缺：

- 页面没有主办方字段。
- 当前没有活动时间表标签页或时间表条目。
- 嵌入的 `"/Event/setlist", 10365` 返回空数组；页面没有呈现 Setlist 内容，“活动 Repo”区明确显示“暂无 Repo”。
- 没有取消或延期提示；`status` 为 `normal`，`redirect` 和 `deleted_at` 均为 `null`。

## ota-log 实现前基线

本功能实现前，ota-log 没有 iEvent URL 抓取或结构化导入器。活动创建页只把微博 URL 识别为可抓取来源；其他输入都直接交给 `parseAnnouncement()`。

直接输入 `https://ievent.life/event/10365` 的结果是：

```json
{
  "title": null,
  "event_date": null,
  "event_time": null,
  "city": null,
  "venue": null,
  "artist": null,
  "ticket_price": null,
  "artist_mentions": []
}
```

因此 UI 会显示“没有解析出足够信息”，不会创建活动，也不会写入数据库。

为了区分“缺少网页抓取”与“公告解析器自身的能力”，本次还将详情页 `main` 元素的实际可见文本原样交给当前 `parseAnnouncement()`。结果为：

```json
{
  "title": "YGG IDOL Fes -麻乐栖&猫猫虫生日SP-",
  "event_date": "2026-07-25",
  "event_time": "10:45",
  "city": "上海",
  "venue": "世界树剧场",
  "artist": null,
  "ticket_price": 78,
  "artist_mentions": []
}
```

这个结果存在三处明显信息损失：

- `event_time` 取到了开场时间 `10:45`，没有取开演时间 `11:00`。
- `venue` 从 `世界树剧场一号馆` 被清洗成了 `世界树剧场`。
- 页面使用“出场人物”作为分区标题，当前出演者规则没有把后续 23 个名称解析为 `artist_mentions`。

如果继续使用当时的通用文本路径，`details` 会保存整段页面可见文本；`event_type` 在创建页固定为 `livehouse`，`status` 使用默认的 `planned`。iEvent URL、官网 URL 和封面都不会自动进入表单。

## 专用导入实现结果

2026-07-24 已增加按链接格式自动分流的轻量导入器。输入界面和预填界面使用通用公告文案，不展示来源品牌。使用当前页面 HTML 复核后的草稿结果为：

```json
{
  "title": "YGG IDOL Fes -麻乐栖&猫猫虫生日SP-",
  "event_date": "2026-07-25",
  "event_time": "11:00",
  "city": "上海",
  "venue": "世界树剧场一号馆",
  "ticket_price": 93,
  "artist_mentions_count": 23,
  "url": "https://ievent.life/event/10365"
}
```

导入器优先读取服务端原始活动对象，使用 JSON-LD 白名单和 Open Graph 补空；封面自动下载，失败不阻断草稿；出演者继续进入原有未知艺人确认流程。数据库结构未改变。

## 按当前 v16 schema 强行映射的结果

如果新增一个专用 iEvent 抓取层并正确读取结构化对象，但仍不修改数据库，能表达的最佳结果大致是一条 `events` 记录：

| `events` 字段 | 建议映射值 | 说明 |
|---|---|---|
| `id` | 新 UUID v4 | 本地生成，无法保留 iEvent ID 的语义 |
| `title` | `YGG IDOL Fes -麻乐栖&猫猫虫生日SP-` | 可无损保存 |
| `event_type` | `livehouse` 或人工选择 | iEvent 三个标签无法无损映射到单一枚举 |
| `event_date` | `2026-07-25` | 可无损保存 |
| `event_time` | `11:00` | 只能保存一个时间；此处优先开演时间 |
| `city` | `上海` | 由场地地域代码/场地页推导，不是活动对象中的城市文本 |
| `venue` | `世界树剧场一号馆` | 可保存名称，不能保存地址或 location ID |
| `ticket_price` | `78` | 只能取一个代表值；当日票和饮料费结构丢失 |
| `status` | `planned` | 是用户记录状态，不等同于 iEvent 的 `normal` |
| `review_score` | `null` | 源数据无对应值 |
| `notes` | `null` | 不建议混入公开活动事实 |
| `details` | 禁止摄影摄像的简介 | 可保存文本，但没有字段来源与覆盖状态 |
| `url` | iEvent canonical URL 或微博官网二选一 | 单 URL 字段无法同时保留来源页和官网 |
| `setlist_text` | `null` | iEvent setlist 为空 |
| `trip_id` | `null` | 与来源活动无关 |
| `created_at` / `updated_at` | 本地导入时间 | 无法保存 iEvent revision/最后编辑时间 |

23 个出演对象可以通过 `event_artists` 关联，但当前公开构建不附带第三方艺人目录，最终是匹配已有本地艺人、创建新艺人还是跳过，需要用户确认。当前表结构也不保存 iEvent person ID、显示顺序、原名、来源头像、`belongs_to` 或导入匹配依据，因此后续再次导入时无法靠外部 ID 稳定去重。

封面理论上可以下载到本地并作为 `photos` 记录关联活动，但现有 iEvent 路径没有该下载逻辑；`photos` 也不区分“活动海报”和普通活动照片。

## 这场活动暴露出的结构缺口

| iEvent 结构 | 当前 ota-log 表达 | 结果 |
|---|---|---|
| 开场 `10:45`、开演 `11:00` | 单个 `event_time` | 必须丢一个时间 |
| 预售/当日两个票种、饮料费、币种 | 单个 `ticket_price REAL` | 只能保存代表价格 |
| location ID、名称、地址、行政区代码 | `city` + `venue` 文本 | 结构和稳定身份丢失 |
| 三个标签 | 单个 `event_type` 枚举 | 多标签语义丢失 |
| canonical URL + 官方微博 | 单个 `url` | 必须二选一或塞进详情 |
| event ID、revision、最后编辑时间 | 无外部来源表 | 无法增量同步或可靠去重 |
| 23 个 person ID、顺序、原名、头像 | `artists` + 无序 `event_artists` | 来源身份和展示信息丢失 |
| 竖版活动封面 | 通用 `photos` | 可存图片，但角色语义丢失 |
| 原始无结束时间、JSON-LD 推导 13:00 | 无结束时间字段 | 当前不会误存；未来导入需记录来源层级 |

这说明 `docs/data/activity-data-model-design.md` 中提出的 canonical activity metadata 与 user activity record 双层模型确有必要。最小可行扩展至少需要外部来源身份、场次时间、结构化地点、票种、出演关系元数据和多 URL；否则“导入成功”仍只是把公开活动压平为一条个人记录。

## 复现依据

- 当前 schema：`src/db/schema.ts`
- 当前 migration 版本：`src/db/migrations.ts`（`CURRENT_VERSION = 16`）
- 当前活动类型与输入：`src/types/models.ts`
- 当前创建写入：`app/events/create.tsx`、`src/repositories/EventRepository.ts`
- 当前导入分流与 draft：`app/events/compose.tsx`、`src/utils/parsedEventDraft.ts`
- 当前公告解析器：`src/utils/parseAnnouncement.ts`
- 当前公开艺人目录策略：`src/db/bundledArtistCatalog.ts`

## 一手来源

- [iEvent 活动详情页](https://ievent.life/event/10365)：所有活动字段、可见展示、JSON-LD 和服务端渲染数据。
- [iEvent 活动封面原图](https://image.ievent.life/cover/c9380e355453a8f6d7b7d97e3a94950c.jpg)：活动封面资产。
- [活动记录中的官方网站（微博）](https://weibo.com/7925328421/Ra2QY3Yzy)：仅用于确认 iEvent 存储的官方链接目标；本调查未据此补写 iEvent 页面不存在的字段。
