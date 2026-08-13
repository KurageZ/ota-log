import { SQLiteDatabase } from 'expo-sqlite';
import {
  Artist,
  CreateDateItemInput,
  DateItem,
  DateItemAnniversaryRule,
  DateItemSourceKind,
  UpdateDateItemInput,
} from '../types/models';
import { generateId } from '../utils/uuid';
import { toISODate, toISODateTime } from '../utils/date';
import {
  addDateItemAnniversaryDate,
  formatDateItemAnniversaryLabel,
  formatDateItemAnniversaryRuleLabel,
  getDateItemRelativeCopy,
  getLocalDayDifference,
} from '../utils/dateItems';

export interface DateItemAnniversaryOccurrence {
  id: string;
  dateItemId: string;
  dateItemTitle: string;
  date: string;
  label: string;
  title: string;
  rule: DateItemAnniversaryRule;
  relativeText: string;
}

export interface HydratedDateItem {
  item: DateItem;
  artists: Artist[];
  anniversaries: DateItemAnniversaryRule[];
  relativeText: string;
  relativeState: 'future' | 'today' | 'past';
  nextAnniversary: DateItemAnniversaryOccurrence | null;
}

export interface DateItemCalendarOccurrence {
  id: string;
  kind: 'important_date' | 'important_date_anniversary';
  date: string;
  title: string;
  dateItemId: string;
  anniversaryRuleId: string | null;
  anniversaryLabel: string | null;
  relativeText: string;
  artists: Artist[];
}

const DEFAULT_ANNIVERSARIES = [
  { kind: 'day' as const, value: 100 },
  { kind: 'month' as const, value: 1 },
  { kind: 'year' as const, value: 1 },
];

function toDbBool(value: boolean | undefined, fallback = true): number {
  return (value ?? fallback) ? 1 : 0;
}

function uniqueArtistIds(artistIds: string[] | undefined): string[] {
  return Array.from(new Set((artistIds ?? []).filter(Boolean)));
}

function shouldHaveDefaultAnniversaries(sourceKind: DateItemSourceKind, date: string, todayISODate: string): boolean {
  return sourceKind === 'first_cheki'
    || sourceKind === 'first_live'
    || date < todayISODate;
}

export class DateItemRepository {
  constructor(private db: SQLiteDatabase) {}

  async findAll(todayISODate = toISODate(new Date())): Promise<HydratedDateItem[]> {
    const items = await this.db.getAllAsync<DateItem>(
      `SELECT *
       FROM important_dates
       ORDER BY date ASC, updated_at DESC`
    );
    const hydrated = await Promise.all(items.map((item) => this.hydrate(item, todayISODate)));
    return hydrated.sort((a, b) => {
      const aDiff = a.item.date.localeCompare(todayISODate);
      const bDiff = b.item.date.localeCompare(todayISODate);
      const aFuture = aDiff >= 0;
      const bFuture = bDiff >= 0;
      if (aFuture !== bFuture) return aFuture ? -1 : 1;
      return aFuture
        ? a.item.date.localeCompare(b.item.date)
        : b.item.date.localeCompare(a.item.date);
    });
  }

  async findById(id: string, todayISODate = toISODate(new Date())): Promise<HydratedDateItem | null> {
    const item = await this.db.getFirstAsync<DateItem>('SELECT * FROM important_dates WHERE id = ?', [id]);
    return item ? this.hydrate(item, todayISODate) : null;
  }

