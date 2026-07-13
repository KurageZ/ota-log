# 重要日期数据结构设计

本文档记录“重要日期”功能的下一版数据结构设计。当前功能仍处于开发状态，本设计不要求兼容已经写入开发机的旧倒数日数据，也不讨论旧表迁移策略；落地时可以作为一个新的数据库版本直接调整 schema。

## 领域边界

产品里统一称为“重要日期”。用户创建的是一个带标题和日期的记录，不需要先选择“倒数日”或“纪念日”：

- 日期在未来：展示为倒数日，例如 `还有 12 天`。
- 日期是今天：展示为 `就是今天`。
- 日期在过去：展示为纪念/回忆性质的日期，例如 `已过去 120 天`。

因此，倒数日和纪念日是展示状态，不是持久化类型。数据库不再保存 `countdown` / `anniversary` 这类分类字段。

本功能避免把“重要日期”称为 event。数据库中 `events` 已表示活动；重要日期若需要引用活动，只通过外键关联现有 `events.id`。

## 核心表

### `important_dates`

保存用户拥有的一条重要日期。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `TEXT` | PK | UUID v4 |
| `title` | `TEXT` | NOT NULL | 用户可编辑标题 |
| `date` | `TEXT` | NOT NULL | `YYYY-MM-DD` |
| `source_kind` | `TEXT` | NOT NULL | `manual` / `linked_activity` / `first_cheki` / `first_live` |
| `linked_event_id` | `TEXT` | FK nullable | 关联活动时指向 `events.id`；产品文案显示为“关联活动” |
| `notes` | `TEXT` | nullable | 备注 |
| `show_on_calendar` | `INTEGER` | NOT NULL DEFAULT 1 | 是否在日历展示；开启后 base date 和已开启的纪念日一起显示 |
| `reminder_enabled` | `INTEGER` | NOT NULL DEFAULT 0 | 是否提醒；开启后对 base date 和已开启的纪念日统一生效 |
| `reminder_offset_days` | `INTEGER` | NOT NULL DEFAULT 0 | 提前 N 天提醒 |
| `reminder_time` | `TEXT` | NOT NULL DEFAULT `'09:00'` | 提醒时间，`HH:MM` |
| `created_at` | `TEXT` | NOT NULL | ISO 8601 |
| `updated_at` | `TEXT` | NOT NULL | ISO 8601 |

约束：

- `source_kind = 'linked_activity'` 时，`linked_event_id` 必须有值。
- `source_kind != 'linked_activity'` 时，`linked_event_id` 应为空。
- 不保存 `item_type`、`countdown`、`anniversary`。

建议索引：

- `idx_important_dates_date`：`(date ASC, updated_at DESC)`
- `idx_important_dates_linked_event`：`(linked_event_id)`
- `idx_important_dates_source`：`(source_kind)`

### `important_date_artists`

保存重要日期与艺人的多对多关系。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `important_date_id` | `TEXT` | FK NOT NULL | 指向 `important_dates.id` |
| `artist_id` | `TEXT` | FK NOT NULL | 指向 `artists.id` |

主键：`(important_date_id, artist_id)`。

关联活动来源的重要日期默认可以不复制活动艺人关系；如果产品需要展示活动艺人，应从关联活动读取，避免同一事实重复维护。手动、第一次拍立得和 first live 来源的重要日期可以直接维护艺人关系。

## 可选纪念日

重要日期的纪念日是可选能力，不是所有过去日期都自动拥有纪念日。没有开启纪念日的记录，只展示 base date 的相对天数。

### `important_date_anniversary_rules`

保存用户为某个重要日期配置的纪念日规则。规则存在且 `enabled = 1` 时，系统才生成派生纪念日；关闭后不显示在日历，不参与“下一个纪念日”提示，也不会随父级提醒一起提醒。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `TEXT` | PK | UUID v4 |
| `important_date_id` | `TEXT` | FK NOT NULL | 指向 `important_dates.id` |
| `anniversary_kind` | `TEXT` | NOT NULL | `day` / `month` / `year` |
| `anniversary_value` | `INTEGER` | NOT NULL | 大于 0 |
| `label` | `TEXT` | nullable | 用户自定义文案；为空时按规则生成 |
| `enabled` | `INTEGER` | NOT NULL DEFAULT 1 | 是否启用此规则 |
| `created_at` | `TEXT` | NOT NULL | ISO 8601 |
| `updated_at` | `TEXT` | NOT NULL | ISO 8601 |

唯一约束：`(important_date_id, anniversary_kind, anniversary_value)`。

