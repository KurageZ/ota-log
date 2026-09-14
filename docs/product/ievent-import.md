# iEvent 轻量活动导入规格

状态：已实现；Migration v18 多场次适配完成（2026-08-06）

范围：从 `ievent.life` 活动详情页和其子活动生成一次性、可编辑的活动草稿

历史调查使用活动 10365 作为样本；原调查文件未保存在仓库中。样本预期见本文 Further Notes，当前解析行为以实现和回归测试为准。

## Problem Statement

用户目前可以从微博链接或公告正文预填活动，但直接输入 iEvent 活动详情链接时，现有公告解析器无法识别任何有效字段，因此不会生成活动草稿。

即使先把 iEvent 页面可见文本交给公告解析器，也会出现明显错误：开场时间被当作开演时间、场地名称被截断、出演者全部丢失、多票种与附加费用被压成不准确的单一价格。

iEvent 页面本身包含比可见文本更完整的结构化活动数据，包括标题、日期、开场与开演时间、结构化地点、票种、附加费用、标签、官方链接、封面和出演对象。用户需要一个轻量、一次性的专用导入器，将这些数据尽可能准确地投影到当前活动模型，同时沿用已有微博导入、草稿确认、未知艺人处理和图片保存体验。

本功能不试图解决外部活动同步或公开活动事实的完整建模。当前活动模型只保存 Activity → Session 两层、活动级单一入场支出、文本地点、单一 URL 和扁平时间表；无法结构化保存的有用信息进入活动详情或时间表备注。

## Solution

当用户在现有活动导入入口输入合法的 iEvent 活动详情 URL 时，应用识别该来源并下载活动页面 HTML。专用解析器优先读取页面内嵌的原始活动对象；原始对象缺失时，使用 JSON-LD 白名单字段降级；Open Graph 仅作为标题和封面的最后兜底。

解析器先产生与数据库无关的 iEvent 活动数据，再将其投影为现有活动草稿。投影结果继续进入现有的艺人匹配、未知艺人确认、活动表单和保存流程。解析器不直接写数据库。

活动或子活动的日期、开场、开演和结束时间投影到 Session。票价按最低有效基础票价加明确强制附加费用，直接预填为可编辑的 `actual_expense`。来源 URL 保存 iEvent 活动页；官方链接以及当前 schema 无法表达的其他信息进入固定格式的活动详情。

导入是一次性操作。系统不保存外部同步状态、不检查重复导入，也不在未来自动刷新已经创建的活动。每次导入都可以创建一条新的本地活动记录。

## Migration v18 适配原则

- 导入目标是方便用户查看活动信息和回顾，不追求还原 iEvent 或现实活动的全部层级。
- 普通页面创建一个默认 Session；父活动页面中的子活动（参考 `https://ievent.life/event/10022`）可各自投影为 Session。结果始终是可编辑草稿，用户也可以自行拆成多个 Activity。
- 不为多场馆、多舞台继续增加模型层级。时间表直接写入对应 Session，每条只保留演出内容文本、开始 / 结束时间和备注。
- 演出内容始终保留原始文本。可匹配本地艺人时沿用现有匹配；未知艺人不自动创建，继续弹出确认框，只有用户选择后才添加；未关联内容仍正常显示。
- 最低可靠入场成本直接预填 `actual_expense`，不显示额外提示；用户可在活动表单中修改。
- 来源详情继续保留。时间表原图作为普通活动资料图导入，不以图片替代扁平时间表。
- 某个子活动详情抓取失败时，用父页摘要创建对应 Session，继续导入其他内容，并报告“部分内容未完整导入”。
- 不读取或投影 iEvent 的取消状态。

实现使用 iEvent 当前公开页面的实际字段：父活动读取 `props.childEvent`，子活动读取 `props.timetable[].property_addition.sections`，原始时间表图片读取 `props.timetable[].value.value`。这些来源字段只存在于提取层，不作为本地持久化契约。

## User Stories

