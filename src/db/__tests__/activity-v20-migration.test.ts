import Database from 'better-sqlite3';
import { runMigrations } from '../migrations';
import { SCHEMA_STATEMENTS } from '../schema';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';

describe('Activity v20 time semantics migration', () => {
  test('treats a legacy single time as opening time and preserves explicit opening/performance times', async () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    for (const statement of SCHEMA_STATEMENTS) db.exec(statement);

    const now = '2026-08-01T00:00:00.000Z';
    const insertEvent = db.prepare(`INSERT INTO events
      (id, title, event_type, status, created_at, updated_at)
      VALUES (?, ?, 'livehouse', 'planned', ?, ?)`);
    insertEvent.run('legacy-time', 'Legacy time', now, now);
    insertEvent.run('explicit-times', 'Explicit times', now, now);

    const insertSession = db.prepare(`INSERT INTO event_sessions
      (id, event_id, session_date, open_time, start_time, sort_order, created_at, updated_at)
      VALUES (?, ?, '2026-09-12', ?, ?, 0, ?, ?)`);
    insertSession.run('legacy-session', 'legacy-time', null, '18:30', now, now);
    insertSession.run('explicit-session', 'explicit-times', '17:30', '18:30', now, now);
    db.pragma('user_version = 19');

    await runMigrations(createAsyncSQLiteAdapter(db));

    expect(db.pragma('user_version', { simple: true })).toBe(20);
    expect(db.prepare(`SELECT open_time, start_time FROM event_sessions
      WHERE id = 'legacy-session'`).get()).toEqual({
      open_time: '18:30',
      start_time: null,
    });
    expect(db.prepare(`SELECT open_time, start_time FROM event_sessions
      WHERE id = 'explicit-session'`).get()).toEqual({
      open_time: '17:30',
      start_time: '18:30',
    });
    expect(db.prepare(`SELECT event_time, open_time, start_time
      FROM event_summaries WHERE id = 'legacy-time'`).get()).toEqual({
      event_time: '18:30',
      open_time: '18:30',
      start_time: null,
    });
    expect(db.prepare(`SELECT event_time, open_time, start_time
      FROM event_summaries WHERE id = 'explicit-times'`).get()).toEqual({
      event_time: '17:30',
      open_time: '17:30',
      start_time: '18:30',
    });

    db.close();
  });
});
