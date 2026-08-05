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

**Cheki Record**:
A user-owned record of one cheki entry batch, including its optional artist and activity, record date, total quantity, derived total price, and notes. Price belongs to each Cheki Item; a blank item price is stored as zero, and the Record total is derived from its Items. Having images is optional and does not create a different record type.
_Avoid_: Photo cheki record, manual cheki entry, no-photo record

**Cheki Item**:
One identifiable physical cheki within a Cheki Record. It owns that cheki's non-negative integer unit price and anchors its optional front and back images so the two sides remain associated.
_Avoid_: Cheki image, front photo record, back photo record

**Favorite Cheki Item**:
A Cheki Item explicitly marked with a heart by the user. Favorite status belongs to the physical cheki, so its front and back images share the same status.
_Avoid_: Favorite Cheki Record, favorite image

**Cheki Image**:
One front or back image associated with a Cheki Item. Both sides use the presentation ratio owned by their shared Cheki Item.
_Avoid_: Cheki Item, edited source image

**Cheki Item Presentation**:
The display width-to-height ratio applied to both images of one Cheki Item, defaulting to the three-inch cheki ratio. It does not change the source image files.
_Avoid_: Per-side image ratio, physical cheki size, destructive crop

**Cheki Record Date**:
The calendar date assigned to a Cheki Record as a whole. It is not the image capture time or image import time.
_Avoid_: Cheki image date, upload date

**Cheki Item Unit Price**:
The non-negative integer whole-yuan price of one Cheki Item. If the user leaves it blank, the stored value is zero. A Cheki Record's total price is derived by summing its Item unit prices.
_Avoid_: Cheki Record source price, derived unit price

**Cheki Record Note**:
A note about an entire Cheki Record batch.
_Avoid_: Cheki Item note, image note

**Cheki Item Note**:
A note about one identifiable physical cheki within a Cheki Record.
_Avoid_: Cheki Record note, image note
