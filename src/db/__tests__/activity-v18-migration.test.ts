import Database from 'better-sqlite3';
import { runMigrations } from '../migrations';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';

let mockUuidIndex = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `18000000-0000-4000-8000-${String(mockUuidIndex++).padStart(12, '0')}`,
}));

function columns(db: Database.Database, table: string): string[] {
  return (db.pragma(`table_info(${table})`) as Array<{ name: string }>).map((column) => column.name);
}

function createV17ActivityDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE artists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE trips (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      event_type TEXT NOT NULL DEFAULT 'livehouse',
      event_date TEXT NOT NULL,
      event_time TEXT,
      city TEXT,
      venue TEXT,
      ticket_price REAL,
      status TEXT NOT NULL,
      review_score INTEGER,
      notes TEXT,
      details TEXT,
      url TEXT,
      setlist_text TEXT,
      trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE event_artists (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
      PRIMARY KEY (event_id, artist_id)
    );
    CREATE TABLE photos (
      id TEXT PRIMARY KEY,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      local_uri TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE expenses (
      id TEXT PRIMARY KEY,
      event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE cheki_records (
      id TEXT PRIMARY KEY,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL,
      date TEXT,
      quantity INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE cheki_items (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES cheki_records(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      unit_price INTEGER NOT NULL DEFAULT 0,
      display_aspect_ratio REAL NOT NULL DEFAULT (54.0 / 86.0),
      is_favorite INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (record_id, sort_order)
    );
    CREATE TABLE cheki_item_images (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES cheki_items(id) ON DELETE CASCADE,
      side TEXT NOT NULL CHECK (side IN ('front', 'back')),
      photo_uri TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (item_id, side)
    );
    CREATE TABLE important_dates (
      id TEXT PRIMARY KEY,
      linked_event_id TEXT REFERENCES events(id) ON DELETE SET NULL
    );
    CREATE TABLE user_config (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Otaku',
      avatar_uri TEXT,
      avatar_emoji TEXT NOT NULL DEFAULT '🎤',
      oshi_artist_id TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  db.prepare(`INSERT INTO artists (id, name, created_at) VALUES (?, ?, ?)`).run(
    'artist-b', 'Artist B', '2026-01-01T00:00:00.000Z',
  );
  db.prepare(`INSERT INTO artists (id, name, created_at) VALUES (?, ?, ?)`).run(
    'artist-a', 'Artist A', '2026-01-01T00:00:00.000Z',
  );
  db.prepare(`INSERT INTO events
    (id, title, event_type, event_date, event_time, city, venue, ticket_price,
     status, review_score, notes, details, url, setlist_text, trip_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'event-v17',
    'Legacy Event',
    'festival',
    '2026-09-12',
    '18:30',
    '上海',
    'Legacy Venue',
    128,
    'planned',
    4,
    'private note',
    'details',
    'https://example.com/event',
    'setlist',
    null,
    '2026-08-01T00:00:00.000Z',
    '2026-08-02T00:00:00.000Z',
  );
  db.prepare('INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)')
    .run('event-v17', 'artist-b');
  db.prepare('INSERT INTO event_artists (event_id, artist_id) VALUES (?, ?)')
    .run('event-v17', 'artist-a');
  db.prepare('INSERT INTO photos (id, event_id, local_uri, created_at) VALUES (?, ?, ?, ?)')
    .run('photo', 'event-v17', 'file:///poster.jpg', '2026-08-01T00:00:00.000Z');
  db.prepare('INSERT INTO expenses (id, event_id, category, amount, created_at) VALUES (?, ?, ?, ?, ?)')
    .run('expense', 'event-v17', 'transport', 88, '2026-08-01T00:00:00.000Z');
  db.prepare('INSERT INTO cheki_records (id, event_id, quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run('cheki-record', 'event-v17', 1, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');
  db.prepare(`INSERT INTO cheki_items
    (id, record_id, sort_order, unit_price, display_aspect_ratio, created_at, updated_at)
    VALUES ('cheki-item', 'cheki-record', 0, 0, 54.0 / 86.0, ?, ?)`)
    .run('2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');
  db.prepare('INSERT INTO important_dates (id, linked_event_id) VALUES (?, ?)')
    .run('important-date', 'event-v17');
  db.pragma('user_version = 17');
  return db;
}

describe('Activity v18 migration', () => {
  beforeEach(() => {
    mockUuidIndex = 0;
  });

  test('moves every legacy activity into the single-layer root and one dated session', async () => {
    const db = createV17ActivityDb();

    await runMigrations(createAsyncSQLiteAdapter(db));

    expect(db.pragma('user_version', { simple: true })).toBe(23);
    expect(columns(db, 'events')).toEqual([
      'id', 'title', 'event_type', 'status', 'review_score', 'notes', 'details',
      'url', 'setlist_text', 'actual_expense', 'trip_id', 'created_at', 'updated_at',
    ]);
    expect(columns(db, 'event_timetable_sections')).toEqual([]);
    expect(columns(db, 'event_timetable_entries')).toEqual([
      'id', 'session_id', 'title', 'artist_id', 'start_time', 'end_time',
      'notes', 'sort_order', 'created_at', 'updated_at',
    ]);
    expect(db.prepare(`SELECT title, actual_expense, review_score, notes
      FROM events WHERE id = 'event-v17'`).get()).toEqual({
      title: 'Legacy Event',
      actual_expense: 128,
      review_score: 4,
      notes: 'private note',
    });
    expect(db.prepare(`SELECT id, event_id, title, session_date, end_date, open_time,
      start_time, end_time, city, venue, sort_order, created_at, updated_at
      FROM event_sessions WHERE event_id = 'event-v17'`).get()).toEqual({
      id: '18000000-0000-4000-8000-000000000000',
      event_id: 'event-v17',
      title: null,
      session_date: '2026-09-12',
      end_date: null,
      open_time: '18:30',
      start_time: null,
      end_time: null,
      city: '上海',
      venue: 'Legacy Venue',
      sort_order: 0,
      created_at: '2026-08-01T00:00:00.000Z',
      updated_at: '2026-08-02T00:00:00.000Z',
    });
    expect(db.prepare(`SELECT event_date, event_time, city, venue, ticket_price
      FROM event_summaries WHERE id = 'event-v17'`).get()).toEqual({
      event_date: '2026-09-12',
      event_time: '18:30',
      city: '上海',
      venue: 'Legacy Venue',
      ticket_price: 128,
    });
    expect(db.prepare(`SELECT artist_id, sort_order FROM event_artists
      WHERE event_id = 'event-v17' ORDER BY sort_order`).all()).toEqual([
      { artist_id: 'artist-b', sort_order: 0 },
      { artist_id: 'artist-a', sort_order: 1 },
    ]);
    expect(db.prepare("SELECT event_id FROM photos WHERE id = 'photo'").get())
      .toEqual({ event_id: 'event-v17' });
    expect(db.prepare("SELECT event_id FROM expenses WHERE id = 'expense'").get())
      .toEqual({ event_id: 'event-v17' });
    expect(db.prepare("SELECT event_id FROM cheki_records WHERE id = 'cheki-record'").get())
      .toEqual({ event_id: 'event-v17' });
    expect(db.prepare("SELECT linked_event_id FROM important_dates WHERE id = 'important-date'").get())
      .toEqual({ linked_event_id: 'event-v17' });
    expect(db.pragma('foreign_key_check')).toEqual([]);

    db.close();
  });
});
