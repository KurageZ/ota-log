# ota_log Context

This glossary defines product-domain language for ota_log. It keeps overloaded user-facing terms precise before they become database tables, screens, or settings.

## Language

**Activity Countdown**:
A countdown display derived from an existing activity in the `events` table. Its title and target date follow the source activity instead of becoming an independent user-owned important date.
_Avoid_: Independent event countdown, copied event countdown

**Important Date**:
A user-owned important date with a title and one calendar date. It is displayed as a countdown when the date is in the future, as today when it is the current date, and as a remembered date when it is in the past.
_Avoid_: Date Item, countdown record, anniversary record, important event

**Important Date Source**:
The origin of an important date, such as manual entry, a linked activity, first cheki, or first live. The source explains how the date was created; it does not decide whether the date is a countdown or a remembered date.
_Avoid_: Important date type, countdown type, anniversary type

**Important Date Display State**:
A derived UI state computed from the important date's date relative to today: future, today, or past. This is not stored as a database classification.
_Avoid_: Persisted countdown or anniversary type

**Important Date Anniversary**:
An optional derived occurrence from an important date, such as the 100th day, first year, or second year after the base date. It can be enabled or disabled independently, while calendar visibility and reminders are controlled by the parent important date.
_Avoid_: Separate anniversary record, mandatory anniversary setting, milestone