1. As an iEvent user, I want to paste an iEvent activity URL into the existing activity import entry, so that I can create a local activity without manually copying every field.
2. As an ota-log user, I want iEvent import to use the same entry and general flow as Weibo import, so that importing from different sources feels consistent.
3. As an ota-log user, I want the imported title to match the iEvent activity title, so that I can recognize the activity in lists and calendars.
4. As an ota-log user, I want the imported date to preserve the source activity date, so that the activity appears on the correct day.
5. As an attendee, I want `event_time` to represent the performance start time when available, so that the time shown in ota-log reflects when the show begins.
6. As an attendee, I want the importer to fall back to another reliable activity start time when the explicit performance start is missing, so that useful time information is not unnecessarily discarded.
7. As an attendee, I want the opening time retained in activity details, so that I can plan arrival even though the current database only has one structured event time.
8. As a ticket buyer, I want the stored ticket price to represent the minimum actual amount required to enter, so that spending estimates do not omit mandatory charges.
9. As a ticket buyer, I want explicit mandatory drink charges included in the stored price, so that a listed base price does not understate the real minimum spend.
10. As a ticket buyer, I want the original ticket types and price breakdown retained in details, so that the single stored price does not erase useful purchasing information.
11. As a user importing event 10365, I want the stored ticket price to be ¥93, so that the ¥78 advance ticket and mandatory ¥15 drink charge are both represented.
12. As an ota-log user, I want the full venue name preserved, so that a venue such as “世界树剧场一号馆” is not truncated.
13. As an ota-log user, I want the city derived only from reliable source data, address text, or a known administrative code, so that the importer does not guess incorrectly.
14. As an ota-log user, I want city left empty when it cannot be determined reliably, so that I can correct it in the existing form.
15. As an ota-log user, I want the iEvent source page saved as the activity URL, so that I can return to the original imported record.
16. As an ota-log user, I want the official website or Weibo link retained in activity details, so that saving the source URL does not make the official link disappear.
17. As an ota-log user, I want iEvent tags retained in activity details, so that multi-label source information remains searchable even though the database has one event type.
18. As an ota-log user, I want the source description retained without page navigation and login noise, so that activity details remain readable.
19. As an ota-log user, I want existing local artists matched through the current artist matching rules, so that imports reuse my artist records.
20. As an ota-log user, I want unfamiliar performers handled by the existing unknown-artist confirmation feature, so that an import cannot silently create unwanted artists.
21. As an ota-log user, I want ambiguous artist matches left for manual resolution, so that similarly named artists are not incorrectly merged.
22. As an ota-log user, I want source performer names trimmed and normalized before matching, so that source formatting artifacts do not create duplicate artists.
23. As an ota-log user, I want the event cover downloaded automatically, so that the newly created activity includes its poster.
24. As an ota-log user, I want a cover download failure not to block activity creation, so that temporary image problems do not discard parsed activity data.
25. As a local-first user, I want downloaded covers stored through the existing permanent local media workflow, so that the activity does not depend on a temporary remote URL.
26. As an ota-log user, I want the populated draft shown in the existing activity form before saving, so that I can correct any imported value.
27. As an ota-log user, I want the importer not to set activity status, so that status continues to follow the existing form behavior.
28. As an ota-log user, I want the importer not to infer a single event type from iEvent tags, so that multi-label source data is not converted into a misleading enum.
29. As an ota-log user, I want each import attempt to be independent, so that importing the same source URL again creates another activity instead of being blocked.
30. As an ota-log user, I want an iEvent page with missing private application data to fall back to standard JSON-LD fields, so that minor site implementation changes do not immediately break importing.
31. As an ota-log user, I want lower-priority metadata to fill only missing fields, so that JSON-LD or Open Graph cannot overwrite richer original activity data.
32. As an ota-log user, I want automatically inferred JSON-LD end times ignored, so that generated search metadata is not treated as an explicit source fact.
33. As an ota-log user, I want partial but sufficiently identified activities to produce editable drafts, so that a missing optional source field does not force full manual entry.
34. As an ota-log user, I want unusable or malformed pages to enter the same recovery flow as failed Weibo imports, so that I can retry, paste text, or create manually.
35. As an ota-log user, I do not want additional warning UI for iEvent-specific fallback decisions, so that the import flow remains lightweight.
36. As a maintainer, I want the iEvent scraper isolated from the generic announcement parser, so that source-specific HTML changes do not destabilize normal text parsing.
37. As a maintainer, I want the iEvent parser to return data through the existing draft boundary, so that artist matching and activity creation remain shared.
38. As a maintainer, I want fixture-based tests that do not access the live iEvent website, so that tests remain deterministic and respectful of the external service.
39. As a maintainer, I want parser limits and strict URL validation, so that arbitrary URLs or unexpectedly large pages cannot enter the import path.
40. As a maintainer, I want no database migration for this feature, so that the importer can ship independently of the longer-term canonical activity model.

## Implementation Decisions

