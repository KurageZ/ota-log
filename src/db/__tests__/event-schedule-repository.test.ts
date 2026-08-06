import Database from 'better-sqlite3';
import { EventScheduleRepository } from '../../repositories/EventScheduleRepository';
import { SCHEMA_STATEMENTS } from '../schema';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';

let mockUuidIndex = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `30000000-0000-4000-8000-${String(mockUuidIndex++).padStart(12, '0')}`,
}));

describe('EventScheduleRepository', () => {
  let db: Database.Database;
  let repository: EventScheduleRepository;

  beforeEach(() => {
    mockUuidIndex = 0;
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    for (const statement of SCHEMA_STATEMENTS) db.exec(statement);
    const now = '2026-08-01T00:00:00.000Z';
    db.prepare(
      `INSERT INTO artists (id, name, is_favorite, created_at)
       VALUES ('artist', 'Artist', 0, ?)`,
    ).run(now);
    db.prepare(
      `INSERT INTO events (id, title, event_type, status, created_at, updated_at)
       VALUES ('event', 'Event', 'festival', 'planned', ?, ?)`,
    ).run(now, now);
    db.prepare(
      `INSERT INTO event_sessions
         (id, event_id, session_date, start_time, sort_order, created_at, updated_at)
       VALUES ('session-1', 'event', '2026-08-08', '12:00', 0, ?, ?)`,
    ).run(now, now);
    repository = new EventScheduleRepository(createAsyncSQLiteAdapter(db));
  });

  afterEach(() => db.close());

  test('creates, updates, reorders, and protects the last dated session', async () => {
    const second = await repository.createSession('event', {
      title: '夜场',
      session_date: '2026-08-08',
      start_time: '18:00',
      city: '上海',
      venue: '场馆',
    });

    expect(second.sort_order).toBe(1);
    await repository.updateSession(second.id, { open_time: '17:30', end_time: '20:00' });
    expect(await repository.findSession(second.id)).toEqual(expect.objectContaining({
      open_time: '17:30',
      end_time: '20:00',
    }));

    await repository.reorderSessions('event', [second.id, 'session-1']);
    expect(db.prepare(
      `SELECT id, sort_order FROM event_sessions
       WHERE event_id = 'event' ORDER BY sort_order`,
    ).all()).toEqual([
      { id: second.id, sort_order: 0 },
      { id: 'session-1', sort_order: 1 },
    ]);
    await expect(repository.reorderSessions('event', [second.id])).rejects.toThrow(
      'Reorder ids must match the complete child collection',
    );

    await repository.deleteSession('session-1');
    await expect(repository.deleteSession(second.id)).rejects.toThrow(
      'An activity must keep at least one dated session',
    );
  });

  test('manages ordered timetable entries with optional artist links', async () => {
    const opening = await repository.createTimetableEntry('session-1', {
      title: 'Opening',
      start_time: '12:00',
    });
    const live = await repository.createTimetableEntry('session-1', {
      title: 'Artist Live',
      artist_id: 'artist',
      start_time: '12:30',
      notes: '特典会 13:30–14:30',
    });

    await repository.reorderTimetableEntries('session-1', [live.id, opening.id]);
    await repository.updateTimetableEntry(live.id, { title: 'Encore', end_time: '13:00' });
    expect(await repository.findTimetable('session-1')).toEqual([
      expect.objectContaining({
        id: live.id,
        session_id: 'session-1',
        title: 'Encore',
        artist_id: 'artist',
        end_time: '13:00',
        sort_order: 0,
      }),
      expect.objectContaining({ id: opening.id, sort_order: 1 }),
    ]);

    await repository.deleteTimetableEntry(live.id);
    expect(await repository.findTimetable('session-1')).toEqual([
      expect.objectContaining({ id: opening.id }),
    ]);
  });

  test('replaces a complete session timetable and removes stale rows', async () => {
    const stale = await repository.createTimetableEntry('session-1', { title: '旧流程' });

    await repository.replaceTimetable('session-1', [
      { title: 'Opening', start_time: '12:00' },
      {
        title: 'Artist Live',
        artist_id: 'artist',
        start_time: '12:30',
        end_time: '13:00',
        notes: '30 min',
      },
      { title: '终演后物贩' },
    ]);

    expect(await repository.findTimetable('session-1')).toEqual([
      expect.objectContaining({ title: 'Opening', sort_order: 0 }),
      expect.objectContaining({
        title: 'Artist Live',
        artist_id: 'artist',
        start_time: '12:30',
        end_time: '13:00',
        notes: '30 min',
        sort_order: 1,
      }),
      expect.objectContaining({ title: '终演后物贩', sort_order: 2 }),
    ]);
    expect(db.prepare(
      'SELECT COUNT(*) AS count FROM event_timetable_entries WHERE id = ?',
    ).get(stale.id)).toEqual({ count: 0 });

    await repository.replaceTimetable('session-1', []);
    expect(await repository.findTimetable('session-1')).toEqual([]);
  });

  test('replaces the complete session collection and preserves retained timetables', async () => {
    const retained = await repository.createTimetableEntry('session-1', { title: '主舞台出演' });
    const removed = await repository.createSession('event', {
      session_date: '2026-08-09',
      start_time: '10:00',
    });
    const removedEntry = await repository.createTimetableEntry(removed.id, {
      title: 'Removed live',
    });

    const sessions = await repository.replaceSessions('event', [
      {
        id: 'session-1',
        title: '昼场',
        session_date: '2026-08-08',
        open_time: '11:00',
        start_time: '12:00',
        city: '上海',
      },
      {
        title: '夜场',
        session_date: '2026-08-08',
        start_time: '18:00',
        venue: '场馆',
      },
    ]);

    expect(sessions).toEqual([
      expect.objectContaining({ id: 'session-1', title: '昼场', sort_order: 0 }),
      expect.objectContaining({ title: '夜场', sort_order: 1, venue: '场馆' }),
    ]);
    expect(await repository.findTimetable('session-1')).toEqual([
      expect.objectContaining({ id: retained.id }),
    ]);
    expect(db.prepare(
      'SELECT COUNT(*) AS count FROM event_timetable_entries WHERE id = ?',
    ).get(removedEntry.id)).toEqual({ count: 0 });
  });

  test('rejects an empty replacement and session ids from another activity', async () => {
    const now = '2026-08-01T00:00:00.000Z';
    db.prepare(
      `INSERT INTO events (id, title, event_type, status, created_at, updated_at)
       VALUES ('other-event', 'Other', 'festival', 'planned', ?, ?)`,
    ).run(now, now);
    db.prepare(
      `INSERT INTO event_sessions
         (id, event_id, session_date, sort_order, created_at, updated_at)
       VALUES ('other-session', 'other-event', '2026-08-10', 0, ?, ?)`,
    ).run(now, now);

    await expect(repository.replaceSessions('event', [])).rejects.toThrow(
      'An activity must keep at least one dated session',
    );
    await expect(repository.replaceSessions('event', [{
      id: 'other-session',
      session_date: '2026-08-10',
    }])).rejects.toThrow('Session does not belong to this activity');
  });
});