示例：

- `day + 100`：第 100 天。
- `year + 1`：1 年。
- `year + 2`：2 年。
- `month + 1`：第 1 个月。

规则只描述“如何生成纪念日”和“该纪念日是否启用”。是否显示到日历由父级重要日期的 `show_on_calendar` 控制；如果父级关闭日历显示，base date 和所有已开启纪念日都不显示到日历。是否提醒由父级重要日期的 `reminder_enabled` 控制；如果父级关闭提醒，base date 和所有已开启纪念日都不提醒。

## 提醒

提醒和显示在日历都是重要日期级别的控制项。它们不下放到单个纪念日，因为当前产品更需要简单一致的批量行为：用户开启某个重要日期的日历展示或提醒后，它和它下面所有已开启的纪念日一起生效。

控制规则：

- 重要日期的 `show_on_calendar` 控制 base date 和所有已开启纪念日是否显示到日历。
- 重要日期的 `reminder_enabled` 控制 base date 和所有已开启纪念日是否提醒。
- 纪念日规则的 `enabled` 是纪念日唯一的用户控制项；关闭时不显示在日历、不出现在“下一个纪念日”提示、也不会随父级提醒一起提醒。
- `show_on_calendar` 和 `reminder_enabled` 仍然分开存储，避免未来接入系统通知时把“可见性”和“通知能力”绑死。

当前 App 还没有接入系统通知提醒，因此 UI 可以暂时不展示提醒开关；schema 先保留 `reminder_enabled`、`reminder_offset_days`、`reminder_time`，作为未来通知能力的持久化基础。

后续如果要接入系统通知，可继续保留调度状态表：

### `scheduled_reminder_state`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `TEXT` | PK | UUID v4 |
| `target_kind` | `TEXT` | NOT NULL | `important_date` / `important_date_anniversary` |
| `target_id` | `TEXT` | NOT NULL | 指向重要日期或已开启纪念日规则 |
| `notification_id` | `TEXT` | NOT NULL | 系统通知 ID |
| `scheduled_for` | `TEXT` | NOT NULL | 实际计划触发时间 |
| `updated_at` | `TEXT` | NOT NULL | ISO 8601 |

## 派生模型

Repository 对外不应直接暴露“倒数日类型”或“纪念日类型”，而是暴露派生字段：

```ts
type ImportantDateDisplayState = 'future' | 'today' | 'past';

interface HydratedImportantDate {
  importantDate: ImportantDate;
  artists: Artist[];
  anniversaryRules: ImportantDateAnniversaryRule[];
  displayState: ImportantDateDisplayState;
  relativeText: string;
  nextAnniversary: ImportantDateAnniversaryOccurrence | null;
}
```

`relativeText` 规则：

- `future`：`还有 N 天`
- `today`：`就是今天`
- `past`：`已过去 N 天`

日历使用统一 occurrence：

```ts
type ImportantDateCalendarOccurrenceKind = 'important_date' | 'important_date_anniversary';

interface ImportantDateCalendarOccurrence {
  id: string;
  kind: ImportantDateCalendarOccurrenceKind;
  date: string;
  title: string;
  importantDateId: string;
  anniversaryRuleId: string | null;
  anniversaryLabel: string | null;
  relativeText: string;
  artists: Artist[];
}
```

## 默认行为

- 新建重要日期时不要求用户选择“倒数日 / 纪念日”。
- 新建普通重要日期时，不自动开启纪念日规则。
- 通过“第一次拍立得”“first live”等来源创建时，可以在 UI 上推荐纪念日，但仍应允许用户不开启。
- 已过去的重要日期仍可显示在日历；提醒能力先保留在数据结构中，当前 UI 暂不展示。
- 关联活动的重要日期应保持和活动的关系清晰：产品显示为“关联活动”，数据上通过 `linked_event_id` 指向 `events.id`。

## 与现有实现的差异

下一版实现应移除当前 `date_items.item_type` 的核心地位，改为以 `important_dates.date` 的相对时间派生展示状态。

建议命名替换：

- `date_items` -> `important_dates`
- `date_item_artists` -> `important_date_artists`
- `date_item_milestone_settings` -> `important_date_anniversary_rules`
- 提醒字段只保留在 `important_dates`；纪念日只控制 `enabled`，不需要单独提醒字段，也不需要为当前需求保留独立 `reminder_rules` 表。

由于该功能仍处于开发阶段，落地时可以直接调整 v16 schema，不需要为旧 `date_items` 表设计数据迁移。