- Add an iEvent source adapter alongside the existing Weibo source handling. It recognizes only HTTPS activity detail URLs on `ievent.life` with a numeric activity ID.
- Reuse the existing compose screen, loading state, failure recovery, draft handoff, artist matching, unknown-artist confirmation, activity form, media handling and repository writes.
- Keep the generic announcement parser unchanged for iEvent. The source adapter returns structured activity data rather than converting the entire rendered page into announcement text.
- Separate source extraction from projection into the current activity draft. The extraction model retains source-specific concepts such as opening time, performance start, ticket types, location metadata, tags, official URL, cover and ordered performers.
- The highest-priority source is the original activity object embedded in the server-rendered page data.
- JSON-LD is the first fallback. Only title, activity start date/time, location, cover, performers and canonical URL are accepted from this layer.
- Open Graph is the last fallback and may supply only title and cover.
- Lower-priority layers fill missing values only. They never overwrite a value obtained from a higher-priority layer.
- JSON-LD `endDate` is always ignored. The reference activity demonstrates that iEvent may generate an end time even when the original activity has no explicit ending time.
- Avoid executing page scripts or evaluating page-provided JavaScript. Extract serialized data as text and parse only valid JSON structures.
- Apply request timeout, response-status validation, content-type tolerance suitable for server-rendered HTML, a bounded response size and redirect validation that remains on the expected iEvent domain.
- Treat the import as successful only when the fallback data contains enough identity to form a meaningful editable draft. The required fallback identity is title, date and location.
- Do not display additional iEvent-specific warnings for ordinary field fallback. A child-page fetch failure is the exception: continue with the parent summary and show one partial-import warning.
- Set Session `start_time` from the original performance start time when present.
- If the original performance start is absent, use the JSON-LD activity start time.
- If neither is present, use the original opening time.
- If all time sources are absent, leave Session `start_time` empty.
- Retain both opening and performance-start labels in the generated details whenever they are available. When only opening time exists, describe it as opening time rather than claiming that the source supplied a performance start.
- Calculate `actual_expense` as the minimum valid base ticket price plus mandatory per-entry charges explicitly associated with that option, and prefill it without a separate warning.
- Treat source language such as `+1D`, `另加` and `入场需` as a mandatory addition only when the syntax provides an amount and clearly expresses an additional entry cost.
- Do not include optional upgrades, VIP premiums, merchandise, benefits without a price, or ambiguous amounts in the minimum actual spend.
- Preserve the complete available ticket breakdown in generated details even though only one numeric price is stored.
- For the reference activity, project the ¥78 advance ticket plus the mandatory ¥15 drink charge to `actual_expense = 93`.
- Save the normalized iEvent activity URL in the existing activity URL field.
- Save the official URL in generated details because the current activity model has only one URL field.
- Generate details from known fields in a stable, readable order: source description, opening and performance times, ticket breakdown, mandatory additions, minimum actual spend, venue address, source tags and official link.
- Do not save raw page text. Exclude login prompts, editing controls, editor identity, participant users, footer content and other page chrome.
- Preserve the complete venue name.
- Derive city from explicit source text, reliable address text or a local administrative-code mapping.
- Do not make a second request to the location detail page solely to obtain city.
- Leave city empty when it cannot be determined reliably.
- Convert source performers into the existing artist-mention input and preserve source order until the existing matching and confirmation step.
- Trim leading and trailing whitespace from source performer names before matching.
- Reuse all existing name normalization, exact matching, alias matching, ambiguous suggestion and unknown-artist creation behavior.
- Never create an Artist automatically. Unknown names remain text unless the user explicitly chooses creation or matching in the existing confirmation dialog.
- Do not persist iEvent person IDs, source performer order, source aliases, remote artist covers or source matching evidence because the schema has no fields for them.
- Automatically download the event cover using the existing import media behavior and permanent local-file rules.
- Treat cover download failure as non-blocking, consistent with the existing Weibo import flow.
- Do not store the remote cover URL as a photo URI.
- Do not set activity status.
- Ignore external cancellation status.
- Do not set or infer activity type. Source tags appear only in details.
- Do not check whether the source URL was imported previously. Every confirmed import may create a new activity.
- Use the Migration v18 Activity / Session / flat timetable persistence model; the importer adaptation itself introduces no additional migration.
- Do not create an external-source synchronization contract. The resulting activity is an ordinary local activity after creation.

## Testing Decisions

