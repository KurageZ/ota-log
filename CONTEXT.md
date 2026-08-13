# ota_log Context

This glossary defines product-domain language for ota_log. It keeps overloaded user-facing terms precise before they become database tables, screens, or settings.

## Language

**Artist**:
A local record for an activity participant. An Artist may be identified as a Person or Group, or may have no Artist Type and retain only generic capabilities and direct associations.
_Avoid_: Performer type, mandatory person, mandatory group

**Artist Type**:
The optional classification of an Artist as either Person or Group. An unset type is absence of classification, not a third artist type; setting a type enables type-specific membership behavior and indirect association queries.
_Avoid_: Artist role, unknown artist type, unclassified artist type

**Person**:
An Artist Type for an individual who may have one or more dated Group Memberships, including concurrent or repeated memberships.
_Avoid_: Member, solo artist

**Group**:
An Artist Type for an Artist that may receive Person members. A Group does not itself participate as a member of another Group.
_Avoid_: Parent artist, folder, organization hierarchy

**Basic Affiliation**:
An undated association between two Artists whose Artist Types are both unset. Each member may have at most one parent, each parent may have many members, and acyclic nesting is allowed; it does not classify either Artist, interact with typed Artists, or participate in indirect association queries.
_Avoid_: Group Membership, inferred group, inferred person

**Group Membership**:
A dated association between one explicitly typed Person and one explicitly typed Group. Its optional start and end dates form an inclusive interval; the same Person may have concurrent memberships in different Groups and multiple non-overlapping membership periods in the same Group.
_Avoid_: Parent artist, permanent group, artist hierarchy

**Current Group Membership**:
A Group Membership whose inclusive date interval contains the device-local current date. It is a derived state rather than a stored membership type.
_Avoid_: Primary group, active flag, upcoming membership

**Artist Activity Association**:
The association used when querying Activities for an Artist. A direct Activity association always applies; a Person also receives an indirect association from a Group only when an Activity Session date range overlaps that Person's formal Group Membership. Basic Affiliations never create indirect associations.
_Avoid_: Permanent parent inheritance, Basic Affiliation activity match

**Artist Cheki Association**:
The direct association between a Cheki Record and one Artist. Group Memberships and Basic Affiliations never cause Cheki Records, quantities, or spending to be inherited by another Artist.
_Avoid_: Group cheki inheritance, membership-based cheki attribution

**Activity**:
A user-owned local record for viewing event information and later review. It is intentionally a useful, lossy representation rather than a canonical mirror of the real-world event. Every Activity has at least one dated Activity Session; manually created and imported activities share the same lifecycle, and an imported activity does not continue following its external source after creation.
_Avoid_: Canonical activity metadata, public activity record, user activity record

**Activity Import**:
A one-time creation method that uses an external source to prefill a new Activity. It does not establish an ongoing synchronization relationship with that source.
_Avoid_: Activity sync, source subscription

**Activity Session**:
A user-chosen dated subdivision within an Activity. It may represent a day, daytime/evening show, stage, venue, or another division useful for viewing and review. Users may instead record those parts as separate Activities; an undated Session is not valid.
_Avoid_: Optional activity date, placeholder session, timetable entry

**Activity Timetable**:
The flat ordered schedule within an Activity Session. Each entry preserves content text, an optional local Artist association, a time range, and notes; stages or areas do not create another persisted level.
_Avoid_: Activity Session, timetable image

**Activity Actual Expense**:
The optional, user-editable amount recorded as the Activity's entry cost. Manual records normally use the amount actually paid; imports may prefill the lowest reliably calculated admission cost. It excludes cheki, merchandise, transport, and accommodation.
_Avoid_: Ticket price, published price, total activity expense

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
One identifiable physical cheki within a Cheki Record. It owns that cheki's non-negative integer unit price and controlled Spec, and anchors its optional front and back images so the two sides remain associated.
_Avoid_: Cheki image, front photo record, back photo record

**Favorite Cheki Item**:
A Cheki Item explicitly marked with a heart by the user. Favorite status belongs to the physical cheki, so its front and back images share the same status.
_Avoid_: Favorite Cheki Record, favorite image

**Cheki Image**:
One front or back image associated with a Cheki Item. Both sides use the presentation ratio owned by their shared Cheki Item.
_Avoid_: Cheki Item, edited source image

**Cheki Item Spec**:
The single controlled physical format of one Cheki Item, combining its size family and orientation. Image presentation ratio is derived from the Spec and applies to both sides without changing the source files.
_Avoid_: Cheki Item Presentation, arbitrary aspect ratio, per-side spec, spec tag

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
