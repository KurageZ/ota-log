import Database from 'better-sqlite3';
import { SCHEMA_STATEMENTS } from '../schema';
import { runMigrations } from '../migrations';
import { createAsyncSQLiteAdapter } from './fixtures/sqliteTestAdapter';

let mockUuidIndex = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `10000000-0000-4000-8000-${String(mockUuidIndex++).padStart(12, '0')}`,
}));

function createV16Database(): Database.Database {
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
    CREATE TABLE cheki (
      id TEXT PRIMARY KEY,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL,
      photo_uri TEXT NOT NULL,
      date TEXT,
      price REAL,
      notes TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE cheki_manual_entries (
      id TEXT PRIMARY KEY,
      artist_id TEXT REFERENCES artists(id) ON DELETE CASCADE,
      event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
      date TEXT,
      count INTEGER NOT NULL,
      total_price REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE user_config (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Otaku',
      avatar_uri TEXT,
      avatar_emoji TEXT NOT NULL DEFAULT '🎤',
      oshi_artist_id TEXT REFERENCES artists(id) ON DELETE SET NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO artists VALUES ('artist', 'Artist', '2026-01-01T00:00:00.000Z');
    INSERT INTO events VALUES (
      'event', 'Event', 'livehouse', '2026-06-01', NULL, NULL, NULL, NULL,
      'completed', NULL, NULL, NULL, NULL, NULL, NULL,
      '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'
    );
    INSERT INTO cheki VALUES
      ('photo-2', 'event', 'artist', 'file:///2.jpg', NULL, 12.4, 'second', '2026-06-01T11:00:00.000Z'),
      ('photo-1', 'event', 'artist', 'file:///1.jpg', NULL, NULL, 'first', '2026-06-01T10:00:00.000Z');
    INSERT INTO cheki_manual_entries VALUES
      ('manual', 'artist', 'event', NULL, 3, 10.4, '2026-06-01T09:00:00.000Z', '2026-06-02T09:00:00.000Z');
    PRAGMA user_version = 16;
  `);
  return db;
}

describe('v16 through v19 migration', () => {
  test('merges rows, preserves media and timestamps, and passes foreign key checks', async () => {
    const db = createV16Database();
    await runMigrations(createAsyncSQLiteAdapter(db));

    expect(db.pragma('user_version', { simple: true })).toBe(22);
    expect(db.prepare('SELECT quantity, date, created_at, updated_at FROM cheki_records').get())
      .toEqual({
        quantity: 5,
        date: '2026-06-01',
        created_at: '2026-06-01T09:00:00.000Z',
        updated_at: '2026-06-02T09:00:00.000Z',
      });
    expect(db.prepare('SELECT id, sort_order, unit_price, is_favorite, notes FROM cheki_items ORDER BY sort_order').all())
      .toEqual([
        { id: expect.any(String), sort_order: 0, unit_price: 4, is_favorite: 0, notes: null },
        { id: expect.any(String), sort_order: 1, unit_price: 3, is_favorite: 0, notes: null },
        { id: expect.any(String), sort_order: 2, unit_price: 3, is_favorite: 0, notes: null },
        { id: 'photo-1', sort_order: 3, unit_price: 0, is_favorite: 0, notes: 'first' },
        { id: 'photo-2', sort_order: 4, unit_price: 12, is_favorite: 0, notes: 'second' },
      ]);
    expect(db.prepare('SELECT side, photo_uri FROM cheki_item_images ORDER BY photo_uri').all())
      .toEqual([
        { side: 'front', photo_uri: 'file:///1.jpg' },
        { side: 'front', photo_uri: 'file:///2.jpg' },
      ]);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.prepare(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('cheki', 'cheki_manual_entries')",
    ).get()).toEqual({ count: 0 });
    db.close();
  });

  test('produces the same cheki schema objects as a fresh database', async () => {
    const upgraded = createV16Database();
    await runMigrations(createAsyncSQLiteAdapter(upgraded));
    const fresh = new Database(':memory:');
    for (const statement of SCHEMA_STATEMENTS) fresh.exec(statement);
    const query = `SELECT type, name, sql
      FROM sqlite_master
      WHERE (
        name LIKE 'cheki_%'
        OR name LIKE 'idx_cheki_%'
        OR name LIKE 'trg_cheki_%'
      )
      AND name NOT LIKE 'sqlite_autoindex_%'
      ORDER BY type, name`;
    const normalizeSchemaSql = (rows: unknown[]) => rows.map((row) => {
      const value = row as { sql?: string };
      return typeof value.sql === 'string'
        ? { ...value, sql: value.sql.replace('CREATE TABLE "cheki_items"', 'CREATE TABLE cheki_items') }
        : value;
    });
    expect(normalizeSchemaSql(upgraded.prepare(query).all()))
      .toEqual(normalizeSchemaSql(fresh.prepare(query).all()));
    upgraded.close();
    fresh.close();
  });
});