- Use one primary high-level seam: given a validated iEvent URL and an injected HTML response, the source adapter returns the complete import result consumed by the existing draft pipeline.
- Prefer testing that seam over testing internal HTML helpers individually. Tests should assert user-visible projected values and recovery outcomes, not exact regular expressions, script indexes or internal parser functions.
- Use checked-in, minimized HTML fixtures derived from representative iEvent page structures. Fixtures must contain only the page fragments required to exercise behavior and must not require live network access.
- Add a reference regression fixture for activity 10365 covering the exact expected title, date, start time, city, full venue, minimum actual price, details content, source URL, cover URL and 23 ordered performer names.
- Test extraction from a complete embedded original activity object.
- Test JSON-LD fallback when the original activity object is unavailable.
- Test Open Graph title and cover fallback when higher-priority fields are missing.
- Test that lower-priority values fill missing fields but never overwrite conflicting higher-priority values.
- Test that JSON-LD `endDate` is ignored.
- Test time precedence: original performance start, JSON-LD start, original opening time, then empty.
- Test that using opening time as the final fallback still labels it correctly in generated details.
- Test minimum actual spend across multiple ticket types.
- Test explicit mandatory drink-charge addition, including the reference calculation of ¥93.
- Test that optional or ambiguous charges are excluded from the stored minimum price while remaining available in details when appropriate.
- Test city resolution from a known administrative code.
- Test city resolution from explicit address text.
- Test that an unknown city remains empty and does not trigger a second network request.
- Test full venue preservation without the generic announcement parser’s venue cleanup.
- Test source performer trimming, ordering and conversion into the existing artist-matching seam.
- Rely on existing artist-matching and parsed-draft tests for exact matches, ambiguous suggestions, unknown-artist creation defaults and candidate confirmation behavior.
- Test a parent activity with child activities, including projection to multiple Sessions and retention of parent/child details.
- Test flat timetable projection, unmatched performer text, optional confirmed Artist association and timetable image import as a normal activity photo.
- Test that one failed child fetch keeps its summary Session, imports successful siblings and produces a partial-import warning.
- Test that external cancellation status is ignored.
- Test that the source URL is stored in the draft while the official URL is written to details.
- Test deterministic details formatting and exclusion of page chrome.
- Test successful parsing with no cover.
- Test that cover download failure does not discard an otherwise valid activity draft or prevent creation through the shared import flow.
- Test invalid hostnames, non-HTTPS URLs, non-numeric activity paths, redirects away from the expected domain, HTTP failures, timeouts, malformed HTML, invalid JSON and oversized responses.
- Test that insufficient fallback identity enters the same failure outcome used by the existing import flow.
- Run the TypeScript compiler and the complete Jest baseline after implementation because the feature touches shared activity draft types and compose flow.

## Out of Scope

- Database schema changes or migrations.
- Canonical public activity metadata separate from the user’s activity record.
- Persistent iEvent activity IDs, location IDs or person IDs.
- Synchronizing an imported activity with future iEvent edits.
- Field-level source tracking or user override tracking.
- Duplicate detection or duplicate prevention.
- Updating an existing activity from the same source URL.
- Persisted source parent/child relationships beyond their one-time projection to Activity / Session.
- Stage, area or venue-group hierarchy beneath Session.
- Structured ticket types, currencies, eligibility conditions or mandatory-fee tables.
- Structured locations, addresses or administrative regions.
- Multiple activity URLs or typed links.
- Structured activity tags.
- Persisted performer ordering, roles, source aliases or source covers.
- Importing iEvent setlists, Repo entries, participants or editor history.
- Trusting or persisting JSON-LD inferred end times.
- Adding a dedicated iEvent preview interface or ordinary field-fallback warnings; only partial child-fetch failure adds a warning to the shared flow.
- Changing the existing activity-status or activity-type form behavior.
- Fetching location detail pages as a secondary request.
- Live-network tests against iEvent.
- General-purpose arbitrary website scraping.
- Changes to the existing Weibo parsing contract except small refactoring needed to share the current draft handoff.

## Further Notes

- The reference activity is `https://ievent.life/event/10365`.
- The parent/child reference activity is `https://ievent.life/event/10022`.
- Its expected projected values are title `YGG IDOL Fes -麻乐栖&猫猫虫生日SP-`, date `2026-07-25`, event time `11:00`, city `上海`, venue `世界树剧场一号馆`, minimum actual price `93`, and source URL equal to the iEvent activity page.
- Its source contains an advance ticket of ¥78, a same-day ticket of ¥98 and an explicit additional 1D charge of ¥15.
- Its source contains 23 performer objects. The source data includes at least one leading-whitespace name that must be trimmed before entering existing artist matching.
- Its original activity object does not contain an ending time, while JSON-LD exposes `13:00`. This is the motivating example for ignoring JSON-LD `endDate`.
- The current activity schema remains intentionally lossy for this feature. Activity / Session granularity belongs to the user; canonical metadata, structured places, ticket types, timetable grouping and external-source synchronization remain out of scope.

## 导入入口文案

活动解析页统一使用「公告链接」和通用预填文案。支持的链接按格式自动进入对应解析流程；界面不展示来源品牌，也不额外宣传某个外部来源。结构化链接解析结果继续进入既有草稿、未知艺人确认和活动表单流程。