  async create(input: CreateDateItemInput): Promise<DateItem> {
    const now = toISODateTime();
    const item: DateItem = {
      id: generateId(),
      title: input.title.trim(),
      date: input.date,
      source_kind: input.source_kind,
      linked_event_id: input.linked_event_id ?? null,
      notes: input.notes?.trim() ? input.notes.trim() : null,
      show_on_calendar: toDbBool(input.show_on_calendar),
      reminder_enabled: toDbBool(input.reminder_enabled, false),
      reminder_offset_days: input.reminder_offset_days ?? 0,
      reminder_time: input.reminder_time ?? '09:00',
      created_at: now,
      updated_at: now,
    };

    await this.db.runAsync(
      `INSERT INTO important_dates
         (id, title, date, source_kind, linked_event_id, notes, show_on_calendar, reminder_enabled, reminder_offset_days, reminder_time, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.title,
        item.date,
        item.source_kind,
        item.linked_event_id,
        item.notes,
        item.show_on_calendar,
        item.reminder_enabled,
        item.reminder_offset_days,
        item.reminder_time,
        item.created_at,
        item.updated_at,
      ]
    );
    await this.replaceArtistLinks(item.id, item.linked_event_id ? [] : input.artistIds);
    if (shouldHaveDefaultAnniversaries(item.source_kind, item.date, toISODate(new Date()))) {
      await this.ensureDefaultAnniversaries(item.id, now);
    }
    return item;
  }

  async update(id: string, input: UpdateDateItemInput): Promise<void> {
    const fields: string[] = [];
    const values: Array<string | number | null> = [];

    if ('title' in input && input.title != null) {
      fields.push('title = ?');
      values.push(input.title.trim());
    }
    if ('date' in input && input.date != null) {
      fields.push('date = ?');
      values.push(input.date);
    }
    if ('source_kind' in input && input.source_kind != null) {
      fields.push('source_kind = ?');
      values.push(input.source_kind);
    }
    if ('linked_event_id' in input) {
      fields.push('linked_event_id = ?');
      values.push(input.linked_event_id ?? null);
    }
    if ('notes' in input) {
      fields.push('notes = ?');
      values.push(input.notes?.trim() ? input.notes.trim() : null);
    }
    if ('show_on_calendar' in input) {
      fields.push('show_on_calendar = ?');
      values.push(toDbBool(input.show_on_calendar));
    }
    if ('reminder_enabled' in input) {
      fields.push('reminder_enabled = ?');
      values.push(toDbBool(input.reminder_enabled, false));
    }
    if ('reminder_offset_days' in input && input.reminder_offset_days != null) {
      fields.push('reminder_offset_days = ?');
      values.push(input.reminder_offset_days);
    }
    if ('reminder_time' in input && input.reminder_time != null) {
      fields.push('reminder_time = ?');
      values.push(input.reminder_time);
    }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(toISODateTime(), id);
      await this.db.runAsync(`UPDATE important_dates SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    if ('artistIds' in input) {
      const item = await this.db.getFirstAsync<DateItem>('SELECT * FROM important_dates WHERE id = ?', [id]);
      await this.replaceArtistLinks(id, item?.linked_event_id ? [] : input.artistIds);
    }

    const item = await this.db.getFirstAsync<DateItem>('SELECT * FROM important_dates WHERE id = ?', [id]);
    if (item && shouldHaveDefaultAnniversaries(item.source_kind, item.date, toISODate(new Date()))) {
      await this.ensureDefaultAnniversaries(id, toISODateTime());
    }
  }

  async delete(id: string): Promise<void> {
    const anniversaryIds = await this.db.getAllAsync<{ id: string }>(
      'SELECT id FROM important_date_anniversary_rules WHERE important_date_id = ?',
      [id]
    );
    await this.db.runAsync(
      "DELETE FROM scheduled_reminder_state WHERE target_kind = 'important_date' AND target_id = ?",
      [id]
    );
    for (const anniversary of anniversaryIds) {
      await this.db.runAsync(
        "DELETE FROM scheduled_reminder_state WHERE target_kind = 'important_date_anniversary' AND target_id = ?",
        [anniversary.id]
      );
    }
    await this.db.runAsync('DELETE FROM important_dates WHERE id = ?', [id]);
  }

  async countAll(): Promise<number> {
    const row = await this.db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM important_dates');
    return row?.count ?? 0;
  }

  async findCalendarOccurrencesByMonth(
    year: number,
    month: number,
    todayISODate = toISODate(new Date()),
  ): Promise<DateItemCalendarOccurrence[]> {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const rangeStart = `${prefix}-01`;
    const rangeEnd = toISODate(new Date(year, month, 0));
    const occurrences = await this.findCalendarOccurrences(todayISODate, rangeStart, rangeEnd);
    return occurrences
      .filter((occurrence) => occurrence.date.startsWith(prefix))
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        if (a.kind !== b.kind) return a.kind === 'important_date' ? -1 : 1;
        return a.title.localeCompare(b.title);
      });
  }

  async findCalendarOccurrencesByDate(
    date: string,
    todayISODate = toISODate(new Date()),
  ): Promise<DateItemCalendarOccurrence[]> {
    const occurrences = await this.findCalendarOccurrences(todayISODate, date, date);
    return occurrences.filter((occurrence) => occurrence.date === date);
  }

  async createAnniversaryRule(
    itemId: string,
    input: {
      anniversary_kind: DateItemAnniversaryRule['anniversary_kind'];
      anniversary_value: number;
      label?: string;
      enabled?: boolean;
    },
  ): Promise<DateItemAnniversaryRule> {
    const now = toISODateTime();
    const label = input.label?.trim() || formatDateItemAnniversaryLabel(input.anniversary_kind, input.anniversary_value);
    const id = generateId();
    await this.db.runAsync(
      `INSERT INTO important_date_anniversary_rules
         (id, important_date_id, anniversary_kind, anniversary_value, label, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(important_date_id, anniversary_kind, anniversary_value)
       DO UPDATE SET label = excluded.label, enabled = excluded.enabled, updated_at = excluded.updated_at`,
      [
        id,
        itemId,
        input.anniversary_kind,
        input.anniversary_value,
        label,
        input.enabled === false ? 0 : 1,
        now,
        now,
      ]
    );
    const rule = await this.db.getFirstAsync<DateItemAnniversaryRule>(
      `SELECT *
       FROM important_date_anniversary_rules
       WHERE important_date_id = ?
         AND anniversary_kind = ?
         AND anniversary_value = ?`,
      [itemId, input.anniversary_kind, input.anniversary_value]
    );
    if (!rule) throw new Error('无法创建纪念日设置');
    return rule;
  }

  async updateAnniversaryRule(
    id: string,
    input: Partial<Pick<DateItemAnniversaryRule, 'enabled'>>,
  ): Promise<void> {
    const fields: string[] = [];
    const values: Array<string | number> = [];
    if ('enabled' in input && input.enabled != null) {
      fields.push('enabled = ?');
      values.push(input.enabled);
    }
    if (fields.length === 0) return;
    fields.push('updated_at = ?');
    values.push(toISODateTime(), id);
    await this.db.runAsync(
      `UPDATE important_date_anniversary_rules SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  private async hydrate(item: DateItem, todayISODate: string): Promise<HydratedDateItem> {
    if (shouldHaveDefaultAnniversaries(item.source_kind, item.date, todayISODate)) {
      await this.ensureDefaultAnniversaries(item.id, toISODateTime());
    }
    const [artists, anniversaries] = await Promise.all([
      this.findArtists(item.id),
      this.findAnniversaries(item.id),
    ]);
    const relative = getDateItemRelativeCopy(item.date, todayISODate);
    const nextAnniversary = this.findNextAnniversary(item, anniversaries, todayISODate);
    return {
      item,
      artists,
      anniversaries,
      relativeText: relative.text,
      relativeState: relative.state,
      nextAnniversary,
    };
  }

  private async findArtists(itemId: string): Promise<Artist[]> {
    return this.db.getAllAsync<Artist>(
      `SELECT a.*, affiliation.parent_artist_id AS parent_id
       FROM artists a
       JOIN important_date_artists ida ON ida.artist_id = a.id
       LEFT JOIN artist_basic_affiliations affiliation
         ON affiliation.member_artist_id = a.id
       WHERE ida.important_date_id = ?
       ORDER BY a.name ASC`,
      [itemId]
    );
  }

  private async findAnniversaries(itemId: string): Promise<DateItemAnniversaryRule[]> {
    return this.db.getAllAsync<DateItemAnniversaryRule>(
      `SELECT *
       FROM important_date_anniversary_rules
       WHERE important_date_id = ?
       ORDER BY anniversary_kind ASC, anniversary_value ASC`,
      [itemId]
    );
  }

  private findNextAnniversary(
    item: DateItem,
    anniversaries: DateItemAnniversaryRule[],
    todayISODate: string,
  ): DateItemAnniversaryOccurrence | null {
    const upcoming = anniversaries
      .filter((rule) => rule.enabled === 1)
      .map((rule) => this.toNextAnniversaryOccurrence(item, rule, todayISODate))
      .filter((anniversary): anniversary is DateItemAnniversaryOccurrence => anniversary !== null)
      .filter((anniversary) => anniversary.date >= todayISODate)
      .sort((a, b) => a.date.localeCompare(b.date));
    return upcoming[0] ?? null;
  }

  private async replaceArtistLinks(itemId: string, artistIds: string[] | undefined): Promise<void> {
    await this.db.runAsync('DELETE FROM important_date_artists WHERE important_date_id = ?', [itemId]);
    for (const artistId of uniqueArtistIds(artistIds)) {
      await this.db.runAsync(
        'INSERT OR IGNORE INTO important_date_artists (important_date_id, artist_id) VALUES (?, ?)',
        [itemId, artistId]
      );
    }
  }

  private async ensureDefaultAnniversaries(itemId: string, now: string): Promise<void> {
    for (const anniversary of DEFAULT_ANNIVERSARIES) {
      await this.db.runAsync(
        `INSERT OR IGNORE INTO important_date_anniversary_rules
           (id, important_date_id, anniversary_kind, anniversary_value, label, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          generateId(),
          itemId,
          anniversary.kind,
          anniversary.value,
          formatDateItemAnniversaryRuleLabel(anniversary.kind, anniversary.value),
          now,
          now,
        ]
      );
    }
  }

  private toAnniversaryOccurrence(
    item: DateItem,
    rule: DateItemAnniversaryRule,
    todayISODate: string,
    occurrenceValue = rule.anniversary_value,
  ): DateItemAnniversaryOccurrence {
    const date = addDateItemAnniversaryDate(
      item.date,
      rule.anniversary_kind,
      occurrenceValue,
    );
    const occurrenceLabel = formatDateItemAnniversaryLabel(rule.anniversary_kind, occurrenceValue);
    return {
      id: `${item.id}:${rule.id}`,
      dateItemId: item.id,
      dateItemTitle: item.title,
      date,
      label: occurrenceLabel,
      title: `${item.title}的${occurrenceLabel}`,
      rule,
      relativeText: occurrenceLabel,
    };
  }

  private toNextAnniversaryOccurrence(
    item: DateItem,
    rule: DateItemAnniversaryRule,
    todayISODate: string,
  ): DateItemAnniversaryOccurrence | null {
    return this.getAnniversaryOccurrencesInRange(item, rule, todayISODate, '2126-12-31', todayISODate)[0] ?? null;
  }

  private getAnniversaryOccurrencesInRange(
    item: DateItem,
    rule: DateItemAnniversaryRule,
    rangeStart: string,
    rangeEnd: string,
    todayISODate: string,
  ): DateItemAnniversaryOccurrence[] {
    const occurrences: DateItemAnniversaryOccurrence[] = [];
    if (rule.enabled !== 1) return occurrences;
    const isRecurring = rule.label.startsWith('每');
    if (!isRecurring) {
      const occurrence = this.toAnniversaryOccurrence(item, rule, todayISODate);
      return occurrence.date >= rangeStart && occurrence.date <= rangeEnd ? [occurrence] : [];
    }

    const maxIterations = rule.anniversary_kind === 'month' ? 1200 : 200;
    let value = rule.anniversary_value;
    if (rule.anniversary_kind === 'day') {
      const dayDiff = getLocalDayDifference(rangeStart, item.date) + 1;
      value = Math.max(rule.anniversary_value, Math.ceil(dayDiff / rule.anniversary_value) * rule.anniversary_value);
    }

    for (let index = 0; index < maxIterations; index += 1) {
      const occurrence = this.toAnniversaryOccurrence(item, rule, todayISODate, value);
      if (occurrence.date > rangeEnd) break;
      if (occurrence.date >= rangeStart) occurrences.push(occurrence);
      value += rule.anniversary_value;
    }
    return occurrences;
  }

  private async findCalendarOccurrences(
    todayISODate: string,
    rangeStart: string,
    rangeEnd: string,
  ): Promise<DateItemCalendarOccurrence[]> {
    const items = await this.db.getAllAsync<DateItem>('SELECT * FROM important_dates ORDER BY date ASC');
    const occurrences: DateItemCalendarOccurrence[] = [];

    for (const item of items) {
      if (shouldHaveDefaultAnniversaries(item.source_kind, item.date, todayISODate)) {
        await this.ensureDefaultAnniversaries(item.id, toISODateTime());
      }
      const [artists, anniversaries] = await Promise.all([
        this.findArtists(item.id),
        this.findAnniversaries(item.id),
      ]);
      if (item.show_on_calendar !== 1) continue;
      occurrences.push({
        id: item.id,
        kind: 'important_date',
        date: item.date,
        title: item.title,
        dateItemId: item.id,
        anniversaryRuleId: null,
        anniversaryLabel: null,
        relativeText: getDateItemRelativeCopy(item.date, todayISODate).text,
        artists,
      });
      for (const rule of anniversaries) {
        for (const anniversary of this.getAnniversaryOccurrencesInRange(item, rule, rangeStart, rangeEnd, todayISODate)) {
          occurrences.push({
            id: `${anniversary.id}:${anniversary.date}`,
            kind: 'important_date_anniversary',
            date: anniversary.date,
            title: anniversary.title,
            dateItemId: item.id,
            anniversaryRuleId: rule.id,
            anniversaryLabel: anniversary.label,
            relativeText: anniversary.relativeText,
            artists,
          });
        }
      }
    }

    return occurrences;
  }
}
