import { SQLiteDatabase } from 'expo-sqlite';
import {
  CreateEventSessionInput,
  CreateEventTimetableEntryInput,
  EventSession,
  EventTimetableEntry,
  ReplaceEventSessionInput,
} from '../types/models';
import { toISODateTime } from '../utils/date';
import { generateId } from '../utils/uuid';

async function nextSortOrder(
  db: SQLiteDatabase,
  table: 'event_sessions' | 'event_timetable_entries',
  parentColumn: 'event_id' | 'session_id',
  parentId: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ next_order: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
     FROM ${table}
     WHERE ${parentColumn} = ?`,
    [parentId],
  );
  return row?.next_order ?? 0;
}

async function reorderChildren(
  db: SQLiteDatabase,
  table: 'event_sessions' | 'event_timetable_entries',
  parentColumn: 'event_id' | 'session_id',
  parentId: string,
  orderedIds: string[],
): Promise<void> {
  const rows = await db.getAllAsync<{ id: string; sort_order: number }>(
    `SELECT id, sort_order FROM ${table} WHERE ${parentColumn} = ? ORDER BY sort_order, id`,
    [parentId],
  );
  const existingIds = rows.map((row) => row.id).sort();
  const requestedIds = [...new Set(orderedIds)].sort();
  if (
    existingIds.length !== requestedIds.length
    || existingIds.some((id, index) => id !== requestedIds[index])
  ) {
    throw new Error('Reorder ids must match the complete child collection');
  }

  const temporaryBase = rows.reduce((max, row) => Math.max(max, row.sort_order), -1)
    + orderedIds.length + 1;
  const now = toISODateTime();
  await db.withTransactionAsync(async () => {
    for (const [index, id] of orderedIds.entries()) {
      await db.runAsync(
        `UPDATE ${table} SET sort_order = ?, updated_at = ? WHERE id = ?`,
        [temporaryBase + index, now, id],
      );
    }
    for (const [index, id] of orderedIds.entries()) {
      await db.runAsync(
        `UPDATE ${table} SET sort_order = ?, updated_at = ? WHERE id = ?`,
        [index, now, id],
      );
    }
  });
}

export class EventScheduleRepository {
  constructor(private db: SQLiteDatabase) {}

  async findSessions(eventId: string): Promise<EventSession[]> {
    return this.db.getAllAsync<EventSession>(
      `SELECT * FROM event_sessions
       WHERE event_id = ?
       ORDER BY sort_order ASC, session_date ASC, COALESCE(open_time, start_time) ASC, id ASC`,
      [eventId],
    );
  }

  async findSession(id: string): Promise<EventSession | null> {
    return this.db.getFirstAsync<EventSession>(
      'SELECT * FROM event_sessions WHERE id = ?',
      [id],
    );
  }

  async createSession(eventId: string, input: CreateEventSessionInput): Promise<EventSession> {
    const now = toISODateTime();
    const session: EventSession = {
      id: generateId(),
      event_id: eventId,
      title: input.title ?? null,
      session_date: input.session_date,
      end_date: input.end_date ?? null,
      open_time: input.open_time ?? null,
      start_time: input.start_time ?? null,
      end_time: input.end_time ?? null,
      city: input.city ?? null,
      venue: input.venue ?? null,
      sort_order: input.sort_order ?? await nextSortOrder(
        this.db, 'event_sessions', 'event_id', eventId,
      ),
      created_at: now,
      updated_at: now,
    };
    await this.db.runAsync(
      `INSERT INTO event_sessions
         (id, event_id, title, session_date, end_date, open_time, start_time,
          end_time, city, venue, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id, session.event_id, session.title, session.session_date,
        session.end_date, session.open_time, session.start_time, session.end_time,
        session.city, session.venue, session.sort_order, session.created_at,
        session.updated_at,
      ],
    );
    return session;
  }

  async updateSession(id: string, input: Partial<CreateEventSessionInput>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const keys: Array<keyof CreateEventSessionInput> = [
      'title', 'session_date', 'end_date', 'open_time', 'start_time', 'end_time',
      'city', 'venue', 'sort_order',
    ];
    for (const key of keys) {
      if (key in input) {
        fields.push(`${key} = ?`);
        values.push(input[key] ?? null);
      }
    }
    if (fields.length === 0) return;
    fields.push('updated_at = ?');
    values.push(toISODateTime(), id);
    await this.db.runAsync(
      `UPDATE event_sessions SET ${fields.join(', ')} WHERE id = ?`,
      values as Array<string | number | null>,
    );
  }

  async replaceSessions(
    eventId: string,
    inputs: ReplaceEventSessionInput[],
  ): Promise<EventSession[]> {
    if (inputs.length === 0) {
      throw new Error('An activity must keep at least one dated session');
    }

    const existing = await this.db.getAllAsync<{ id: string; sort_order: number }>(
      'SELECT id, sort_order FROM event_sessions WHERE event_id = ?',
      [eventId],
    );
    const existingIds = new Set(existing.map((session) => session.id));
    const requestedIds = inputs.flatMap((input) => input.id ? [input.id] : []);
    if (new Set(requestedIds).size !== requestedIds.length) {
      throw new Error('Session ids must be unique');
    }
    if (requestedIds.some((id) => !existingIds.has(id))) {
      throw new Error('Session does not belong to this activity');
    }

    const now = toISODateTime();
    const retainedIds = new Set(requestedIds);
    const temporaryBase = existing.reduce(
      (max, session) => Math.max(max, session.sort_order),
      -1,
    ) + existing.length + inputs.length + 1;

    await this.db.withTransactionAsync(async () => {
      for (const [index, session] of existing.entries()) {
        await this.db.runAsync(
          'UPDATE event_sessions SET sort_order = ?, updated_at = ? WHERE id = ?',
          [temporaryBase + index, now, session.id],
        );
      }

      for (const session of existing) {
        if (!retainedIds.has(session.id)) {
          await this.db.runAsync('DELETE FROM event_sessions WHERE id = ?', [session.id]);
        }
      }

      for (const [index, input] of inputs.entries()) {
        if (input.id) {
          await this.db.runAsync(
            `UPDATE event_sessions SET
               title = ?, session_date = ?, end_date = ?, open_time = ?,
               start_time = ?, end_time = ?, city = ?, venue = ?, sort_order = ?,
               updated_at = ?
             WHERE id = ? AND event_id = ?`,
            [
              input.title ?? null, input.session_date, input.end_date ?? null,
              input.open_time ?? null, input.start_time ?? null, input.end_time ?? null,
              input.city ?? null, input.venue ?? null, index, now, input.id, eventId,
            ],
          );
        } else {
          await this.db.runAsync(
            `INSERT INTO event_sessions
               (id, event_id, title, session_date, end_date, open_time, start_time,
                end_time, city, venue, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              generateId(), eventId, input.title ?? null, input.session_date,
              input.end_date ?? null, input.open_time ?? null, input.start_time ?? null,
              input.end_time ?? null, input.city ?? null, input.venue ?? null,
              index, now, now,
            ],
          );
        }
      }

      await this.db.runAsync('UPDATE events SET updated_at = ? WHERE id = ?', [now, eventId]);
    });

    return this.findSessions(eventId);
  }

  async deleteSession(id: string): Promise<void> {
    const session = await this.findSession(id);
    if (!session) return;
    const countRow = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM event_sessions WHERE event_id = ?',
      [session.event_id],
    );
    if ((countRow?.count ?? 0) <= 1) {
      throw new Error('An activity must keep at least one dated session');
    }
    await this.db.runAsync('DELETE FROM event_sessions WHERE id = ?', [id]);
  }

  async reorderSessions(eventId: string, orderedIds: string[]): Promise<void> {
    await reorderChildren(this.db, 'event_sessions', 'event_id', eventId, orderedIds);
  }

  async findTimetable(sessionId: string): Promise<EventTimetableEntry[]> {
    return this.db.getAllAsync<EventTimetableEntry>(
      `SELECT * FROM event_timetable_entries
       WHERE session_id = ? ORDER BY sort_order ASC, id ASC`,
      [sessionId],
    );
  }

  async createTimetableEntry(
    sessionId: string,
    input: CreateEventTimetableEntryInput,
  ): Promise<EventTimetableEntry> {
    const now = toISODateTime();
    const entry: EventTimetableEntry = {
      id: generateId(),
      session_id: sessionId,
      title: input.title,
      artist_id: input.artist_id ?? null,
      start_time: input.start_time ?? null,
      end_time: input.end_time ?? null,
      notes: input.notes ?? null,
      sort_order: input.sort_order ?? await nextSortOrder(
        this.db, 'event_timetable_entries', 'session_id', sessionId,
      ),
      created_at: now,
      updated_at: now,
    };
    await this.db.runAsync(
      `INSERT INTO event_timetable_entries
         (id, session_id, title, artist_id, start_time, end_time, notes,
          sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id, entry.session_id, entry.title, entry.artist_id, entry.start_time,
        entry.end_time, entry.notes, entry.sort_order, entry.created_at,
        entry.updated_at,
      ],
    );
    return entry;
  }

  async updateTimetableEntry(
    id: string,
    input: Partial<CreateEventTimetableEntryInput>,
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];
    const keys: Array<keyof CreateEventTimetableEntryInput> = [
      'title', 'artist_id', 'start_time', 'end_time', 'notes', 'sort_order',
    ];
    for (const key of keys) {
      if (key in input) {
        fields.push(`${key} = ?`);
        values.push(input[key] ?? null);
      }
    }
    if (fields.length === 0) return;
    fields.push('updated_at = ?');
    values.push(toISODateTime(), id);
    await this.db.runAsync(
      `UPDATE event_timetable_entries SET ${fields.join(', ')} WHERE id = ?`,
      values as Array<string | number | null>,
    );
  }

  async deleteTimetableEntry(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM event_timetable_entries WHERE id = ?', [id]);
  }

  async reorderTimetableEntries(sessionId: string, orderedIds: string[]): Promise<void> {
    await reorderChildren(
      this.db, 'event_timetable_entries', 'session_id', sessionId, orderedIds,
    );
  }

  async replaceTimetable(
    sessionId: string,
    entries: CreateEventTimetableEntryInput[],
  ): Promise<EventTimetableEntry[]> {
    const session = await this.findSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (entries.some((entry) => !entry.title.trim())) {
      throw new Error('Timetable entry title is required');
    }

    const now = toISODateTime();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM event_timetable_entries WHERE session_id = ?', [sessionId]);

      for (const [entryIndex, entryInput] of entries.entries()) {
        await this.db.runAsync(
          `INSERT INTO event_timetable_entries
             (id, session_id, title, artist_id, start_time, end_time, notes,
              sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generateId(), sessionId, entryInput.title, entryInput.artist_id ?? null,
            entryInput.start_time ?? null, entryInput.end_time ?? null,
            entryInput.notes ?? null, entryIndex, now, now,
          ],
        );
      }
    });

    return this.findTimetable(sessionId);
  }
}
